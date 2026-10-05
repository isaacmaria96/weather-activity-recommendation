import type { Forecast } from '../../domain/forecast/forecast.types.js';

export interface ForecastRepository {
  findLatest(locationId: string): Promise<Forecast | null>;
  createSnapshot(forecast: Forecast): Promise<Forecast>;
  deleteOlderThan(locationId: string, cutoff: Date): Promise<void>;
}
