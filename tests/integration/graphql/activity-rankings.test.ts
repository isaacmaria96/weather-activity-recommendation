import { ApolloServer } from '@apollo/server';
import { expect } from 'chai';
import sinon from 'sinon';
import { ForecastService } from '../../../src/application/forecast/forecast.service.js';
import type { ForecastRepository } from '../../../src/application/forecast/forecast.repository.js';
import type { LocationSearchService } from '../../../src/application/location/location.service.js';
import { RecommendationService } from '../../../src/application/recommendation/recommendation.service.js';
import type {
  MarineProvider,
  WeatherProvider,
} from '../../../src/application/providers/provider.interfaces.js';
import type {
  ProviderMarineForecast,
  ProviderWeatherForecast,
} from '../../../src/application/providers/provider.types.js';
import { SkiingScorer } from '../../../src/domain/activity/skiing.scorer.js';
import { SurfingScorer } from '../../../src/domain/activity/surfing.scorer.js';
import { OutdoorSightseeingScorer } from '../../../src/domain/activity/outdoor-sightseeing.scorer.js';
import { IndoorSightseeingScorer } from '../../../src/domain/activity/indoor-sightseeing.scorer.js';
import type { Forecast } from '../../../src/domain/forecast/forecast.types.js';
import type { Location } from '../../../src/domain/location/location.types.js';
import { ProviderUnavailableError } from '../../../src/shared/errors/application-errors.js';
import { createResolvers } from '../../../src/presentation/graphql/resolvers.js';
import { typeDefs } from '../../../src/presentation/graphql/schema.js';

describe('GraphQL activityRankings', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('returns ranked activity recommendations for a known location id', async () => {
    const forecastRepository = repositoryThatReturnsInput();
    const server = createServer({
      locationResult: location(),
      forecastRepository,
      weatherProvider: weatherProviderWith(weatherForecast()),
      marineProvider: marineProviderWith(marineForecast()),
    });

    const response = await server.executeOperation({
      query: rankingQuery(),
      variables: { locationId: 'loc_1' },
    });

    expect(response.body.kind).to.equal('single');
    if (response.body.kind !== 'single') {
      throw new Error('Expected single GraphQL response');
    }
    expect(response.body.singleResult.errors).to.equal(undefined);
    const rankings = response.body.singleResult.data?.activityRankings as
      | ActivityRankingsGraphQL
      | undefined;
    expect(rankings).to.deep.include({
      forecast: {
        fetchedAt: '2026-10-06T10:00:00.000Z',
        stale: false,
      },
    });
    expect(rankings?.location).to.deep.equal({
      id: 'loc_1',
      name: 'London',
      country: 'United Kingdom',
      region: 'England',
      latitude: 51.5,
      longitude: -0.12,
      timezone: 'Europe/London',
    });
    expect(rankings?.skiing.days).to.have.length(7);
    expect(rankings?.surfing.days).to.have.length(7);
    expect(rankings?.outdoorSightseeing.days).to.have.length(7);
    expect(rankings?.indoorSightseeing.days).to.have.length(7);
    sinon.assert.calledOnce(forecastRepository.createSnapshot);
  });

  it('maps unknown location ids to LOCATION_NOT_FOUND', async () => {
    const server = createServer({
      locationResult: null,
      forecastRepository: repositoryThatReturnsInput(),
      weatherProvider: weatherProviderWith(weatherForecast()),
      marineProvider: marineProviderWith(marineForecast()),
    });

    const response = await server.executeOperation({
      query: rankingQuery(),
      variables: { locationId: 'missing_location' },
    });

    expect(response.body.kind).to.equal('single');
    if (response.body.kind !== 'single') {
      throw new Error('Expected single GraphQL response');
    }
    expect(response.body.singleResult.errors?.[0]?.extensions?.code).to.equal(
      'LOCATION_NOT_FOUND',
    );
  });

  it('maps weather provider failures to UPSTREAM_UNAVAILABLE', async () => {
    const weatherProvider: WeatherProvider = {
      getDailyForecast: sinon
        .stub()
        .rejects(new ProviderUnavailableError('Weather unavailable')),
    };
    const server = createServer({
      locationResult: location(),
      forecastRepository: repositoryThatReturnsInput(),
      weatherProvider,
      marineProvider: marineProviderWith(marineForecast()),
    });

    const response = await server.executeOperation({
      query: rankingQuery(),
      variables: { locationId: 'loc_1' },
    });

    expect(response.body.kind).to.equal('single');
    if (response.body.kind !== 'single') {
      throw new Error('Expected single GraphQL response');
    }
    expect(response.body.singleResult.errors?.[0]?.extensions?.code).to.equal(
      'UPSTREAM_UNAVAILABLE',
    );
  });
});

