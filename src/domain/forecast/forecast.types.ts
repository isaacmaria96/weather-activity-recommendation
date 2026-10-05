export type MarineConditions = {
  maxWaveHeight: number | null;
  maxWavePeriod: number | null;
  maxWindWaveHeight: number | null;
  maxSwellHeight: number | null;
  maxSwellPeriod: number | null;
};

export type ForecastDay = {
  localDate: string;
  minTemperature: number | null;
  maxTemperature: number | null;
  precipitationProbabilityMax: number | null;
  precipitationSum: number | null;
  rainSum: number | null;
  snowfallSum: number | null;
  maxWindSpeed: number | null;
  weatherCode: number | null;
  sunshineDuration: number | null;
  marine: MarineConditions | null;
};

export type Forecast = {
  snapshotId: string;
  locationId: string;
  fetchedAt: Date;
  weatherAvailable: boolean;
  marineAvailable: boolean;
  days: ForecastDay[];
};
