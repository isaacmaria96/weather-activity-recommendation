import type { Logger } from 'pino';
import type { LocationSearchCache } from '../cache/cache.js';
import { LOCATION_SEARCH_CACHE_TTL_SECONDS } from '../../config/constants.js';
import type { LocationCandidate } from '../../domain/location/location.types.js';
import type { LocationProvider } from '../providers/provider.interfaces.js';
import type { ProviderLocation } from '../providers/provider.types.js';
import type {
  LocationRepository,
  LocationUpsert,
} from './location.repository.js';
import {
  normalizeLocationQuery,
  validateLocationQuery,
} from './location-query.js';

export interface LocationSearchService {
  search(query: string): Promise<LocationCandidate[]>;
}

export class LocationService implements LocationSearchService {
  constructor(
    private readonly locationProvider: LocationProvider,
    private readonly locationRepository: LocationRepository,
    private readonly locationSearchCache: LocationSearchCache,
    private readonly logger: Logger,
  ) {}

  async search(query: string): Promise<LocationCandidate[]> {
    const normalizedQuery = normalizeLocationQuery(query);

    if (normalizedQuery.length === 0) {
      return [];
    }

    validateLocationQuery(normalizedQuery);

    const cachedCandidates =
      await this.locationSearchCache.get(normalizedQuery);

    if (cachedCandidates !== null) {
      this.logger.debug({ normalizedQuery }, 'Location search cache hit');
      return cachedCandidates;
    }

    this.logger.debug({ normalizedQuery }, 'Location search cache miss');

    const providerLocations =
      await this.locationProvider.searchLocations(normalizedQuery);
    const upserts = providerLocations.map(mapProviderLocationToUpsert);
    const candidates = await this.locationRepository.upsertCandidates(upserts);

    await this.locationSearchCache.set(
      normalizedQuery,
      candidates,
      LOCATION_SEARCH_CACHE_TTL_SECONDS,
    );

    return candidates;
  }
}

function mapProviderLocationToUpsert(
  location: ProviderLocation,
): LocationUpsert {
  return {
    provider: location.provider,
    providerLocationId: location.providerLocationId,
    name: location.name,
    country: location.country,
    ...(location.countryCode === undefined
      ? {}
      : { countryCode: location.countryCode }),
    ...(location.region === undefined ? {} : { region: location.region }),
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: location.timezone,
  };
}
