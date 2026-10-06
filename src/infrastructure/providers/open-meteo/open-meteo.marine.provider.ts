import type { AppConfig } from '../../../config/config.js';
import { FORECAST_DAYS } from '../../../config/constants.js';
import type { MarineProvider } from '../../../application/providers/provider.interfaces.js';
import type {
  MarineForecastRequest,
  ProviderMarineForecast,
} from '../../../application/providers/provider.types.js';
import { mapOpenMeteoMarineForecast } from './open-meteo.mapper.js';
import type { OpenMeteoClient } from './open-meteo.client.js';
import type { OpenMeteoMarineForecastResponse } from './open-meteo.types.js';

const DAILY_MARINE_FIELDS = [
  'wave_height_max',
  'wave_period_max',
  'wind_wave_height_max',
  'swell_wave_height_max',
  'swell_wave_period_max',
].join(',');

export class OpenMeteoMarineProvider implements MarineProvider {
  constructor(
    private readonly client: OpenMeteoClient,
    private readonly config: Pick<AppConfig, 'openMeteoMarineBaseUrl'>,
  ) {}

  async getDailyForecast(
    request: MarineForecastRequest,
  ): Promise<ProviderMarineForecast> {
    const response = await this.client.get<OpenMeteoMarineForecastResponse>(
      this.config.openMeteoMarineBaseUrl,
      '/v1/marine',
      {
        latitude: request.latitude,
        longitude: request.longitude,
        timezone: request.timezone,
        forecast_days: FORECAST_DAYS,
        daily: DAILY_MARINE_FIELDS,
      },
    );

    return mapOpenMeteoMarineForecast(response);
  }
}
