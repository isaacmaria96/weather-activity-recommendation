import { expect } from 'chai';
import sinon from 'sinon';
import { ForecastService } from '../../../src/application/forecast/forecast.service.js';
import type {
  MarineProvider,
  WeatherProvider,
} from '../../../src/application/providers/provider.interfaces.js';
import type {
  ProviderMarineForecast,
  ProviderWeatherForecast,
} from '../../../src/application/providers/provider.types.js';
import type { Forecast } from '../../../src/domain/forecast/forecast.types.js';
import type { Location } from '../../../src/domain/location/location.types.js';
import {
  PersistenceError,
  ProviderUnavailableError,
} from '../../../src/shared/errors/application-errors.js';
import type { Clock } from '../../../src/shared/time.js';

describe('ForecastService', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('fetches provider forecasts, normalizes them, and persists a snapshot', async () => {
    const fetchedAt = new Date('2026-10-06T10:00:00.000Z');
    const weather = weatherForecast();
    const marine = marineForecast();
    const repository = repositoryThatReturnsInput();
    const weatherProvider = weatherProviderWith(weather);
    const marineProvider = marineProviderWith(marine);
    const service = new ForecastService(
      repository,
      weatherProvider,
      marineProvider,
      clock(fetchedAt),
      () => 'snapshot_1',
    );

    const result = await service.getForecast(location());

    const request = {
      latitude: 51.5,
      longitude: -0.12,
      timezone: 'Europe/London',
    };
    sinon.assert.calledOnceWithExactly(
      weatherProvider.getDailyForecast,
      request,
    );
    sinon.assert.calledOnceWithExactly(
      marineProvider.getDailyForecast,
      request,
    );
    sinon.assert.calledOnce(repository.createSnapshot);
    const persisted = repository.createSnapshot.firstCall.firstArg as Forecast;
    expect(persisted.snapshotId).to.equal('snapshot_1');
    expect(persisted.locationId).to.equal('loc_1');
    expect(persisted.fetchedAt).to.equal(fetchedAt);
    expect(persisted.weatherAvailable).to.equal(true);
    expect(persisted.marineAvailable).to.equal(true);
    expect(persisted.days[0]?.marine).to.deep.equal({
      maxWaveHeight: 1.5,
      maxWavePeriod: 10,
      maxWindWaveHeight: 0.5,
      maxSwellHeight: 1.5,
      maxSwellPeriod: 8,
    });
    expect(result).to.equal(persisted);
  });

  it('treats marine provider unavailability as missing marine data', async () => {
    const repository = repositoryThatReturnsInput();
    const weatherProvider = weatherProviderWith(weatherForecast());
    const marineProvider: MarineProvider = {
      getDailyForecast: sinon
        .stub()
        .rejects(new ProviderUnavailableError('Marine unavailable')),
    };
    const service = new ForecastService(
      repository,
      weatherProvider,
      marineProvider,
      clock(),
      () => 'snapshot_1',
    );

    const result = await service.getForecast(location());

    expect(result.marineAvailable).to.equal(false);
    expect(result.days.every((day) => day.marine === null)).to.equal(true);
    sinon.assert.calledOnce(repository.createSnapshot);
  });

  it('propagates weather provider failures and does not persist a snapshot', async () => {
    const repository = repositoryThatReturnsInput();
    const weatherProvider: WeatherProvider = {
      getDailyForecast: sinon
        .stub()
        .rejects(new ProviderUnavailableError('Weather unavailable')),
    };
    const marineProvider = marineProviderWith(marineForecast());
    const service = new ForecastService(
      repository,
      weatherProvider,
      marineProvider,
      clock(),
      () => 'snapshot_1',
    );

    let thrown: unknown;
    try {
      await service.getForecast(location());
    } catch (error) {
      thrown = error;
    }

    expect(thrown).to.be.instanceOf(ProviderUnavailableError);
    sinon.assert.notCalled(repository.createSnapshot);
  });

  it('propagates snapshot persistence failures', async () => {
    const repository: StubForecastRepository = {
      findLatest: sinon
        .stub<[string], Promise<Forecast | null>>()
        .resolves(null),
      createSnapshot: sinon
        .stub<[Forecast], Promise<Forecast>>()
        .rejects(new PersistenceError('Persist failed')),
      deleteOlderThan: sinon.stub<[string, Date], Promise<void>>().resolves(),
    };
    const service = new ForecastService(
      repository,
      weatherProviderWith(weatherForecast()),
      marineProviderWith(marineForecast()),
      clock(),
      () => 'snapshot_1',
    );

    let thrown: unknown;
    try {
      await service.getForecast(location());
    } catch (error) {
      thrown = error;
    }

    expect(thrown).to.be.instanceOf(PersistenceError);
  });
});

type StubForecastRepository = {
  findLatest: sinon.SinonStub<[string], Promise<Forecast | null>>;
  createSnapshot: sinon.SinonStub<[Forecast], Promise<Forecast>>;
  deleteOlderThan: sinon.SinonStub<[string, Date], Promise<void>>;
};

function repositoryThatReturnsInput(): StubForecastRepository {
  return {
    findLatest: sinon.stub<[string], Promise<Forecast | null>>().resolves(null),
    createSnapshot: sinon
      .stub<[Forecast], Promise<Forecast>>()
      .callsFake((forecast) => Promise.resolve(forecast)),
    deleteOlderThan: sinon.stub<[string, Date], Promise<void>>().resolves(),
  };
}

type StubWeatherProvider = {
  getDailyForecast: sinon.SinonStub<
    Parameters<WeatherProvider['getDailyForecast']>,
    ReturnType<WeatherProvider['getDailyForecast']>
  >;
};

type StubMarineProvider = {
  getDailyForecast: sinon.SinonStub<
    Parameters<MarineProvider['getDailyForecast']>,
    ReturnType<MarineProvider['getDailyForecast']>
  >;
};

function weatherProviderWith(
  forecast: ProviderWeatherForecast,
): WeatherProvider & StubWeatherProvider {
  return {
    getDailyForecast: sinon
      .stub<
        Parameters<WeatherProvider['getDailyForecast']>,
        ReturnType<WeatherProvider['getDailyForecast']>
      >()
      .resolves(forecast),
  };
}

function marineProviderWith(
  forecast: ProviderMarineForecast,
): MarineProvider & StubMarineProvider {
  return {
    getDailyForecast: sinon
      .stub<
        Parameters<MarineProvider['getDailyForecast']>,
        ReturnType<MarineProvider['getDailyForecast']>
      >()
      .resolves(forecast),
  };
}

function weatherForecast(): ProviderWeatherForecast {
  return {
    weatherAvailable: true,
    days: Array.from({ length: 7 }, (_value, index) => ({
      localDate: `2026-10-${String(index + 6).padStart(2, '0')}`,
      minTemperature: 2,
      maxTemperature: 8,
      precipitationProbabilityMax: 20,
      precipitationSum: 1,
      rainSum: 0,
      snowfallSum: 3,
      maxWindSpeed: 15,
      weatherCode: 3,
      sunshineDuration: 12000,
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

function clock(now: Date = new Date('2026-10-06T10:00:00.000Z')): Clock {
  return {
    now: () => now,
  };
}
