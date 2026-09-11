import { SimulationEngine } from '../simulation/engine';
import { WORLD_PACING } from '../simulation/worldPacing';
import { buildAetherSourceManifest } from '../integration/aetherStreamContract';
import { OrigoMusicClock } from './musicClock';
import { OrigoMusicDirector } from './musicDirector';
import { analyzeMusicSession } from './musicalAnalysis';
import { sessionToMidi } from './midiExporter';
import { renderSessionToWav } from './wavRenderer';
import { MusicSystemStatus, OrigoMusicSession } from './types';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'origo';
}

function recordingStepsPerBeat(engine: SimulationEngine, tempoBpm: number) {
  const pace = Math.max(0.25, Math.min(2.5, engine.simulationSpeed));
  const effectiveStepsPerSecond = WORLD_PACING.targetTickHz * pace;
  return effectiveStepsPerSecond * (60 / Math.max(30, tempoBpm));
}

export class OrigoMusicSystem {
  private director = new OrigoMusicDirector();
  private clock: OrigoMusicClock | null = null;
  private session: OrigoMusicSession | null = null;
  private recording = false;
  private lastProcessedStep = -1;
  private lastAnalysisEventCount = 0;
  private lastAnalysisBar = -1;
  private listeners = new Set<() => void>();

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }

  public start(engine: SimulationEngine) {
    const preset = engine.activePreset;
    const tempo = preset.soundPreset.tempoBpm;
    this.clock = new OrigoMusicClock(tempo, recordingStepsPerBeat(engine, tempo));
    this.director.reset();
    this.lastProcessedStep = -1;
    this.lastAnalysisEventCount = 0;
    this.lastAnalysisBar = -1;
    this.session = {
      schema: 'origo.music-session.v1',
      id: `origo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      presetId: preset.id,
      presetName: preset.name,
      tempoBpm: tempo,
      rootMidi: preset.soundPreset.rootNote,
      scaleName: preset.soundPreset.scaleName,
      scale: [...preset.soundPreset.scale],
      stepsPerBeat: this.clock.stepsPerBeat,
      beatsPerBar: this.clock.beatsPerBar,
      events: [],
      motifs: [],
    };
    this.recording = true;
    this.emit();
  }

  public stop() {
    if (this.session && !this.session.stoppedAt) this.session.stoppedAt = new Date().toISOString();
    this.refreshAnalysis(true);
    this.recording = false;
    this.emit();
  }

  public clear() {
    this.recording = false;
    this.session = null;
    this.clock = null;
    this.lastProcessedStep = -1;
    this.lastAnalysisEventCount = 0;
    this.lastAnalysisBar = -1;
    this.director.reset();
    this.emit();
  }

  public tick(engine: SimulationEngine) {
    if (!this.recording || !this.session || !this.clock) return;
    if (engine.stepCount === this.lastProcessedStep) return;
    this.lastProcessedStep = engine.stepCount;
    const events = this.director.collect(engine, this.clock);
    if (events.length) {
      this.session.events.push(...events);
      this.session.motifs = this.director.getMotifs();
      this.refreshAnalysis(false);
      this.emit();
    }
  }

  public getSession() {
    return this.session;
  }

  public getAnalysis() {
    return this.session?.analysis ?? null;
  }

  public getStatus(): MusicSystemStatus {
    const events = this.session?.events || [];
    const last = events[events.length - 1];
    return {
      recording: this.recording,
      eventCount: events.length,
      barsCaptured: last ? last.position.bar + 1 : 0,
      lastEventAtStep: last?.step ?? 0,
      motifCount: this.session?.motifs?.length ?? 0,
    };
  }

  public exportSessionJson() {
    if (!this.session) return;
    this.refreshAnalysis(true);
    const blob = new Blob([JSON.stringify(this.session, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${safeName(this.session.presetName)}-${this.session.id}.origo.json`);
  }

  public exportAetherManifest() {
    if (!this.session) return;
    this.refreshAnalysis(true);
    const manifest = buildAetherSourceManifest(this.session);
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${safeName(this.session.presetName)}-${this.session.id}.aether.json`);
  }

  public exportMidi() {
    if (!this.session || this.session.events.length === 0) return;
    const midi = sessionToMidi(this.session);
    downloadBlob(new Blob([midi], { type: 'audio/midi' }), `${safeName(this.session.presetName)}-${this.session.id}.mid`);
  }

  public async exportWav() {
    if (!this.session || this.session.events.length === 0) return;
    const wav = await renderSessionToWav(this.session);
    downloadBlob(wav, `${safeName(this.session.presetName)}-${this.session.id}.wav`);
  }

  private refreshAnalysis(force: boolean) {
    if (!this.session || this.session.events.length === 0) return;
    const events = this.session.events;
    const currentBar = events[events.length - 1].position.bar;
    const enoughNewEvents = events.length - this.lastAnalysisEventCount >= 12;
    const enteredNewBar = currentBar !== this.lastAnalysisBar;
    if (!force && !enoughNewEvents && !enteredNewBar) return;

    this.session.analysis = analyzeMusicSession(this.session);
    this.lastAnalysisEventCount = events.length;
    this.lastAnalysisBar = currentBar;
  }
}

export const origoMusicSystem = new OrigoMusicSystem();
