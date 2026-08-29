/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpeciesType, SynthModulationParams } from '../types';
import { quantizeToScale, midiToFreq, SCALES } from './scales';

export interface SoundEngineConfig {
  masterVolume: number;
  scaleKey: string;
  rootMidi: number;
  reverbMix: number;
  delayMix: number;
  filterCutoff: number;
  droneVolume: number;
  sfxVolume: number;
  neuralSynthVolume: number;
  fmDepthMacro: number;
  timbreMacro: number;
  isMuted: boolean;
}

interface ActiveNeuralVoice {
  carrier: OscillatorNode;
  modulator: OscillatorNode;
  modGain: GainNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  pan: StereoPannerNode;
  lastTriggerStep: number;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isInitialized = false;

  // Master Gain & Busses
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private neuralSynthGain: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;
  private dynamicsCompressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;

  // Delay & Reverb Effects
  private delayNode: DelayNode | null = null;
  private delayFeedbackGain: GainNode | null = null;
  private delayWetGain: GainNode | null = null;
  private reverbConvolver: ConvolverNode | null = null;
  private reverbWetGain: GainNode | null = null;

  // Drone Oscillators
  private droneOscs: { osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode; pan: StereoPannerNode }[] = [];

  // Dedicated Continuous Neural Synth Voices (keyed by agent ID or primary voice)
  private neuralVoices: Map<string, ActiveNeuralVoice> = new Map();
  private lastLiveSynthParams: Map<string, SynthModulationParams> = new Map();

  // Configuration
  private config: SoundEngineConfig = {
    masterVolume: 0.7,
    scaleKey: 'lydian',
    rootMidi: 48, // C3
    reverbMix: 0.4,
    delayMix: 0.25,
    filterCutoff: 3800,
    droneVolume: 0.35,
    sfxVolume: 0.6,
    neuralSynthVolume: 0.5,
    fmDepthMacro: 1.0,
    timbreMacro: 1.0,
    isMuted: false,
  };

  // Voice Limiter / Throttling to prevent audio overload
  private lastTriggerTime = 0;
  private activeVoiceCount = 0;
  private maxConcurrentVoices = 16;

  public init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master Chain: [SFX + Drone + Neural Synth] -> [Master Filter] -> [Compressor] -> [Master Gain] -> [Analyser] -> Destination
      this.dynamicsCompressor = this.ctx.createDynamicsCompressor();
      this.dynamicsCompressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
      this.dynamicsCompressor.knee.setValueAtTime(12, this.ctx.currentTime);
      this.dynamicsCompressor.ratio.setValueAtTime(4, this.ctx.currentTime);
      this.dynamicsCompressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
      this.dynamicsCompressor.release.setValueAtTime(0.1, this.ctx.currentTime);

