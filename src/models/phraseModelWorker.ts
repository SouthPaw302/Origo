import { MusicRNN, sequences } from '@magenta/music';
import type { PhraseModelRequest, PhraseSuggestionNote } from './types';

const CHECKPOINT = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn';
let model: MusicRNN | null = null;
let initializing: Promise<void> | null = null;

type WorkerRequest =
  | { type: 'init'; requestId: string }
  | { type: 'generate'; requestId: string; request: PhraseModelRequest };

function postProgress(requestId: string, phase: string, progress: number, detail: string) {
  self.postMessage({ type: 'progress', requestId, phase, progress, detail });
}

async function preflightCheckpoint(requestId: string) {
  postProgress(requestId, 'runtime', 0.12, 'Local model runtime started');
  const configResponse = await fetch(`${CHECKPOINT}/config.json`, { cache: 'force-cache' });
  if (!configResponse.ok) {
    throw new Error(`Phrase-model checkpoint is unavailable (${configResponse.status}).`);
  }
  const manifestResponse = await fetch(`${CHECKPOINT}/weights_manifest.json`, { cache: 'force-cache' });
  if (!manifestResponse.ok) {
    throw new Error(`Phrase-model weights manifest is unavailable (${manifestResponse.status}).`);
  }
  postProgress(requestId, 'checkpoint', 0.28, 'Checkpoint found · downloading about 13 MB');
}

async function initialize(requestId: string) {
  if (model) return;
  if (initializing) return initializing;

  initializing = (async () => {
    await preflightCheckpoint(requestId);
    const nextModel = new MusicRNN(CHECKPOINT);
    postProgress(requestId, 'initializing', 0.38, 'Loading model weights into the browser');
    await nextModel.initialize();
    model = nextModel;
    postProgress(requestId, 'ready', 1, 'Phrase model ready');
  })();

  try {
    await initializing;
  } finally {
    initializing = null;
  }
}

function buildSequence(request: PhraseModelRequest) {
  const secondsPerBeat = 60 / Math.max(30, Math.min(300, request.tempoBpm || 120));
  const seed = Array.isArray(request.seedNotes) ? request.seedNotes : [];
  const notes = seed.map((note) => ({
    instrument: 0,
    program: 0,
    startTime: Math.max(0, note.startBeat) * secondsPerBeat,
    endTime: Math.max(note.startBeat + 0.125, note.startBeat + note.durationBeats) * secondsPerBeat,
    pitch: Math.max(0, Math.min(127, Math.round(note.pitch))),
    velocity: Math.max(1, Math.min(127, Math.round((note.velocity || 0.7) * 127))),
    isDrum: false,
  }));
  const totalTime = notes.reduce((max, note) => Math.max(max, note.endTime), secondsPerBeat);
  return {
    ticksPerQuarter: 220,
    totalTime,
    timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
    tempos: [{ time: 0, qpm: request.tempoBpm || 120 }],
    notes,
  };
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  try {
    if (message.type === 'init') {
      await initialize(message.requestId);
      self.postMessage({ type: 'ready', requestId: message.requestId });
      return;
    }

    if (message.type === 'generate') {
      await initialize(message.requestId);
      if (!model) throw new Error('Phrase model did not initialize.');
      const sequence = buildSequence(message.request);
      if (!sequence.notes.length) throw new Error('No melody seed notes were supplied.');
      const quantized = sequences.quantizeNoteSequence(sequence, 4);
      const continuation = await model.continueSequence(
        quantized,
        Math.max(4, Math.min(64, message.request.continuationSteps || 16)),
        Math.max(0.2, Math.min(2.0, message.request.temperature || 1.0))
      );
      const notes: PhraseSuggestionNote[] = (continuation.notes || [])
        .map((note) => ({
          pitch: note.pitch ?? 60,
          step: note.quantizedStartStep || 0,
          durationSteps: Math.max(1, (note.quantizedEndStep || 1) - (note.quantizedStartStep || 0)),
        }))
        .sort((a, b) => a.step - b.step)
        .slice(0, 32);
      self.postMessage({ type: 'generated', requestId: message.requestId, notes });
      return;
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId: message.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
