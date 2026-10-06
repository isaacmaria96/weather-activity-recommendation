import type { PrismaClient } from '@prisma/client';
import type {
  Forecast,
  ForecastDay,
} from '../../../domain/forecast/forecast.types.js';
import type { ForecastRepository } from '../../../application/forecast/forecast.repository.js';
import { PersistenceError } from '../../../shared/errors/application-errors.js';

export class PrismaForecastRepository implements ForecastRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findLatest(locationId: string): Promise<Forecast | null> {
    try {
      const snapshot = await this.prisma.forecastSnapshot.findFirst({
        where: { locationId },
        orderBy: { fetchedAt: 'desc' },
        include: {
          days: {
            orderBy: { localDate: 'asc' },
          },
        },
      });

      return snapshot === null ? null : mapSnapshot(snapshot);
    } catch {
      throw new PersistenceError('Failed to load latest forecast');
    }
  }

  async createSnapshot(forecast: Forecast): Promise<Forecast> {
    try {
      const snapshot = await this.prisma.forecastSnapshot.create({
        data: {
          id: forecast.snapshotId,
          locationId: forecast.locationId,
          fetchedAt: forecast.fetchedAt,
          weatherAvailable: forecast.weatherAvailable,
          marineAvailable: forecast.marineAvailable,
          days: {
            create: forecast.days.map((day) => ({
              localDate: toPrismaLocalDate(day.localDate),
              minTemperature: day.minTemperature,
              maxTemperature: day.maxTemperature,
              precipitationProbabilityMax: day.precipitationProbabilityMax,
              precipitationSum: day.precipitationSum,
              rainSum: day.rainSum,
              snowfallSum: day.snowfallSum,
              maxWindSpeed: day.maxWindSpeed,
              weatherCode: day.weatherCode,
              sunshineDuration: day.sunshineDuration,
              maxWaveHeight: day.marine?.maxWaveHeight ?? null,
              maxWavePeriod: day.marine?.maxWavePeriod ?? null,
              maxWindWaveHeight: day.marine?.maxWindWaveHeight ?? null,
              maxSwellHeight: day.marine?.maxSwellHeight ?? null,
              maxSwellPeriod: day.marine?.maxSwellPeriod ?? null,
            })),
          },
        },
        include: {
          days: {
            orderBy: { localDate: 'asc' },
          },
        },
      });

      return mapSnapshot(snapshot);
    } catch {
      throw new PersistenceError('Failed to persist forecast snapshot');
    }
  }

  async deleteOlderThan(locationId: string, cutoff: Date): Promise<void> {
    try {
      await this.prisma.forecastSnapshot.deleteMany({
        where: {
          locationId,
          fetchedAt: {
            lt: cutoff,
          },
        },
      });
    } catch {
      throw new PersistenceError('Failed to delete old forecast snapshots');
    }
  }
}

type PrismaForecastSnapshot =
  Awaited<
    ReturnType<PrismaClient['forecastSnapshot']['findFirst']>
  > extends infer T
    ? NonNullable<T> & { days: PrismaForecastDay[] }
    : never;

type PrismaForecastDay =
  Awaited<ReturnType<PrismaClient['forecastDay']['findFirst']>> extends infer T
    ? NonNullable<T>
    : never;

function mapSnapshot(snapshot: PrismaForecastSnapshot): Forecast {
  return {
    snapshotId: snapshot.id,
    locationId: snapshot.locationId,
    fetchedAt: snapshot.fetchedAt,
    weatherAvailable: snapshot.weatherAvailable,
    marineAvailable: snapshot.marineAvailable,
    days: snapshot.days.map(mapDay),
  };
}

function mapDay(day: PrismaForecastDay): ForecastDay {
  const marine = hasMarineData(day)
    ? {
        maxWaveHeight: day.maxWaveHeight,
        maxWavePeriod: day.maxWavePeriod,
        maxWindWaveHeight: day.maxWindWaveHeight,
        maxSwellHeight: day.maxSwellHeight,
        maxSwellPeriod: day.maxSwellPeriod,
      }
    : null;

  return {
    localDate: toLocalDateString(day.localDate),
    minTemperature: day.minTemperature,
    maxTemperature: day.maxTemperature,
    precipitationProbabilityMax: day.precipitationProbabilityMax,
    precipitationSum: day.precipitationSum,
    rainSum: day.rainSum,
    snowfallSum: day.snowfallSum,
    maxWindSpeed: day.maxWindSpeed,
    weatherCode: day.weatherCode,
    sunshineDuration: day.sunshineDuration,
    marine,
  };
}

function hasMarineData(day: PrismaForecastDay): boolean {
  return (
    day.maxWaveHeight !== null ||
    day.maxWavePeriod !== null ||
    day.maxWindWaveHeight !== null ||
    day.maxSwellHeight !== null ||
    day.maxSwellPeriod !== null
  );
}

function toPrismaLocalDate(localDate: string): Date {
  return new Date(`${localDate}T00:00:00.000Z`);
}

function toLocalDateString(localDate: Date): string {
  return localDate.toISOString().slice(0, 10);
}
