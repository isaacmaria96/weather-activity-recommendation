import type { AppConfig } from '../../../config/config.js';
import { FORECAST_DAYS } from '../../../config/constants.js';
import type { WeatherProvider } from '../../../application/providers/provider.interfaces.js';
import type {
  ProviderWeatherForecast,
  WeatherForecastRequest,
} from '../../../application/providers/provider.types.js';
import { mapOpenMeteoWeatherForecast } from './open-meteo.mapper.js';
import type { OpenMeteoWeatherForecastResponse } from './open-meteo.types.js';
import type { OpenMeteoClient } from './open-meteo.client.js';

const DAILY_WEATHER_FIELDS = [
  'temperature_2m_min',
  'temperature_2m_max',
  'precipitation_probability_max',
  'precipitation_sum',
  'rain_sum',
  'snowfall_sum',
  'wind_speed_10m_max',
  'weather_code',
  'sunshine_duration',
].join(',');

export class OpenMeteoWeatherProvider implements WeatherProvider {
  constructor(
    private readonly client: OpenMeteoClient,
    private readonly config: Pick<AppConfig, 'openMeteoWeatherBaseUrl'>,
  ) {}

  async getDailyForecast(
    request: WeatherForecastRequest,
  ): Promise<ProviderWeatherForecast> {
    const response = await this.client.get<OpenMeteoWeatherForecastResponse>(
      this.config.openMeteoWeatherBaseUrl,
      '/v1/forecast',
      {
        latitude: request.latitude,
        longitude: request.longitude,
        timezone: request.timezone,
        forecast_days: FORECAST_DAYS,
        daily: DAILY_WEATHER_FIELDS,
      },
    );

    return mapOpenMeteoWeatherForecast(response);
  }
}
