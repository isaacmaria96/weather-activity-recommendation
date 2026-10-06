export const SKIING_WEIGHTS = {
  snowfall: 0.4,
  temperature: 0.3,
  wind: 0.2,
  rainSeverity: 0.1,
} as const;

export const SURFING_WEIGHTS = {
  waveHeight: 0.4,
  wavePeriod: 0.3,
  swellStructure: 0.15,
  wind: 0.15,
} as const;

export const OUTDOOR_SIGHTSEEING_WEIGHTS = {
  precipitation: 0.35,
  temperature: 0.3,
  wind: 0.2,
  sunshineSeverity: 0.15,
} as const;

export const INDOOR_SIGHTSEEING_WEIGHTS = {
  precipitation: 0.4,
  temperature: 0.25,
  wind: 0.2,
  severity: 0.15,
} as const;
