import { SpeciesType } from '../types';
import { OrigoMusicSession } from '../music/types';
import { PhraseModelRequest, PhraseSuggestion, MusicModelStatus, MusicModelLoadPhase } from './types';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timeout: number;
}

interface WorkerMessage {
  type?: 'progress' | 'ready' | 'generated' | 'error';
  requestId?: string;
  phase?: MusicModelLoadPhase;
  progress?: number;
  detail?: string;
  notes?: unknown[];
  error?: string;
}

class MagentaPhraseAdapter {
  private worker: Worker | null = null;
  private requestCounter = 0;
  private pending = new Map<string, PendingRequest>();
  private listeners = new Set<() => void>();
  private status: MusicModelStatus = {
    id: 'magenta-basic-rnn',
    name: 'Phrase RNN',
    capability: 'phrase-continuation',
    state: 'idle',
    error: null,
    downloadLabel: '~13 MB checkpoint',
    optional: true,
    phase: 'idle',
    progress: 0,
    detail: 'Optional model is off',
  };

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getStatus(): MusicModelStatus {
    return { ...this.status };
  }

  public async load() {
    if (this.status.state === 'ready') return;
    if (this.status.state === 'loading') return;
    this.setStatus({
      state: 'loading',
      error: null,
      phase: 'runtime',
      progress: 0.04,
      detail: 'Starting isolated browser model',
    });

    try {
      this.ensureWorker();
      await this.request('init', undefined, 150000);
      this.setStatus({
        state: 'ready',
        error: null,
        phase: 'ready',
        progress: 1,
        detail: 'Phrase model ready',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load phrase model.';
      this.disposeWorker();
      this.setStatus({
        state: 'error',
        error: message,
        phase: 'idle',
        progress: 0,
        detail: 'Model load failed',
      });
      throw error;
    }
  }

  public unload() {
    this.disposeWorker();
    this.setStatus({
      state: 'idle',
      error: null,
      phase: 'idle',
      progress: 0,
      detail: 'Optional model is off',
    });
  }

  public async generateFromSession(
    session: OrigoMusicSession,
    continuationSteps = 16,
    temperature = 1.0
  ): Promise<PhraseSuggestion> {
    if (this.status.state !== 'ready') throw new Error('Load the phrase model first.');

    const melodic = [...session.events]
      .filter((event) =>
        event.species === SpeciesType.Resonator ||
        event.species === SpeciesType.Glider
      )
      .sort((a, b) => a.position.beat - b.position.beat);

    const bySlot = new Map<number, (typeof melodic)[number]>();
    for (const event of melodic) {
      bySlot.set(Math.round(event.position.beat * 4), event);
    }
    const recent = [...bySlot.values()]
      .sort((a, b) => a.position.beat - b.position.beat)
      .slice(-12);

    if (recent.length < 3) {
      throw new Error('Record at least three Resonator/Glider melody events first.');
    }

    const firstBeat = recent[0].position.beat;
    const request: PhraseModelRequest = {
      tempoBpm: session.tempoBpm,
      continuationSteps,
      temperature,
      seedNotes: recent.map((event) => ({
        pitch: event.midiNote,
        startBeat: Math.max(0, event.position.beat - firstBeat),
        durationBeats: Math.max(0.125, event.durationBeats),
        velocity: event.velocity,
      })),
    };

    const notes = await this.request('generate', request, 60000);
    if (!Array.isArray(notes) || notes.length === 0) {
      throw new Error('The model returned no continuation notes.');
    }

    return {
      id: `suggestion_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      modelId: this.status.id,
      createdAt: new Date().toISOString(),
      seedEventCount: recent.length,
      notes,
    };
  }

  private ensureWorker() {
    if (this.worker) return;
    this.worker = new Worker(new URL('./phraseModelWorker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data || {};
      if (message.type === 'progress') {
        this.setStatus({
          state: 'loading',
          phase: message.phase ?? this.status.phase,
          progress: typeof message.progress === 'number' ? message.progress : this.status.progress,
          detail: message.detail ?? this.status.detail,
          error: null,
        });
        return;
      }

      const requestId = message.requestId;
      if (!requestId) return;
      const pending = this.pending.get(requestId);
      if (!pending) return;
      window.clearTimeout(pending.timeout);
      this.pending.delete(requestId);

      if (message.type === 'error') {
        pending.reject(new Error(message.error || 'Phrase model worker failed.'));
      } else if (message.type === 'generated') {
        pending.resolve(message.notes || []);
      } else if (message.type === 'ready') {
        pending.resolve(true);
      }
    };
    this.worker.onerror = (event) => {
      const error = new Error(event.message || 'Phrase model worker crashed.');
      for (const pending of this.pending.values()) {
        window.clearTimeout(pending.timeout);
        pending.reject(error);
      }
      this.pending.clear();
      this.setStatus({
        state: 'error',
        error: error.message,
        phase: 'idle',
        progress: 0,
        detail: 'Model worker crashed',
      });
    };
  }

  private request(type: 'init' | 'generate', request?: PhraseModelRequest, timeoutMs = 60000): Promise<any> {
    this.ensureWorker();
    const requestId = `${type}_${++this.requestCounter}_${Date.now().toString(36)}`;
    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error(type === 'init' ? 'Phrase model load timed out. Check the network and retry.' : 'Phrase generation timed out.'));
      }, timeoutMs);
      this.pending.set(requestId, { resolve, reject, timeout });
      this.worker!.postMessage({ type, requestId, request });
    });
  }

  private disposeWorker() {
    for (const pending of this.pending.values()) {
      window.clearTimeout(pending.timeout);
      pending.reject(new Error('Phrase model unloaded.'));
    }
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
  }

  private setStatus(patch: Partial<MusicModelStatus>) {
    this.status = { ...this.status, ...patch };
    for (const listener of this.listeners) listener();
  }
}

export const phraseModel = new MagentaPhraseAdapter();
