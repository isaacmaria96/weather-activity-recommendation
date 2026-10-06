import type { PrismaClient } from '@prisma/client';
import { expect } from 'chai';
import sinon from 'sinon';
import { PrismaForecastRepository } from '../../../src/infrastructure/database/repositories/prisma.forecast.repository.js';
import type { Forecast } from '../../../src/domain/forecast/forecast.types.js';
import { PersistenceError } from '../../../src/shared/errors/application-errors.js';

describe('PrismaForecastRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('persists a new immutable snapshot with forecast days for a location', async () => {
    const snapshot = dbSnapshot({
      id: 'snapshot_1',
      locationId: 'loc_1',
      days: [
        dbDay({
          snapshotId: 'snapshot_1',
          localDate: new Date('2026-10-06T00:00:00.000Z'),
          maxWaveHeight: 1.4,
          maxWavePeriod: 9,
          maxWindWaveHeight: 0.4,
          maxSwellHeight: 1.2,
          maxSwellPeriod: 8,
        }),
      ],
    });
    const create = sinon.stub().resolves(snapshot);
    const repository = new PrismaForecastRepository(
      prisma({ forecastSnapshot: { create } }),
    );

    const result = await repository.createSnapshot(
      forecast({
        snapshotId: 'snapshot_1',
        locationId: 'loc_1',
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
            marine: {
              maxWaveHeight: 1.4,
              maxWavePeriod: 9,
              maxWindWaveHeight: 0.4,
              maxSwellHeight: 1.2,
              maxSwellPeriod: 8,
            },
          },
        ],
      }),
    );

    sinon.assert.calledOnce(create);
    const createArgs = create.firstCall.firstArg as CreateSnapshotArgs;
    expect(createArgs.data.id).to.equal('snapshot_1');
    expect(createArgs.data.locationId).to.equal('loc_1');
    expect(createArgs.data.days.create).to.deep.equal([
      {
        localDate: new Date('2026-10-06T00:00:00.000Z'),
        minTemperature: 2,
        maxTemperature: 8,
        precipitationProbabilityMax: 20,
        precipitationSum: 1,
        rainSum: 0,
        snowfallSum: 3,
        maxWindSpeed: 15,
        weatherCode: 3,
        sunshineDuration: 12000,
        maxWaveHeight: 1.4,
        maxWavePeriod: 9,
        maxWindWaveHeight: 0.4,
        maxSwellHeight: 1.2,
        maxSwellPeriod: 8,
      },
    ]);
    expect(result).to.deep.equal({
      snapshotId: 'snapshot_1',
      locationId: 'loc_1',
      fetchedAt: snapshot.fetchedAt,
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
          marine: {
            maxWaveHeight: 1.4,
            maxWavePeriod: 9,
            maxWindWaveHeight: 0.4,
            maxSwellHeight: 1.2,
            maxSwellPeriod: 8,
          },
        },
      ],
    });
  });

  it('loads and maps the latest snapshot ordered by forecast date', async () => {
    const findFirst = sinon.stub().resolves(
      dbSnapshot({
        id: 'snapshot_latest',
        locationId: 'loc_1',
        days: [
          dbDay({
            snapshotId: 'snapshot_latest',
            localDate: new Date('2026-10-07T00:00:00.000Z'),
            maxWaveHeight: null,
          }),
        ],
      }),
    );
    const repository = new PrismaForecastRepository(
      prisma({ forecastSnapshot: { findFirst } }),
    );

    const result = await repository.findLatest('loc_1');

    sinon.assert.calledOnceWithExactly(findFirst, {
      where: { locationId: 'loc_1' },
      orderBy: { fetchedAt: 'desc' },
      include: {
        days: {
          orderBy: { localDate: 'asc' },
        },
      },
    });
    expect(result?.snapshotId).to.equal('snapshot_latest');
    expect(result?.locationId).to.equal('loc_1');
    expect(result?.days[0]?.localDate).to.equal('2026-10-07');
  });

  it('creates a new snapshot on every persist call instead of updating an existing one', async () => {
    const create = sinon
      .stub()
      .onFirstCall()
      .resolves(dbSnapshot({ id: 'snapshot_1', locationId: 'loc_1' }))
      .onSecondCall()
      .resolves(dbSnapshot({ id: 'snapshot_2', locationId: 'loc_1' }));
    const update = sinon.stub();
    const repository = new PrismaForecastRepository(
      prisma({ forecastSnapshot: { create, update } }),
    );

    await repository.createSnapshot(
      forecast({ snapshotId: 'snapshot_1', locationId: 'loc_1' }),
    );
    await repository.createSnapshot(
      forecast({ snapshotId: 'snapshot_2', locationId: 'loc_1' }),
    );

    sinon.assert.calledTwice(create);
    sinon.assert.notCalled(update);
    expect((create.firstCall.firstArg as CreateSnapshotArgs).data.id).to.equal(
      'snapshot_1',
    );
    expect((create.secondCall.firstArg as CreateSnapshotArgs).data.id).to.equal(
      'snapshot_2',
    );
  });

  it('translates persistence failures to application errors', async () => {
    const create = sinon.stub().rejects(new Error('database unavailable'));
    const repository = new PrismaForecastRepository(
      prisma({ forecastSnapshot: { create } }),
    );

    let thrown: unknown;
    try {
      await repository.createSnapshot(forecast());
    } catch (error) {
      thrown = error;
    }

    expect(thrown).to.be.instanceOf(PersistenceError);
  });
});

