import { normalizeLocationQuery } from '../../application/location/location-query.js';

const CACHE_NAMESPACE = 'weather-activity:v1';

export function normalizeSearchQuery(query: string): string {
  return normalizeLocationQuery(query);
}

export function forecastCacheKey(locationId: string): string {
  return `${CACHE_NAMESPACE}:forecast:${locationId}`;
}

export function locationSearchCacheKey(normalizedQuery: string): string {
  return `${CACHE_NAMESPACE}:location-search:${normalizedQuery}`;
}
