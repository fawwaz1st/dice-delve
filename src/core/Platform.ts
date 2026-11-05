/** Deteksi tier perangkat untuk kualitas adaptif. */
export type DeviceTier = 'low' | 'mid' | 'high';

export interface PlatformInfo {
  tier: DeviceTier;
  isTouch: boolean;
  isCoarse: boolean;
  maxPixelRatio: number;
  prefersReducedMotion: boolean;
}

export function detectPlatform(): PlatformInfo {
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const isTouch = matchMedia('(pointer: coarse)').matches;
  const isCoarse = matchMedia('(pointer: coarse)').matches;

  let tier: DeviceTier = 'high';
  if (cores <= 4 || mem <= 4) tier = 'low';
  else if (cores <= 8 || mem <= 8) tier = 'mid';

  return {
    tier,
    isTouch,
    isCoarse,
    maxPixelRatio: tier === 'low' ? 1.5 : 2,
    prefersReducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  };
}