      this.masterFilter = this.ctx.createBiquadFilter();
      this.masterFilter.type = 'lowpass';
      this.masterFilter.frequency.setValueAtTime(this.config.filterCutoff, this.ctx.currentTime);
      this.masterFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.config.isMuted ? 0 : this.config.masterVolume, this.ctx.currentTime);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.config.sfxVolume, this.ctx.currentTime);

      this.droneGain = this.ctx.createGain();
      this.droneGain.gain.setValueAtTime(this.config.droneVolume, this.ctx.currentTime);

      this.neuralSynthGain = this.ctx.createGain();
      this.neuralSynthGain.gain.setValueAtTime(this.config.neuralSynthVolume, this.ctx.currentTime);

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      // Connect Master Output
      this.masterFilter.connect(this.dynamicsCompressor);
      this.dynamicsCompressor.connect(this.masterGain);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      // Create Delay Network
      this.delayNode = this.ctx.createDelay(1.0);
      this.delayNode.delayTime.setValueAtTime(0.24, this.ctx.currentTime); // ~125 BPM eighth note
      this.delayFeedbackGain = this.ctx.createGain();
      this.delayFeedbackGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      this.delayWetGain = this.ctx.createGain();
      this.delayWetGain.gain.setValueAtTime(this.config.delayMix, this.ctx.currentTime);

      this.delayNode.connect(this.delayFeedbackGain);
      this.delayFeedbackGain.connect(this.delayNode);
      this.delayNode.connect(this.delayWetGain);
      this.delayWetGain.connect(this.masterFilter);

      // Create Algorithmic Reverb Impulse
      this.createAlgorithmicReverb();

      // Connect Main Sources to Filter & Delay/Reverb sends
      this.sfxGain.connect(this.masterFilter);
      this.sfxGain.connect(this.delayNode);

      this.neuralSynthGain.connect(this.masterFilter);
      this.neuralSynthGain.connect(this.delayNode);

      if (this.reverbConvolver && this.reverbWetGain) {
        this.sfxGain.connect(this.reverbConvolver);
        this.neuralSynthGain.connect(this.reverbConvolver);
      }

      this.droneGain.connect(this.masterFilter);

      // Init Ambient Drone
      this.initDroneOscillators();

      this.isInitialized = true;
    } catch (e) {
      console.warn('Audio Context initialization failed or requires user interaction:', e);
    }
  }

  private createAlgorithmicReverb() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 2.5; // 2.5 second tail
    const decay = 2.0;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = i / length;
      const envelope = Math.exp(-n * decay);
      left[i] = (Math.random() * 2 - 1) * envelope;
      right[i] = (Math.random() * 2 - 1) * envelope;
    }

    this.reverbConvolver = this.ctx.createConvolver();
    this.reverbConvolver.buffer = impulse;

    this.reverbWetGain = this.ctx.createGain();
    this.reverbWetGain.gain.setValueAtTime(this.config.reverbMix, this.ctx.currentTime);

    this.reverbConvolver.connect(this.reverbWetGain);
    this.reverbWetGain.connect(this.masterFilter!);
  }

  private initDroneOscillators() {
    if (!this.ctx || !this.droneGain) return;

    // Harmonic Chord Root / Fifth / Octave / Ninth drone cluster
    const ratios = [1.0, 1.498, 2.0, 2.996]; 
    const rootFreq = midiToFreq(this.config.rootMidi - 12); // Deep bass register

    this.droneOscs = ratios.map((ratio, index) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();
      const pan = this.ctx!.createStereoPanner();

      osc.type = index % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(rootFreq * ratio, this.ctx!.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(280 + index * 120, this.ctx!.currentTime);
      filter.Q.setValueAtTime(2.0, this.ctx!.currentTime);

      gain.gain.setValueAtTime(0.08 / (index + 1), this.ctx!.currentTime);
      pan.pan.setValueAtTime((index - 1.5) * 0.4, this.ctx!.currentTime);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(pan);
      pan.connect(this.droneGain!);

      osc.start();
      return { osc, gain, filter, pan };
    });
  }

  /**
   * Continuous RL Neural Synthesizer Voice:
   * Dynamically alters Pitch, FM index, Timbre Morph, VCF cutoff, and Rhythmic Envelopes
   * in real-time as the agent perceives and acts in the environment.
   */
  public updateAgentContinuousSynth(params: SynthModulationParams) {
    if (!this.ctx || !this.isInitialized || this.config.isMuted) return;
    this.lastLiveSynthParams.set(params.agentId, params);

    const now = this.ctx.currentTime;
    let voice = this.neuralVoices.get(params.agentId);

    // Create dynamic neural voice if not yet initialized for this agent
    if (!voice) {
      if (this.neuralVoices.size > 8) {
        // Recycle oldest voice
        const oldestKey = this.neuralVoices.keys().next().value;
        if (oldestKey) {
          const oldV = this.neuralVoices.get(oldestKey);
          if (oldV) {
            oldV.carrier.stop();
            oldV.modulator.stop();
            this.neuralVoices.delete(oldestKey);
          }
        }
      }

      const carrier = this.ctx.createOscillator();
      const modulator = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      const pan = this.ctx.createStereoPanner();

      // Timbre wave selection
      carrier.type = params.timbreMorph > 0.6 ? 'sawtooth' : (params.timbreMorph > 0.3 ? 'triangle' : 'sine');
      modulator.type = 'sine';

      carrier.frequency.setValueAtTime(220, now);
      modulator.frequency.setValueAtTime(440, now);
      modGain.gain.setValueAtTime(50, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(params.filterCutoff, now);
      filter.Q.setValueAtTime(params.filterResonance, now);

      gain.gain.setValueAtTime(0.001, now);
      pan.pan.setValueAtTime(params.pan, now);

      // Connect FM synthesis chain: [Modulator -> ModGain -> Carrier.frequency]
      modulator.connect(modGain);
      modGain.connect(carrier.frequency);

      // [Carrier -> Filter -> Gain -> Pan -> NeuralSynthBus]
      carrier.connect(filter);
      filter.connect(gain);
      gain.connect(pan);
      pan.connect(this.neuralSynthGain!);

      carrier.start(now);
      modulator.start(now);

      voice = { carrier, modulator, modGain, filter, gain, pan, lastTriggerStep: 0 };
      this.neuralVoices.set(params.agentId, voice);
    }

    // 1. Dynamic Pitch Modulation from quantized scale
    const targetFreq = quantizeToScale(params.pitchNormalized, this.config.rootMidi, this.config.scaleKey);
    voice.carrier.frequency.setTargetAtTime(targetFreq, now, 0.04);

    // 2. FM Modulator Ratio (harmonic or dissonant depending on species & learning entropy)
    const harmonicRatio = params.species === SpeciesType.Predator ? 0.5 : (params.species === SpeciesType.Resonator ? 2.0 : 1.5);
    voice.modulator.frequency.setTargetAtTime(targetFreq * harmonicRatio, now, 0.04);

    // 3. Timbre FM Index modulation
    const modDepth = (params.fmModulationIndex * 350 + 20) * this.config.fmDepthMacro;
    voice.modGain.gain.setTargetAtTime(modDepth, now, 0.05);

    // 4. Dynamic VCF Filter Cutoff & Resonance
    const targetCutoff = Math.max(180, Math.min(10000, params.filterCutoff * this.config.timbreMacro));
    voice.filter.frequency.setTargetAtTime(targetCutoff, now, 0.05);
    voice.filter.Q.setTargetAtTime(params.filterResonance, now, 0.05);

    // 5. Stereo Panning
    voice.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, params.pan)), now, 0.05);

    // 6. Rhythmic pulse triggering
    if (params.rhythmTrigger) {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(params.amplitude * 0.35, now + 0.01);
      voice.gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    } else {
      // Subtle continuous pad amplitude
      const restingAmp = params.amplitude * 0.06;
      voice.gain.gain.setTargetAtTime(restingAmp, now, 0.08);
    }
  }

  /**
   * Release synth voice for removed/deceased agent
   */
  public releaseAgentSynth(agentId: string) {
    const voice = this.neuralVoices.get(agentId);
    if (voice && this.ctx) {
      const now = this.ctx.currentTime;
      voice.gain.gain.setTargetAtTime(0.0001, now, 0.1);
      setTimeout(() => {
        try {
          voice.carrier.stop();
          voice.modulator.stop();
        } catch (e) {}
        this.neuralVoices.delete(agentId);
        this.lastLiveSynthParams.delete(agentId);
      }, 150);
    }
  }

  public getLiveSynthParams(): SynthModulationParams[] {
    return Array.from(this.lastLiveSynthParams.values());
  }

  /**
   * Update Drone pitch and timbre based on global environmental entropy & species territory
   */
  public updateAmbientEcosystemSound(harmonicEntropy: number, dominantSpecies: SpeciesType, fieldEnergy: number) {
    if (!this.ctx || !this.isInitialized || this.droneOscs.length === 0) return;

    const now = this.ctx.currentTime;

    // Modulate Drone filters and subtle pitch wavers
    this.droneOscs.forEach((item, idx) => {
      const targetCutoff = Math.max(120, Math.min(1800, 250 + harmonicEntropy * 600 + fieldEnergy * 400 + idx * 80));
      item.filter.frequency.setTargetAtTime(targetCutoff, now, 0.2);

      // Subtle detune based on dominant species character
      let detuneCents = Math.sin(now * (0.2 + idx * 0.1)) * 6;
      if (dominantSpecies === SpeciesType.Predator) detuneCents -= 15; // Dark, tense
      if (dominantSpecies === SpeciesType.Resonator) detuneCents += 8; // Bright, open
      item.osc.detune.setTargetAtTime(detuneCents, now, 0.3);
    });

    if (this.masterFilter) {
      const masterCutoff = Math.max(800, Math.min(8000, this.config.filterCutoff + fieldEnergy * 1500));
      this.masterFilter.frequency.setTargetAtTime(masterCutoff, now, 0.1);
    }
  }

  /**
   * Trigger sonic pulse for an agent event (Echolocation, hunting clash, crystal resonance, arpeggio sweep)
   */
  public triggerAgentSound(
    species: SpeciesType,
    normalizedX: number, // 0..1 (for spatial panning)
    normalizedPitch: number, // 0..1 (pitch on scale)
    intensity: number = 0.5, // 0..1 (volume / duration)
    tdError: number = 0 // Temporal Difference error modulates FM timbre & tension
  ) {
    if (!this.ctx || !this.isInitialized || this.config.isMuted) return;

    const now = this.ctx.currentTime;
    if (now - this.lastTriggerTime < 0.025 && this.activeVoiceCount >= this.maxConcurrentVoices) {
      return; // Voice limit to avoid stutter
    }
    this.lastTriggerTime = now;
    this.activeVoiceCount++;

    try {
      // Spatial Panning (-1 = left, 1 = right)
      const panNode = this.ctx.createStereoPanner();
      const panValue = Math.max(-1, Math.min(1, (normalizedX - 0.5) * 1.8));
      panNode.pan.setValueAtTime(panValue, now);

      // Pitch calculation based on configured musical scale
      const freq = quantizeToScale(normalizedPitch, this.config.rootMidi, this.config.scaleKey);

      // Voice Gain Envelope
      const voiceGain = this.ctx.createGain();
      voiceGain.gain.setValueAtTime(0.0001, now);

      // Distinct Polyphonic FM & Subtractive synthesis by Species role:
      switch (species) {
        case SpeciesType.Resonator: {
          // Pure Crystal Bell / FM Shimmer
          const carrier = this.ctx.createOscillator();
          const modulator = this.ctx.createOscillator();
          const modGain = this.ctx.createGain();

          carrier.type = 'sine';
          carrier.frequency.setValueAtTime(freq * 1.5, now);

          modulator.type = 'sine';
          modulator.frequency.setValueAtTime(freq * 2.003, now); // Slightly inharmonic ratio

          const modDepth = (200 + tdError * 400) * intensity;
          modGain.gain.setValueAtTime(modDepth, now);
          modGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

          modulator.connect(modGain);
          modGain.connect(carrier.frequency);

          const dur = 0.25 + intensity * 0.35;
          voiceGain.gain.linearRampToValueAtTime(0.28 * intensity, now + 0.015);
          voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

          carrier.connect(voiceGain);
          voiceGain.connect(panNode);
          panNode.connect(this.sfxGain!);

          carrier.start(now);
          modulator.start(now);
          carrier.stop(now + dur + 0.05);
          modulator.stop(now + dur + 0.05);
          break;
        }

        case SpeciesType.Predator: {
          // Sub Punch / Bass Impact Transient
          const osc = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();

          osc.type = 'sawtooth';
          const baseBassFreq = Math.max(38, freq * 0.5);
          osc.frequency.setValueAtTime(baseBassFreq * 2.5, now);
          osc.frequency.exponentialRampToValueAtTime(baseBassFreq, now + 0.08);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(800 + tdError * 600, now);
          filter.frequency.exponentialRampToValueAtTime(100, now + 0.2);
          filter.Q.setValueAtTime(4.0, now);

          const dur = 0.2 + intensity * 0.2;
          voiceGain.gain.linearRampToValueAtTime(0.4 * intensity, now + 0.005);
          voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

          osc.connect(filter);
          filter.connect(voiceGain);
          voiceGain.connect(panNode);
          panNode.connect(this.sfxGain!);

          osc.start(now);
          osc.stop(now + dur + 0.05);
          break;
        }

        case SpeciesType.Architect: {
          // Warm Resonant Pad / Pluck
          const osc1 = this.ctx.createOscillator();
          const osc2 = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();

          osc1.type = 'triangle';
          osc2.type = 'sine';
          osc1.frequency.setValueAtTime(freq, now);
          osc2.frequency.setValueAtTime(freq * 1.002, now); // Chorus detune

          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(freq * 2.0, now);
          filter.Q.setValueAtTime(3.0, now);

          const dur = 0.35 + intensity * 0.4;
          voiceGain.gain.linearRampToValueAtTime(0.22 * intensity, now + 0.02);
          voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

          osc1.connect(filter);
          osc2.connect(filter);
          filter.connect(voiceGain);
          voiceGain.connect(panNode);
          panNode.connect(this.sfxGain!);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + dur + 0.05);
          osc2.stop(now + dur + 0.05);
          break;
        }

        case SpeciesType.Glider: {
          // Fast Crystalline Arpeggio Glissando
          const osc = this.ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq * 2.0, now);
          osc.frequency.exponentialRampToValueAtTime(freq * 3.0, now + 0.08);

          const dur = 0.12 + intensity * 0.15;
          voiceGain.gain.linearRampToValueAtTime(0.2 * intensity, now + 0.008);
          voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

          osc.connect(voiceGain);
          voiceGain.connect(panNode);
          panNode.connect(this.sfxGain!);

          osc.start(now);
          osc.stop(now + dur + 0.05);
          break;
        }
      }

      setTimeout(() => {
        this.activeVoiceCount = Math.max(0, this.activeVoiceCount - 1);
      }, 500);

    } catch (err) {
      this.activeVoiceCount = Math.max(0, this.activeVoiceCount - 1);
    }
  }

  /**
   * Sound effect for energy node collection or reward milestone
   */
  public triggerChime(scaleVal: number = 0.5) {
    if (!this.ctx || !this.isInitialized || this.config.isMuted) return;
    const now = this.ctx.currentTime;
    const freq = quantizeToScale(scaleVal, this.config.rootMidi + 12, this.config.scaleKey);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.sfxGain!);

    osc.start(now);
    osc.stop(now + 0.45);
  }

  /**
   * Get Byte Frequency data for real-time oscilloscope / spectrum visualizer
   */
  public getFrequencyData(array: Uint8Array): void {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(array);
    } else {
      array.fill(0);
    }
  }

  public getTimeDomainData(array: Uint8Array): void {
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(array);
    } else {
      array.fill(128);
    }
  }

  // Getters & Setters for UI configuration
  public getConfig(): SoundEngineConfig {
    return { ...this.config };
  }

  public setMasterVolume(vol: number) {
    this.config.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.config.isMuted ? 0 : this.config.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  public setMuted(muted: boolean) {
    this.config.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.config.masterVolume, this.ctx.currentTime, 0.05);
    }
  }

  public setScale(scaleKey: string) {
    if (SCALES[scaleKey]) {
      this.config.scaleKey = scaleKey;
    }
  }

  public setRootNote(midi: number) {
    this.config.rootMidi = midi;
    // Retune drone
    if (this.ctx && this.droneOscs.length > 0) {
      const rootFreq = midiToFreq(midi - 12);
      const ratios = [1.0, 1.498, 2.0, 2.996];
      this.droneOscs.forEach((item, idx) => {
        item.osc.frequency.setTargetAtTime(rootFreq * ratios[idx], this.ctx!.currentTime, 0.2);
      });
    }
  }

  public setReverbMix(mix: number) {
    this.config.reverbMix = Math.max(0, Math.min(1, mix));
    if (this.reverbWetGain && this.ctx) {
      this.reverbWetGain.gain.setTargetAtTime(this.config.reverbMix, this.ctx.currentTime, 0.05);
    }
  }

  public setDelayMix(mix: number) {
    this.config.delayMix = Math.max(0, Math.min(1, mix));
    if (this.delayWetGain && this.ctx) {
      this.delayWetGain.gain.setTargetAtTime(this.config.delayMix, this.ctx.currentTime, 0.05);
    }
  }

  public setFilterCutoff(hz: number) {
    this.config.filterCutoff = Math.max(200, Math.min(12000, hz));
    if (this.masterFilter && this.ctx) {
      this.masterFilter.frequency.setTargetAtTime(this.config.filterCutoff, this.ctx.currentTime, 0.05);
    }
  }

  public setDroneVolume(vol: number) {
    this.config.droneVolume = Math.max(0, Math.min(1, vol));
    if (this.droneGain && this.ctx) {
      this.droneGain.gain.setTargetAtTime(this.config.droneVolume, this.ctx.currentTime, 0.05);
    }
  }

  public setNeuralSynthVolume(vol: number) {
    this.config.neuralSynthVolume = Math.max(0, Math.min(1, vol));
    if (this.neuralSynthGain && this.ctx) {
      this.neuralSynthGain.gain.setTargetAtTime(this.config.neuralSynthVolume, this.ctx.currentTime, 0.05);
    }
  }

  public setFmDepthMacro(macro: number) {
    this.config.fmDepthMacro = Math.max(0, Math.min(3, macro));
  }

  public setTimbreMacro(macro: number) {
    this.config.timbreMacro = Math.max(0.2, Math.min(2.5, macro));
  }
}

export const soundEngine = new SoundEngine();
