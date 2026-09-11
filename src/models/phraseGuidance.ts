import { ModelGuidanceRef, PhraseSuggestion } from './types';

function mod12(value: number) {
  return ((value % 12) + 12) % 12;
}

function nearestPitchClass(sourceMidi: number, targetPitchClass: number) {
  const current = mod12(sourceMidi);
  let delta = mod12(targetPitchClass - current);
  if (delta > 6) delta -= 12;
  return Math.max(24, Math.min(108, sourceMidi + delta));
}

class PhraseGuidance {
  private suggestion: PhraseSuggestion | null = null;
  private cursor = 0;
  private remainingEvents = 0;

  public activate(suggestion: PhraseSuggestion) {
    this.suggestion = suggestion;
    this.cursor = 0;
    this.remainingEvents = Math.max(1, suggestion.notes.length);
  }

  public clear() {
    this.suggestion = null;
    this.cursor = 0;
    this.remainingEvents = 0;
  }

  public isActive() {
    return Boolean(this.suggestion && this.remainingEvents > 0);
  }

  public getActiveSuggestion() {
    return this.suggestion;
  }

  public shapePitch(proposedMidi: number): { midiNote: number; model?: ModelGuidanceRef } {
    if (!this.suggestion || this.remainingEvents <= 0 || this.suggestion.notes.length === 0) {
      return { midiNote: proposedMidi };
    }

    const note = this.suggestion.notes[this.cursor % this.suggestion.notes.length];
    const midiNote = nearestPitchClass(proposedMidi, mod12(note.pitch));
    const model: ModelGuidanceRef = {
      modelId: this.suggestion.modelId,
      suggestionId: this.suggestion.id,
      guided: true,
    };

    this.cursor++;
    this.remainingEvents--;
    if (this.remainingEvents <= 0) {
      this.suggestion = null;
      this.cursor = 0;
    }

    return { midiNote, model };
  }
}

export const phraseGuidance = new PhraseGuidance();
