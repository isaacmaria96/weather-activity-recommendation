import { randomUUID } from 'node:crypto';
import type { Location } from '../../domain/location/location.types.js';
import type { Forecast } from '../../domain/forecast/forecast.types.js';
import type {
  MarineProvider,
  WeatherProvider,
} from '../providers/provider.interfaces.js';
import type { ForecastRepository } from './forecast.repository.js';
import type { Clock } from '../../shared/time.js';
import { ProviderUnavailableError } from '../../shared/errors/application-errors.js';
import { combineProviderForecasts } from './forecast-normalizer.js';

export interface ForecastReader {
  getForecast(location: Location): Promise<Forecast>;
}

export class ForecastService implements ForecastReader {
  constructor(
    private readonly forecastRepository: ForecastRepository,
    private readonly weatherProvider: WeatherProvider,
    private readonly marineProvider: MarineProvider,
    private readonly clock: Clock,
    private readonly generateSnapshotId: () => string = randomUUID,
  ) {}

  async getForecast(location: Location): Promise<Forecast> {
    const request = {
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: location.timezone,
    };

    const weather = await this.weatherProvider.getDailyForecast(request);
    const marine = await this.getMarineForecastOrUnavailable(request);
    const forecast = combineProviderForecasts({
      locationId: location.id,
      snapshotId: this.generateSnapshotId(),
      fetchedAt: this.clock.now(),
      weather,
      marine,
    });

    return this.forecastRepository.createSnapshot(forecast);
  }

  private async getMarineForecastOrUnavailable(
    request: Parameters<MarineProvider['getDailyForecast']>[0],
  ) {
    try {
      return await this.marineProvider.getDailyForecast(request);
    } catch (error) {
      if (error instanceof ProviderUnavailableError) {
        return {
          marineAvailable: false,
          days: [],
        };
      }

      throw error;
    }
  }
}
