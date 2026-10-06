import { expect } from 'chai';
import type { Logger } from 'pino';
import sinon from 'sinon';
import type { LocationRepository } from '../../../src/application/location/location.repository.js';
import { LocationService } from '../../../src/application/location/location.service.js';
import type { LocationProvider } from '../../../src/application/providers/provider.interfaces.js';
import type { ProviderLocation } from '../../../src/application/providers/provider.types.js';
import type { LocationSearchCache } from '../../../src/application/cache/cache.js';
import type { LocationCandidate } from '../../../src/domain/location/location.types.js';

describe('LocationService', () => {
  const providerLocation: ProviderLocation = {
    provider: 'open-meteo',
    providerLocationId: '123',
    name: 'London',
    country: 'United Kingdom',
    countryCode: 'GB',
    region: 'England',
    latitude: 51.5,
    longitude: -0.12,
    timezone: 'Europe/London',
  };

  const location: LocationCandidate = {
    id: 'loc_1',
    name: 'London',
    country: 'United Kingdom',
    countryCode: 'GB',
    region: 'England',
    latitude: 51.5,
    longitude: -0.12,
    timezone: 'Europe/London',
  };

  const providerLocationWithoutOptionalFields: ProviderLocation = {
    provider: 'open-meteo',
    providerLocationId: '456',
    name: 'London',
    country: 'Canada',
    latitude: 42.98,
    longitude: -81.24,
    timezone: 'America/Toronto',
  };

  const secondLocation: LocationCandidate = {
    id: 'loc_2',
    name: 'London',
    country: 'Canada',
    countryCode: null,
    region: null,
    latitude: 42.98,
    longitude: -81.24,
    timezone: 'America/Toronto',
  };

  afterEach(() => {
    sinon.restore();
  });

  it('returns an empty result without cache, provider, or repository calls for empty input', async () => {
    const { service, stubs } = createService();

    const result = await service.search('   ');

    expect(result).to.deep.equal([]);
    sinon.assert.notCalled(stubs.searchLocations);
    sinon.assert.notCalled(stubs.upsertCandidates);
    sinon.assert.notCalled(stubs.cacheGet);
  });

  it('returns cached candidates for a normalized query', async () => {
    const { service, stubs } = createService({
      cachedCandidates: [location],
    });

    const result = await service.search('  LONDON  ');

    expect(result).to.deep.equal([location]);
    sinon.assert.calledOnceWithExactly(stubs.cacheGet, 'london');
    sinon.assert.notCalled(stubs.searchLocations);
    sinon.assert.notCalled(stubs.upsertCandidates);
  });

  it('searches provider, upserts candidates, caches service-owned locations, and returns them on cache miss', async () => {
    const { service, stubs } = createService({
      providerLocations: [providerLocation],
      persistedLocations: [location],
    });

    const result = await service.search('London');

    expect(result).to.deep.equal([location]);
    sinon.assert.calledOnceWithExactly(stubs.searchLocations, 'london');
    sinon.assert.calledOnceWithExactly(stubs.upsertCandidates, [
      {
        provider: 'open-meteo',
        providerLocationId: '123',
        name: 'London',
        country: 'United Kingdom',
        countryCode: 'GB',
        region: 'England',
        latitude: 51.5,
        longitude: -0.12,
        timezone: 'Europe/London',
      },
    ]);
    sinon.assert.calledOnce(stubs.cacheSet);
  });

  it('preserves multiple provider candidates and maps them to repository upserts', async () => {
    const { service, stubs } = createService({
      providerLocations: [
        providerLocation,
        providerLocationWithoutOptionalFields,
      ],
      persistedLocations: [location, secondLocation],
    });

    const result = await service.search('London');

    expect(result).to.deep.equal([location, secondLocation]);
    sinon.assert.calledOnceWithExactly(stubs.upsertCandidates, [
      {
        provider: 'open-meteo',
        providerLocationId: '123',
        name: 'London',
        country: 'United Kingdom',
        countryCode: 'GB',
        region: 'England',
        latitude: 51.5,
        longitude: -0.12,
        timezone: 'Europe/London',
      },
      {
        provider: 'open-meteo',
        providerLocationId: '456',
        name: 'London',
        country: 'Canada',
        latitude: 42.98,
        longitude: -81.24,
        timezone: 'America/Toronto',
      },
    ]);
  });

  function createService(options?: {
    cachedCandidates?: LocationCandidate[] | null;
    providerLocations?: ProviderLocation[];
    persistedLocations?: LocationCandidate[];
  }) {
    const searchLocations = sinon
      .stub<[string], Promise<ProviderLocation[]>>()
      .resolves(options?.providerLocations ?? []);
    const upsertCandidates = sinon
      .stub<
        Parameters<LocationRepository['upsertCandidates']>,
        ReturnType<LocationRepository['upsertCandidates']>
      >()
      .resolves(options?.persistedLocations ?? []);
    const cacheGet = sinon
      .stub<
        Parameters<LocationSearchCache['get']>,
        ReturnType<LocationSearchCache['get']>
      >()
      .resolves(options?.cachedCandidates ?? null);
    const cacheSet = sinon
      .stub<
        Parameters<LocationSearchCache['set']>,
        ReturnType<LocationSearchCache['set']>
      >()
      .resolves();
    const provider: LocationProvider = {
      searchLocations,
    };
    const repository: LocationRepository = {
      findById: sinon.stub().resolves(null),
      upsertCandidates,
    };
    const cache: LocationSearchCache = {
      get: cacheGet,
      set: cacheSet,
    };
    const logger = {
      debug: sinon.stub(),
    } as unknown as Logger;

    return {
      service: new LocationService(provider, repository, cache, logger),
      provider,
      repository,
      cache,
      stubs: {
        searchLocations,
        upsertCandidates,
        cacheGet,
        cacheSet,
      },
    };
  }
});
