import type {
  Forecast,
  ForecastDay,
} from '../../domain/forecast/forecast.types.js';
import type {
  ProviderMarineForecast,
  ProviderWeatherForecast,
} from '../providers/provider.types.js';

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
