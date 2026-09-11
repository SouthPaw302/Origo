export class OrigoMusicClock {
  public readonly tempoBpm: number;
  public readonly stepsPerBeat: number;
  public readonly beatsPerBar: number;
  public readonly subdivisionsPerBeat: number;

  constructor(
    tempoBpm: number,
    stepsPerBeat: number = 24,
    beatsPerBar: number = 4,
    subdivisionsPerBeat: number = 4
  ) {
    this.tempoBpm = Math.max(30, Math.min(240, tempoBpm));
    this.stepsPerBeat = Math.max(1, Math.floor(stepsPerBeat));
    this.beatsPerBar = Math.max(1, Math.floor(beatsPerBar));
    this.subdivisionsPerBeat = Math.max(1, Math.floor(subdivisionsPerBeat));
  }

  public quantizedStep(step: number): number {
    const quantum = this.stepsPerBeat / this.subdivisionsPerBeat;
    return Math.round(step / quantum) * quantum;
  }

  public positionForStep(step: number) {
    const quantized = this.quantizedStep(step);
    const beat = quantized / this.stepsPerBeat;
    const bar = Math.floor(beat / this.beatsPerBar);
    const beatInBar = beat - bar * this.beatsPerBar;
    const subdivision = Math.round((beatInBar % 1) * this.subdivisionsPerBeat);
    const seconds = beat * (60 / this.tempoBpm);
    return { beat, bar, beatInBar, subdivision, seconds };
  }
}
