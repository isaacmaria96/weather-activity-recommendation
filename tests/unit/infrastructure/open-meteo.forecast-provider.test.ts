import { expect } from 'chai';
import sinon from 'sinon';
import { OpenMeteoMarineProvider } from '../../../src/infrastructure/providers/open-meteo/open-meteo.marine.provider.js';
import { OpenMeteoWeatherProvider } from '../../../src/infrastructure/providers/open-meteo/open-meteo.weather.provider.js';
import type { OpenMeteoClient } from '../../../src/infrastructure/providers/open-meteo/open-meteo.client.js';
import { ProviderUnavailableError } from '../../../src/shared/errors/application-errors.js';

describe('Open-Meteo forecast providers', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('requests seven local weather forecast days with approved daily fields', async () => {
    const client = createClient({
      daily: {
        time: sevenDates(),
        temperature_2m_min: sevenNumbers(1),
        temperature_2m_max: sevenNumbers(2),
        precipitation_probability_max: sevenNumbers(3),
        precipitation_sum: sevenNumbers(4),
        rain_sum: sevenNumbers(5),
        snowfall_sum: sevenNumbers(6),
        wind_speed_10m_max: sevenNumbers(7),
        weather_code: sevenNumbers(8),
        sunshine_duration: sevenNumbers(9),
      },
    });
    const provider = new OpenMeteoWeatherProvider(client, {
      openMeteoWeatherBaseUrl: 'https://api.example.test',
    });

    const forecast = await provider.getDailyForecast({
      latitude: 51.5,
      longitude: -0.12,
      timezone: 'Europe/London',
    });

    expect(forecast.days).to.have.length(7);
    sinon.assert.calledOnceWithExactly(
      client.get,
      'https://api.example.test',
      '/v1/forecast',
      {
        latitude: 51.5,
        longitude: -0.12,
        timezone: 'Europe/London',
        forecast_days: 7,
        daily:
          'temperature_2m_min,temperature_2m_max,precipitation_probability_max,precipitation_sum,rain_sum,snowfall_sum,wind_speed_10m_max,weather_code,sunshine_duration',
      },
    );
  });

  it('requests seven local marine forecast days with approved daily fields', async () => {
    const client = createClient({
      daily: {
        time: sevenDates(),
        wave_height_max: sevenNumbers(1),
        wave_period_max: sevenNumbers(2),
        wind_wave_height_max: sevenNumbers(3),
        swell_wave_height_max: sevenNumbers(4),
        swell_wave_period_max: sevenNumbers(5),
      },
    });
    const provider = new OpenMeteoMarineProvider(client, {
      openMeteoMarineBaseUrl: 'https://marine.example.test',
    });

    const forecast = await provider.getDailyForecast({
      latitude: 51.5,
      longitude: -0.12,
      timezone: 'Europe/London',
    });

    expect(forecast.days).to.have.length(7);
    sinon.assert.calledOnceWithExactly(
      client.get,
      'https://marine.example.test',
      '/v1/marine',
      {
        latitude: 51.5,
        longitude: -0.12,
        timezone: 'Europe/London',
        forecast_days: 7,
        daily:
          'wave_height_max,wave_period_max,wind_wave_height_max,swell_wave_height_max,swell_wave_period_max',
      },
    );
  });

  it('propagates provider failures through the existing provider error type', async () => {
    const client = {
      get: sinon
        .stub()
        .rejects(new ProviderUnavailableError('Open-Meteo is unavailable')),
    } as unknown as OpenMeteoClient & { get: sinon.SinonStub };
    const provider = new OpenMeteoWeatherProvider(client, {
      openMeteoWeatherBaseUrl: 'https://api.example.test',
    });

    try {
      await provider.getDailyForecast({
        latitude: 51.5,
        longitude: -0.12,
        timezone: 'Europe/London',
      });
      throw new Error('Expected provider error');
    } catch (error) {
      expect(error).to.be.instanceOf(ProviderUnavailableError);
    }
  });

  function createClient(
    response: unknown,
  ): OpenMeteoClient & { get: sinon.SinonStub } {
    return {
      get: sinon.stub().resolves(response),
    } as unknown as OpenMeteoClient & { get: sinon.SinonStub };
  }

  function sevenDates(): string[] {
    return [
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
    ];
  }

  function sevenNumbers(value: number): number[] {
    return Array.from({ length: 7 }, () => value);
  }
});