type CreateSnapshotArgs = {
  data: {
    id: string;
    locationId: string;
    fetchedAt: Date;
    weatherAvailable: boolean;
    marineAvailable: boolean;
    days: {
      create: DbForecastDayCreate[];
    };
  };
  include: {
    days: {
      orderBy: {
        localDate: 'asc';
      };
    };
  };
};

type DbForecastDayCreate = Omit<DbForecastDay, 'id' | 'snapshotId'>;

type DbForecastSnapshot = {
  id: string;
  locationId: string;
  fetchedAt: Date;
  weatherAvailable: boolean;
  marineAvailable: boolean;
  days: DbForecastDay[];
};

type DbForecastDay = {
  id: string;
  snapshotId: string;
  localDate: Date;
  minTemperature: number | null;
  maxTemperature: number | null;
  precipitationProbabilityMax: number | null;
  precipitationSum: number | null;
  rainSum: number | null;
  snowfallSum: number | null;
  maxWindSpeed: number | null;
  weatherCode: number | null;
  sunshineDuration: number | null;
  maxWaveHeight: number | null;
  maxWavePeriod: number | null;
  maxWindWaveHeight: number | null;
  maxSwellHeight: number | null;
  maxSwellPeriod: number | null;
};

function prisma(delegates: {
  forecastSnapshot: Record<string, sinon.SinonStub>;
}): PrismaClient {
  return delegates as unknown as PrismaClient;
}

function forecast(overrides: Partial<Forecast> = {}): Forecast {
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
    ],
    ...overrides,
  };
}

function dbSnapshot(
  overrides: Partial<DbForecastSnapshot> = {},
): DbForecastSnapshot {
  return {
    id: 'snapshot_1',
    locationId: 'loc_1',
    fetchedAt: new Date('2026-10-06T10:00:00.000Z'),
    weatherAvailable: true,
    marineAvailable: true,
    days: [dbDay()],
    ...overrides,
  };
}

function dbDay(overrides: Partial<DbForecastDay> = {}): DbForecastDay {
  return {
    id: 'day_1',
    snapshotId: 'snapshot_1',
    localDate: new Date('2026-10-06T00:00:00.000Z'),
    minTemperature: 2,
    maxTemperature: 8,
    precipitationProbabilityMax: 20,
    precipitationSum: 1,
    rainSum: 0,
    snowfallSum: 3,
    maxWindSpeed: 15,
    weatherCode: 3,
    sunshineDuration: 12000,
    maxWaveHeight: null,
    maxWavePeriod: null,
    maxWindWaveHeight: null,
    maxSwellHeight: null,
    maxSwellPeriod: null,
    ...overrides,
  };
}
