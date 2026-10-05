const CACHE_NAMESPACE = 'weather-activity:v1';

export function normalizeSearchQuery(query: string): string {
  return query.trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
}

export function forecastCacheKey(locationId: string): string {
  return `${CACHE_NAMESPACE}:forecast:${locationId}`;
}

export function locationSearchCacheKey(normalizedQuery: string): string {
  return `${CACHE_NAMESPACE}:location-search:${normalizedQuery}`;
}