type StubForecastRepository = {
  findLatest: sinon.SinonStub<[string], Promise<Forecast | null>>;
  createSnapshot: sinon.SinonStub<[Forecast], Promise<Forecast>>;
  deleteOlderThan: sinon.SinonStub<[string, Date], Promise<void>>;
};

type ActivityRankingsGraphQL = {
  location: {
    id: string;
    name: string;
    country: string;
    region: string;
    latitude: number;
    longitude: number;
    timezone: string;
  };
  forecast: {
    fetchedAt: string;
    stale: boolean;
  };
  skiing: {
    days: unknown[];
  };
  surfing: {
    days: unknown[];
  };
  outdoorSightseeing: {
    days: unknown[];
  };
  indoorSightseeing: {
    days: unknown[];
  };
};

function createServer({
  locationResult,
  forecastRepository,
  weatherProvider,
  marineProvider,
}: {
  locationResult: Location | null;
  forecastRepository: ForecastRepository;
  weatherProvider: WeatherProvider;
  marineProvider: MarineProvider;
}): ApolloServer {
  const locationRepository = {
    findById: sinon
      .stub<[string], Promise<Location | null>>()
      .resolves(locationResult),
    upsertCandidates: sinon.stub().resolves([]),
  };
  const forecastService = new ForecastService(
    forecastRepository,
    weatherProvider,
    marineProvider,
    { now: () => new Date('2026-10-06T10:00:00.000Z') },
    () => 'snapshot_1',
  );
  const recommendationService = new RecommendationService(
    locationRepository,
    forecastService,
    [
      new SkiingScorer(),
      new SurfingScorer(),
      new OutdoorSightseeingScorer(),
      new IndoorSightseeingScorer(),
    ],
  );
  const locationService: LocationSearchService = {
    search: sinon.stub().resolves([]),
  };

  return new ApolloServer({
    typeDefs,
    resolvers: createResolvers({ locationService, recommendationService }),
  });
}

function repositoryThatReturnsInput(): StubForecastRepository {
  return {
    findLatest: sinon.stub<[string], Promise<Forecast | null>>().resolves(null),
    createSnapshot: sinon
      .stub<[Forecast], Promise<Forecast>>()
      .callsFake((forecast) => Promise.resolve(forecast)),
    deleteOlderThan: sinon.stub<[string, Date], Promise<void>>().resolves(),
  };
}

function weatherProviderWith(
  forecast: ProviderWeatherForecast,
): WeatherProvider {
  return {
    getDailyForecast: sinon
      .stub<
        Parameters<WeatherProvider['getDailyForecast']>,
        ReturnType<WeatherProvider['getDailyForecast']>
      >()
      .resolves(forecast),
  };
}

function marineProviderWith(forecast: ProviderMarineForecast): MarineProvider {
  return {
    getDailyForecast: sinon
      .stub<
        Parameters<MarineProvider['getDailyForecast']>,
        ReturnType<MarineProvider['getDailyForecast']>
      >()
      .resolves(forecast),
  };
}

function rankingQuery(): string {
  return `#graphql
    query Rankings($locationId: ID!) {
      activityRankings(locationId: $locationId) {
        location {
          id
          name
          country
          region
          latitude
          longitude
          timezone
        }
        forecast {
          fetchedAt
          stale
        }
        skiing {
          days {
            date
            score
            availability
          }
        }
        surfing {
          days {
            date
            score
            availability
          }
        }
        outdoorSightseeing {
          days {
            date
            score
            availability
          }
        }
        indoorSightseeing {
          days {
            date
            score
            availability
          }
        }
      }
    }
  `;
}

function weatherForecast(): ProviderWeatherForecast {
  return {
    weatherAvailable: true,
    days: Array.from({ length: 7 }, (_value, index) => ({
      localDate: `2026-10-${String(index + 6).padStart(2, '0')}`,
      minTemperature: -6,
      maxTemperature: -4,
      precipitationProbabilityMax: 10,
      precipitationSum: 0,
      rainSum: 0,
      snowfallSum: 12,
      maxWindSpeed: 10,
      weatherCode: 3,
      sunshineDuration: 8 * 60 * 60,
    })),
  };
}

function marineForecast(): ProviderMarineForecast {
  return {
    marineAvailable: true,
    days: Array.from({ length: 7 }, (_value, index) => ({
      localDate: `2026-10-${String(index + 6).padStart(2, '0')}`,
      marine: {
        maxWaveHeight: 1.5,
        maxWavePeriod: 10,
        maxWindWaveHeight: 0.5,
        maxSwellHeight: 1.5,
        maxSwellPeriod: 8,
      },
    })),
  };
}

function location(): Location {
  return {
    id: 'loc_1',
    name: 'London',
    country: 'United Kingdom',
    countryCode: 'GB',
    region: 'England',
    latitude: 51.5,
    longitude: -0.12,
    timezone: 'Europe/London',
  };
}
