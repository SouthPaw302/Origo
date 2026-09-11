/*
 * Optional Origo phrase-continuation worker.
 * This file intentionally loads Magenta.js only after explicit user opt-in.
 * The model never owns transport or simulation state; it returns symbolic pitch suggestions only.
 */

const MAGENTA_BUNDLE = 'https://cdn.jsdelivr.net/npm/@magenta/music@1.23.1/dist/magentamusic.js';
const CHECKPOINT = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/basic_rnn';
let model = null;
let initializing = null;

async function initialize() {
  if (model) return;
  if (initializing) return initializing;

  initializing = (async () => {
    importScripts(MAGENTA_BUNDLE);
    if (!self.mm || !self.mm.MusicRNN) {
      throw new Error('Magenta.js did not expose MusicRNN in this worker.');
    }
    model = new self.mm.MusicRNN(CHECKPOINT);
    await model.initialize();
  })();

  try {
    await initializing;
  } finally {
    initializing = null;
  }
}

function buildSequence(request) {
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

self.onmessage = async (event) => {
  const message = event.data || {};
  try {
    if (message.type === 'init') {
      await initialize();
      self.postMessage({ type: 'ready', requestId: message.requestId });
      return;
    }

    if (message.type === 'generate') {
      await initialize();
      const sequence = buildSequence(message.request || {});
      if (!sequence.notes.length) throw new Error('No melody seed notes were supplied.');
      const quantized = self.mm.sequences.quantizeNoteSequence(sequence, 4);
      const continuation = await model.continueSequence(
        quantized,
        Math.max(4, Math.min(64, message.request.continuationSteps || 16)),
        Math.max(0.2, Math.min(2.0, message.request.temperature || 1.0))
      );
      const notes = (continuation.notes || [])
        .map((note) => ({
          pitch: note.pitch,
          step: note.quantizedStartStep || 0,
          durationSteps: Math.max(1, (note.quantizedEndStep || 1) - (note.quantizedStartStep || 0)),
        }))
        .sort((a, b) => a.step - b.step)
        .slice(0, 32);
      self.postMessage({ type: 'generated', requestId: message.requestId, notes });
      return;
    }

    self.postMessage({ type: 'error', requestId: message.requestId, error: 'Unknown worker request.' });
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId: message.requestId,
      error: error && error.message ? error.message : String(error),
    });
  }
};
