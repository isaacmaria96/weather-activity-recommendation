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

export type ProviderWeatherForecast = {
  days: unknown[];
};

export type ProviderMarineForecast = {
  days: unknown[];
};
