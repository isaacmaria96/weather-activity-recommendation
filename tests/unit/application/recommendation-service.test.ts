import { expect } from 'chai';
import sinon from 'sinon';
import { RecommendationService } from '../../../src/application/recommendation/recommendation.service.js';
import type { ForecastReader } from '../../../src/application/forecast/forecast.service.js';
import type { LocationRepository } from '../../../src/application/location/location.repository.js';
import type { ActivityScorer } from '../../../src/domain/activity/activity-scorer.js';
import {
  Activity,
  Availability,
  type ActivityScore,
} from '../../../src/domain/activity/activity.types.js';
import type { Forecast } from '../../../src/domain/forecast/forecast.types.js';
import type { Location } from '../../../src/domain/location/location.types.js';
import { LocationNotFoundError } from '../../../src/shared/errors/application-errors.js';

describe('RecommendationService', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('loads the location, retrieves a forecast, and ranks all supported activities', async () => {
    const locationRepository = locationRepositoryWith(location());
    const forecastService = forecastReaderWith(forecast());
    const service = new RecommendationService(
      locationRepository,
      forecastService,
      [
        scorer(Activity.SKIING, {
          '2026-10-06': available(10),
          '2026-10-07': available(90),
        }),
        scorer(Activity.SURFING, {
          '2026-10-06': unavailable(),
          '2026-10-07': available(30),
        }),
        scorer(Activity.OUTDOOR_SIGHTSEEING, {
          '2026-10-06': available(40),
          '2026-10-07': available(40),
        }),
        scorer(Activity.INDOOR_SIGHTSEEING, {
          '2026-10-06': available(70),
          '2026-10-07': available(20),
        }),
      ],
    );

    const result = await service.getRankings('loc_1');

    sinon.assert.calledOnceWithExactly(locationRepository.findById, 'loc_1');
    sinon.assert.calledOnceWithExactly(forecastService.getForecast, location());
    expect(result.location).to.deep.equal(location());
    expect(result.forecast).to.deep.equal({
      fetchedAt: '2026-10-06T10:00:00.000Z',
      stale: false,
    });
    expect(result.skiing.days.map((day) => day.date)).to.deep.equal([
      '2026-10-07',
      '2026-10-06',
    ]);
    expect(result.surfing.days).to.deep.equal([
      {
        date: '2026-10-07',
        score: 30,
        availability: Availability.AVAILABLE,
      },
      {
        date: '2026-10-06',
        score: null,
        availability: Availability.NOT_AVAILABLE,
      },
    ]);
    expect(result.outdoorSightseeing.days.map((day) => day.date)).to.deep.equal(
      ['2026-10-06', '2026-10-07'],
    );
    expect(result.indoorSightseeing.days[0]?.score).to.equal(70);
  });

  it('throws LocationNotFoundError for an unknown service-owned location id', async () => {
    const locationRepository = locationRepositoryWith(null);
    const forecastService = forecastReaderWith(forecast());
    const service = new RecommendationService(
      locationRepository,
      forecastService,
      [
        scorer(Activity.SKIING),
        scorer(Activity.SURFING),
        scorer(Activity.OUTDOOR_SIGHTSEEING),
        scorer(Activity.INDOOR_SIGHTSEEING),
      ],
    );

    let thrown: unknown;
    try {
      await service.getRankings('missing_location');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).to.be.instanceOf(LocationNotFoundError);
    sinon.assert.notCalled(forecastService.getForecast);
  });
});

type StubLocationRepository = {
  findById: sinon.SinonStub<[string], Promise<Location | null>>;
  upsertCandidates: sinon.SinonStub;
};

type StubForecastReader = {
  getForecast: sinon.SinonStub<[Location], Promise<Forecast>>;
};

function locationRepositoryWith(
  result: Location | null,
): StubLocationRepository & LocationRepository {
  return {
    findById: sinon.stub<[string], Promise<Location | null>>().resolves(result),
    upsertCandidates: sinon.stub().resolves([]),
  };
}

function forecastReaderWith(
  result: Forecast,
): StubForecastReader & ForecastReader {
  return {
    getForecast: sinon.stub<[Location], Promise<Forecast>>().resolves(result),
  };
}

function scorer(
  activity: Activity,
  scores: Record<string, ActivityScore> = {},
): ActivityScorer {
  return {
    activity,
    score(day): ActivityScore {
      return scores[day.localDate] ?? available(50);
    },
  };
}

function available(score: number): ActivityScore {
  return {
    score,
    availability: Availability.AVAILABLE,
  };
}

function unavailable(): ActivityScore {
  return {
    score: null,
    availability: Availability.NOT_AVAILABLE,
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

function forecast(): Forecast {
  return {
    snapshotId: 'snapshot_1',
    locationId: 'loc_1',
    fetchedAt: new Date('2026-10-06T10:00:00.000Z'),
    weatherAvailable: true,
    marineAvailable: true,
    days: [
      {
        localDate: '2026-10-06',
        minTemperature: 2,
        maxTemperature: 8,
        precipitationProbabilityMax: 20,
        precipitationSum: 1,
        rainSum: 0,
        snowfallSum: 3,
        maxWindSpeed: 15,
        weatherCode: 3,
        sunshineDuration: 12000,
        marine: null,
      },
      {
        localDate: '2026-10-07',
        minTemperature: 2,
        maxTemperature: 8,
        precipitationProbabilityMax: 20,
        precipitationSum: 1,
        rainSum: 0,
        snowfallSum: 3,
        maxWindSpeed: 15,
        weatherCode: 3,
        sunshineDuration: 12000,
        marine: null,
      },
    ],
  };
}
