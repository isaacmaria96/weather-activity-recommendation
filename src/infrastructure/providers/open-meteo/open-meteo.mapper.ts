import type { ProviderLocation } from '../../../application/providers/provider.types.js';
import type {
  Forecast,
  ForecastDay,
  MarineConditions,
} from '../../../domain/forecast/forecast.types.js';
import { FORECAST_DAYS } from '../../../config/constants.js';
import type {
  ProviderMarineForecast,
  ProviderWeatherForecast,
} from '../../../application/providers/provider.types.js';
import { ProviderUnavailableError } from '../../../shared/errors/application-errors.js';
import type {
  OpenMeteoGeocodingResult,
  OpenMeteoMarineForecastResponse,
  OpenMeteoWeatherForecastResponse,
} from './open-meteo.types.js';

const OPEN_METEO_PROVIDER = 'open-meteo';
const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function mapOpenMeteoLocation(
  result: OpenMeteoGeocodingResult,
): ProviderLocation | null {
  if (
    result.id === undefined ||
    result.name === undefined ||
    result.latitude === undefined ||
    result.longitude === undefined ||
    result.country === undefined ||
    result.timezone === undefined
  ) {
    return null;
  }

  return {
    provider: OPEN_METEO_PROVIDER,
    providerLocationId: String(result.id),
    name: result.name,
    country: result.country,
    ...(result.country_code === undefined
      ? {}
      : { countryCode: result.country_code }),
    ...(result.admin1 === undefined ? {} : { region: result.admin1 }),
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone,
  };
}

export function mapOpenMeteoWeatherForecast(
  response: OpenMeteoWeatherForecastResponse,
): ProviderWeatherForecast {
  const daily = response.daily;
  const dates = validateDates(daily?.time);

  return {
    weatherAvailable: true,
    days: dates.map((localDate, index) => ({
      localDate,
      minTemperature: readRequiredNumber(daily?.temperature_2m_min, index),
      maxTemperature: readRequiredNumber(daily?.temperature_2m_max, index),
      precipitationProbabilityMax: readRequiredNumber(
        daily?.precipitation_probability_max,
        index,
      ),
      precipitationSum: readRequiredNumber(daily?.precipitation_sum, index),
      rainSum: readRequiredNumber(daily?.rain_sum, index),
      snowfallSum: readRequiredNumber(daily?.snowfall_sum, index),
      maxWindSpeed: readRequiredNumber(daily?.wind_speed_10m_max, index),
      weatherCode: readRequiredWeatherCode(daily?.weather_code, index),
      sunshineDuration: readRequiredNumber(daily?.sunshine_duration, index),
    })),
  };
}

export function mapOpenMeteoMarineForecast(
  response: OpenMeteoMarineForecastResponse,
): ProviderMarineForecast {
  const daily = response.daily;

  if (daily?.time === undefined) {
    return {
      marineAvailable: false,
      days: [],
    };
  }

  const dates = validateDates(daily.time);
  const marineAvailable = hasAnyMarineField(daily);

  return {
    marineAvailable,
    days: dates.map((localDate, index) => ({
      localDate,
      marine: mapMarineConditions(daily, index),
    })),
  };
}

export function combineProviderForecasts({
  locationId,
  snapshotId,
  fetchedAt,
  weather,
  marine,
}: {
  locationId: string;
  snapshotId: string;
  fetchedAt: Date;
  weather: ProviderWeatherForecast;
  marine?: ProviderMarineForecast;
}): Forecast {
  const marineByDate = new Map(
    (marine?.days ?? []).map((day) => [day.localDate, day.marine]),
  );

  return {
    snapshotId,
    locationId,
    fetchedAt,
    weatherAvailable: weather.weatherAvailable,
    marineAvailable: marine?.marineAvailable ?? false,
    days: weather.days.map((day): ForecastDay => {
      const marineForDay = marineByDate.get(day.localDate) ?? null;

      return {
        ...day,
        marine: marineForDay,
      };
    }),
  };
}

function validateDates(dates: string[] | undefined): string[] {
  if (dates === undefined || dates.length !== FORECAST_DAYS) {
    throwMalformedForecast();
  }

  const distinctDates = new Set(dates);
  if (distinctDates.size !== FORECAST_DAYS) {
    throwMalformedForecast();
  }

  for (const date of dates) {
    if (!LOCAL_DATE_PATTERN.test(date)) {
      throwMalformedForecast();
    }
  }

  return dates;
}

function readRequiredNumber(
  values: Array<number | null> | undefined,
  index: number,
): number | null {
  assertArrayContainsIndex(values, index);

  return values[index] ?? null;
}

function readRequiredWeatherCode(
  values: Array<number | null> | undefined,
  index: number,
): number | null {
  assertArrayContainsIndex(values, index);

  return values[index] ?? null;
}

function assertArrayContainsIndex(
  values: unknown[] | undefined,
  index: number,
): asserts values is unknown[] {
  if (values === undefined || values.length !== FORECAST_DAYS) {
    throwMalformedForecast();
  }

  if (!(index in values)) {
    throwMalformedForecast();
  }
}

function mapMarineConditions(
  daily: NonNullable<OpenMeteoMarineForecastResponse['daily']>,
  index: number,
): MarineConditions | null {
  if (!hasAnyMarineField(daily)) {
    return null;
  }

  return {
    maxWaveHeight: readOptionalNumber(daily.wave_height_max, index),
    maxWavePeriod: readOptionalNumber(daily.wave_period_max, index),
    maxWindWaveHeight: readOptionalNumber(daily.wind_wave_height_max, index),
    maxSwellHeight: readOptionalNumber(daily.swell_wave_height_max, index),
    maxSwellPeriod: readOptionalNumber(daily.swell_wave_period_max, index),
  };
}

function hasAnyMarineField(
  daily: NonNullable<OpenMeteoMarineForecastResponse['daily']>,
): boolean {
  return (
    daily.wave_height_max !== undefined ||
    daily.wave_period_max !== undefined ||
    daily.wind_wave_height_max !== undefined ||
    daily.swell_wave_height_max !== undefined ||
    daily.swell_wave_period_max !== undefined
  );
}

function readOptionalNumber(
  values: Array<number | null> | undefined,
  index: number,
): number | null {
  if (values === undefined) {
    return null;
  }

  if (values.length !== FORECAST_DAYS || !(index in values)) {
    throwMalformedForecast();
  }

  return values[index] ?? null;
}

function throwMalformedForecast(): never {
  throw new ProviderUnavailableError('Malformed Open-Meteo forecast response');
}
