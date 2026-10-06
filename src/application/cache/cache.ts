import type { Forecast } from '../../domain/forecast/forecast.types.js';
import type { LocationCandidate } from '../../domain/location/location.types.js';

export interface ForecastCache {
  get(locationId: string): Promise<Forecast | null>;
  set(
    locationId: string,
    forecast: Forecast,
    ttlSeconds: number,
  ): Promise<void>;
}

export interface LocationSearchCache {
  get(query: string): Promise<LocationCandidate[] | null>;
  set(
    query: string,
    candidates: LocationCandidate[],
    ttlSeconds: number,
  ): Promise<void>;
}
