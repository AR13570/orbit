const TAU = Math.PI * 2;

export interface WaveSample {
  crest: number;
  slope: number;
}

/** Write into a reused sample so a dense surface needs no point allocations. */
export function sampleGravityWave(
  fromEdge: number,
  radius: number,
  activeTime: number,
  repels: boolean,
  sample: WaveSample,
): void {
  const wavelength = 32 + radius * 0.34;
  const phase =
    TAU * (fromEdge / wavelength + ((repels ? -1 : 1) * activeTime) / 2.7);
  sample.crest = (1 + Math.cos(phase)) * 0.5;
  sample.slope = -Math.sin(phase) * sample.crest;
}
