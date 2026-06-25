export class CastCustomiser {
  customise(castSize: number, venueCapacity: number) {
    const ratio = castSize / Math.max(venueCapacity / 50, 1);
    return {
      castSize,
      venueCapacity,
      recommendation: ratio > 1.5 ? 'Consider double-casting for ensemble' : 'Cast size appropriate for venue',
      adjustments: castSize > 12 ? ['Combine minor roles', 'Use recorded voice for crowd scenes'] : ['Full cast as written'],
      generatedAt: new Date().toISOString(),
    };
  }
}

export const castCustomiser = new CastCustomiser();
