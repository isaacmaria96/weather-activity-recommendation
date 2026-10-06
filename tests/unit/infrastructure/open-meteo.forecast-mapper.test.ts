import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { expect } from 'chai';
import {
  combineProviderForecasts,
  mapOpenMeteoMarineForecast,
  mapOpenMeteoWeatherForecast,
} from '../../../src/infrastructure/providers/open-meteo/open-meteo.mapper.js';
import type {
  OpenMeteoMarineForecastResponse,
  OpenMeteoWeatherForecastResponse,
} from '../../../src/infrastructure/providers/open-meteo/open-meteo.types.js';
import { ProviderUnavailableError } from '../../../src/shared/errors/application-errors.js';

describe('Open-Meteo forecast mapping', () => {
  it('maps weather responses to normalized weather forecast days', async () => {
    const weather = mapOpenMeteoWeatherForecast(
      await loadFixture<OpenMeteoWeatherForecastResponse>('weather.json'),
    );

    expect(weather.weatherAvailable).to.equal(true);
    expect(weather.days).to.have.length(7);
    expect(weather.days[0]).to.deep.equal({
      localDate: '2026-10-06',
      minTemperature: 4.2,
      maxTemperature: 13.4,
      precipitationProbabilityMax: 20,
      precipitationSum: 0.1,
      rainSum: 0.1,
      snowfallSum: 0,
      maxWindSpeed: 12.1,
      weatherCode: 3,
      sunshineDuration: 18000,
    });
    expect(weather.days[2]?.minTemperature).to.equal(null);
    expect(weather.days.map((day) => day.localDate)).to.deep.equal([
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
    ]);
  });

  it('maps marine responses to normalized marine forecast days', async () => {
    const marine = mapOpenMeteoMarineForecast(
      await loadFixture<OpenMeteoMarineForecastResponse>('marine.json'),
    );

    expect(marine.marineAvailable).to.equal(true);
    expect(marine.days).to.have.length(7);
    expect(marine.days[0]).to.deep.equal({
      localDate: '2026-10-06',
      marine: {
        maxWaveHeight: 0.8,
        maxWavePeriod: 6,
        maxWindWaveHeight: 0.3,
        maxSwellHeight: 0.5,
        maxSwellPeriod: 5.4,
      },
    });
    expect(marine.days[2]?.marine?.maxWaveHeight).to.equal(null);
  });

  it('combines weather and marine into a normalized forecast', async () => {
    const weather = mapOpenMeteoWeatherForecast(
      await loadFixture<OpenMeteoWeatherForecastResponse>('weather.json'),
    );
    const marine = mapOpenMeteoMarineForecast(
      await loadFixture<OpenMeteoMarineForecastResponse>('marine.json'),
    );
    const fetchedAt = new Date('2026-10-06T00:00:00.000Z');

    const forecast = combineProviderForecasts({
      locationId: 'loc_123',
      snapshotId: 'snapshot_123',
      fetchedAt,
      weather,
      marine,
    });

    expect(forecast).to.include({
      snapshotId: 'snapshot_123',
      locationId: 'loc_123',
      fetchedAt,
      weatherAvailable: true,
      marineAvailable: true,
    });
    expect(forecast.days).to.have.length(7);
    expect(forecast.days[0]?.localDate).to.equal('2026-10-06');
    expect(forecast.days[0]?.marine?.maxWaveHeight).to.equal(0.8);
  });

  it('keeps missing marine data as null instead of inventing zeros', async () => {
    const weather = mapOpenMeteoWeatherForecast(
      await loadFixture<OpenMeteoWeatherForecastResponse>('weather.json'),
    );
    const marine = mapOpenMeteoMarineForecast(
      await loadFixture<OpenMeteoMarineForecastResponse>('marine-missing.json'),
    );

    const forecast = combineProviderForecasts({
      locationId: 'loc_123',
      snapshotId: 'snapshot_123',
      fetchedAt: new Date('2026-10-06T00:00:00.000Z'),
      weather,
      marine,
    });

    expect(marine.marineAvailable).to.equal(false);
    expect(forecast.marineAvailable).to.equal(false);
    expect(forecast.days.every((day) => day.marine === null)).to.equal(true);
  });

  it('treats a response without marine daily data as unavailable marine data', () => {
    const marine = mapOpenMeteoMarineForecast({});

    expect(marine).to.deep.equal({
      marineAvailable: false,
      days: [],
    });
  });

  it('rejects malformed weather responses', async () => {
    const malformed = await loadFixture<OpenMeteoWeatherForecastResponse>(
      'weather-malformed.json',
    );

    expect(() => mapOpenMeteoWeatherForecast(malformed)).to.throw(
      ProviderUnavailableError,
    );
  });

  it('rejects duplicate or non-local dates instead of reinterpreting them', () => {
    const malformed: OpenMeteoWeatherForecastResponse = {
      daily: {
        time: [
          '2026-10-06T00:00:00Z',
          '2026-10-07',
          '2026-10-08',
          '2026-10-09',
          '2026-10-10',
          '2026-10-11',
          '2026-10-11',
        ],
        temperature_2m_min: [1, 1, 1, 1, 1, 1, 1],
        temperature_2m_max: [2, 2, 2, 2, 2, 2, 2],
        precipitation_probability_max: [0, 0, 0, 0, 0, 0, 0],
        precipitation_sum: [0, 0, 0, 0, 0, 0, 0],
        rain_sum: [0, 0, 0, 0, 0, 0, 0],
        snowfall_sum: [0, 0, 0, 0, 0, 0, 0],
        wind_speed_10m_max: [1, 1, 1, 1, 1, 1, 1],
        weather_code: [0, 0, 0, 0, 0, 0, 0],
        sunshine_duration: [1, 1, 1, 1, 1, 1, 1],
      },
    };

    expect(() => mapOpenMeteoWeatherForecast(malformed)).to.throw(
      ProviderUnavailableError,
    );
  });

  async function loadFixture<T>(name: string): Promise<T> {
    const currentDirectory = dirname(fileURLToPath(import.meta.url));
    const fixturePath = join(
      currentDirectory,
      '..',
      '..',
      'fixtures',
      'open-meteo',
      name,
    );
    const contents = await readFile(fixturePath, 'utf8');

    return JSON.parse(contents) as T;
  }
});
