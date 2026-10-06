import type {
  ForecastDay,
  MarineConditions,
} from '../../domain/forecast/forecast.types.js';

export type ProviderLocation = {
  provider: string;
  providerLocationId: string;
  name: string;
  country: string;
  countryCode?: string;
  region?: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export type WeatherForecastRequest = {
  latitude: number;
  longitude: number;
  timezone: string;
};

export type MarineForecastRequest = WeatherForecastRequest;

export type ProviderWeatherForecastDay = Omit<ForecastDay, 'marine'>;

export type ProviderMarineForecast = {
  marineAvailable: boolean;
  days: ProviderMarineForecastDay[];
};

export type ProviderMarineForecastDay = {
  localDate: string;
  marine: MarineConditions | null;
};

export type ProviderWeatherForecast = {
  weatherAvailable: true;
  days: ProviderWeatherForecastDay[];
};
