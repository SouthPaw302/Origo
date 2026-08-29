export const ACOUSTIC_BINS = 8;
export const ACOUSTIC_FEATURES = ACOUSTIC_BINS + 3;

export interface AcousticAction {
  frequencyControl: number;
  amplitudeControl: number;
  durationControl: number;
}

export interface AcousticPacket {
  frequencyHz: number;
  amplitude: number;
  durationSec: number;
  sourceX: number;
  sourceY: number;
}

export interface AcousticObservation {
  features: number[];
  receivedAmplitude: number;
  frequencyHz: number;
  durationSec: number;
  propagationDelaySec: number;
}

export interface AcousticNoiseSource {
  normal(): number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function actionToPacket(action: AcousticAction, sourceX = 0.2, sourceY = 0.5): AcousticPacket {
  return {
    frequencyHz: 120 + ((clamp(action.frequencyControl, -1, 1) + 1) / 2) * 1080,
    amplitude: 0.02 + ((clamp(action.amplitudeControl, -1, 1) + 1) / 2) * 0.98,
    durationSec: 0.05 + ((clamp(action.durationControl, -1, 1) + 1) / 2) * 0.45,
    sourceX,
    sourceY,
  };
}

export function receiveAcousticPacket(
  packet: AcousticPacket,
  listenerX: number,
  listenerY: number,
  noise: AcousticNoiseSource,
  enabled = true,
  noiseScale = 1,
): AcousticObservation {
  const dx = listenerX - packet.sourceX;
  const dy = listenerY - packet.sourceY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const delay = distance / 3;

  if (!enabled) {
    return {
      features: Array.from({ length: ACOUSTIC_FEATURES }, () => noise.normal() * 0.01 * noiseScale),
      receivedAmplitude: 0,
      frequencyHz: 0,
      durationSec: 0,
      propagationDelaySec: delay,
    };
  }

  const attenuation = 1 / (1 + 2.5 * distance * distance);
  const receivedAmplitude = clamp(packet.amplitude * attenuation + noise.normal() * 0.012 * noiseScale, 0, 1);
  const normalizedFrequency = clamp((packet.frequencyHz - 120) / 1080, 0, 1);
  const spectral: number[] = [];
  const width = 0.13;

  for (let i = 0; i < ACOUSTIC_BINS; i++) {
    const center = i / (ACOUSTIC_BINS - 1);
    const response = receivedAmplitude * Math.exp(-0.5 * Math.pow((normalizedFrequency - center) / width, 2));
    spectral.push(clamp(response + noise.normal() * 0.008 * noiseScale, -0.05, 1.05));
  }

  const normalizedDuration = clamp((packet.durationSec - 0.05) / 0.45 + noise.normal() * 0.008 * noiseScale, 0, 1);
  const normalizedDelay = clamp(delay + noise.normal() * 0.004 * noiseScale, 0, 1);

  return {
    features: [...spectral, receivedAmplitude, normalizedDuration, normalizedDelay],
    receivedAmplitude,
    frequencyHz: packet.frequencyHz,
    durationSec: packet.durationSec,
    propagationDelaySec: delay,
  };
}
