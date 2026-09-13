import { SimulationEngine } from '../simulation/engine';
import { WORLD_PACING } from '../simulation/worldPacing';
import { phraseGuidance } from '../models/phraseGuidance';
import { sampleInstrumentEngine } from '../audio/sampleInstrumentEngine';
import { buildAetherSourceManifest } from '../integration/aetherStreamContract';
import { OrigoMusicClock } from './musicClock';
import { OrigoMusicDirector } from './musicDirector';
import { EcologicalSectionTracker } from './ecologicalSections';
import { analyzeMusicSession } from './musicalAnalysis';
import { sessionToMidi } from './midiExporter';
import { renderSessionToWav } from './wavRenderer';
import { MusicSystemStatus, OrigoMusicSession } from './types';

export interface PreparedMusicExport { blob: Blob; filename: string; label: 'WAV' | 'MIDI' | 'Session' | 'Aether'; }
function downloadBlob(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.rel = 'noopener'; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
function safeName(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'origo'; }
function recordingStepsPerBeat(engine: SimulationEngine, tempoBpm: number) { const pace = Math.max(0.25, Math.min(2.5, engine.simulationSpeed)); const effectiveStepsPerSecond = WORLD_PACING.targetTickHz * pace; return effectiveStepsPerSecond * (60 / Math.max(30, tempoBpm)); }

export class OrigoMusicSystem {
  private director = new OrigoMusicDirector(); private sectionTracker = new EcologicalSectionTracker(); private clock: OrigoMusicClock | null = null; private session: OrigoMusicSession | null = null; private recording = false; private lastProcessedStep = -1; private lastAnalysisEventCount = 0; private lastAnalysisBar = -1; private listeners = new Set<() => void>();
  public subscribe(listener: () => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private emit() { for (const listener of this.listeners) listener(); }
  public start(engine: SimulationEngine) {
    const preset = engine.activePreset; const tempo = preset.soundPreset.tempoBpm; sampleInstrumentEngine.setTempo(tempo);
    this.clock = new OrigoMusicClock(tempo, recordingStepsPerBeat(engine, tempo), 4, 4, engine.stepCount);
    this.director.reset(); this.sectionTracker.reset(); this.lastProcessedStep = -1; this.lastAnalysisEventCount = 0; this.lastAnalysisBar = -1;
    this.session = { schema: 'origo.music-session.v1', id: `origo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString(), presetId: preset.id, presetName: preset.name, tempoBpm: tempo, rootMidi: preset.soundPreset.rootNote, scaleName: preset.soundPreset.scaleName, scale: [...preset.soundPreset.scale], stepsPerBeat: this.clock.stepsPerBeat, beatsPerBar: this.clock.beatsPerBar, events: [], motifs: [], sections: [] };
    this.recording = true; if (sampleInstrumentEngine.getStatus().aetherLoop.armed) sampleInstrumentEngine.startAetherLoop(); this.emit();
  }
  public stop() { if (this.session && !this.session.stoppedAt) this.session.stoppedAt = new Date().toISOString(); if (this.session) { const events = this.session.events; const lastBar = events.length ? events[events.length - 1].position.bar : 0; this.sectionTracker.finalize(lastBar); this.session.sections = this.sectionTracker.getSections(); } this.refreshAnalysis(true); this.recording = false; this.emit(); }
  public clear() { this.recording = false; this.session = null; this.clock = null; this.lastProcessedStep = -1; this.lastAnalysisEventCount = 0; this.lastAnalysisBar = -1; this.director.reset(); this.sectionTracker.reset(); phraseGuidance.clear(); this.emit(); }
  public tick(engine: SimulationEngine) {
    if (!this.recording || !this.session || !this.clock || engine.stepCount === this.lastProcessedStep) return; this.lastProcessedStep = engine.stepCount;
    const position = this.clock.positionForStep(engine.stepCount); const previousSectionCount = this.session.sections?.length ?? 0; const previousSectionType = this.sectionTracker.getCurrentType(); const sectionBias = this.sectionTracker.update(engine, position.bar); this.director.setSectionBias(sectionBias); this.session.sections = this.sectionTracker.getSections();
    const events = this.director.collect(engine, this.clock); if (events.length) { this.session.events.push(...events); this.session.motifs = this.director.getMotifs(); this.refreshAnalysis(false); this.emit(); return; }
    const sectionChanged = (this.session.sections?.length ?? 0) !== previousSectionCount || this.sectionTracker.getCurrentType() !== previousSectionType; if (sectionChanged) this.emit();
  }
  public getSession() { return this.session; }
  public getAnalysis() { return this.session?.analysis ?? null; }
  public getStatus(): MusicSystemStatus { const events = this.session?.events || []; const last = events[events.length - 1]; return { recording: this.recording, eventCount: events.length, barsCaptured: last ? last.position.bar + 1 : 0, lastEventAtStep: last?.step ?? 0, motifCount: this.session?.motifs?.length ?? 0, sectionCount: this.session?.sections?.length ?? 0, currentSection: this.sectionTracker.getCurrentType() ?? undefined }; }
  public prepareSessionJson(): PreparedMusicExport | null { if (!this.session) return null; this.refreshAnalysis(true); this.session.sections = this.sectionTracker.getSections(); const blob = new Blob([JSON.stringify(this.session, null, 2)], { type: 'application/json' }); return { blob, filename: `${safeName(this.session.presetName)}-${this.session.id}.origo.json`, label: 'Session' }; }
  public prepareAetherManifest(): PreparedMusicExport | null { if (!this.session) return null; this.refreshAnalysis(true); this.session.sections = this.sectionTracker.getSections(); const manifest = buildAetherSourceManifest(this.session); const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' }); return { blob, filename: `${safeName(this.session.presetName)}-${this.session.id}.aether.json`, label: 'Aether' }; }
  public prepareMidi(): PreparedMusicExport | null { if (!this.session || this.session.events.length === 0) return null; const midi = sessionToMidi(this.session); return { blob: new Blob([midi], { type: 'audio/midi' }), filename: `${safeName(this.session.presetName)}-${this.session.id}.mid`, label: 'MIDI' }; }
  public async prepareWav(): Promise<PreparedMusicExport | null> { if (!this.session || this.session.events.length === 0) return null; const wav = await renderSessionToWav(this.session); return { blob: wav, filename: `${safeName(this.session.presetName)}-${this.session.id}.wav`, label: 'WAV' }; }
  public exportSessionJson() { const artifact = this.prepareSessionJson(); if (artifact) downloadBlob(artifact.blob, artifact.filename); }
  public exportAetherManifest() { const artifact = this.prepareAetherManifest(); if (artifact) downloadBlob(artifact.blob, artifact.filename); }
  public exportMidi() { const artifact = this.prepareMidi(); if (artifact) downloadBlob(artifact.blob, artifact.filename); }
  public async exportWav() { const artifact = await this.prepareWav(); if (artifact) downloadBlob(artifact.blob, artifact.filename); }
  public async feedTakeBackAsLoop(armForNextTake = true) { if (!this.session || this.session.events.length === 0) return false; this.refreshAnalysis(true); const wav = await renderSessionToWav(this.session); const bars = Math.max(1, this.getStatus().barsCaptured || 1); await sampleInstrumentEngine.loadAetherLoopBlob(wav, `${safeName(this.session.presetName)}-${this.session.id}-aether-return.wav`, this.session.tempoBpm, bars); sampleInstrumentEngine.setTempo(this.session.tempoBpm); if (armForNextTake) sampleInstrumentEngine.armAetherLoopForNextTake(); else sampleInstrumentEngine.startAetherLoop(); return true; }
  private refreshAnalysis(force: boolean) { if (!this.session || this.session.events.length === 0) return; const events = this.session.events; const currentBar = events[events.length - 1].position.bar; const enoughNewEvents = events.length - this.lastAnalysisEventCount >= 12; const enteredNewBar = currentBar !== this.lastAnalysisBar; if (!force && !enoughNewEvents && !enteredNewBar) return; this.session.analysis = analyzeMusicSession(this.session); this.lastAnalysisEventCount = events.length; this.lastAnalysisBar = currentBar; }
}
export const origoMusicSystem = new OrigoMusicSystem();
