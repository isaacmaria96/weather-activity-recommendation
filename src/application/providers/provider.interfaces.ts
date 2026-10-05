import type {
  MarineForecastRequest,
  ProviderLocation,
  ProviderMarineForecast,
  ProviderWeatherForecast,
  WeatherForecastRequest,
} from './provider.types.js';

export interface LocationProvider {
  searchLocations(query: string): Promise<ProviderLocation[]>;
}

export interface WeatherProvider {
  getDailyForecast(
    request: WeatherForecastRequest,
  ): Promise<ProviderWeatherForecast>;
}

export interface MarineProvider {
  getDailyForecast(
    request: MarineForecastRequest,
  ): Promise<ProviderMarineForecast>;
}
