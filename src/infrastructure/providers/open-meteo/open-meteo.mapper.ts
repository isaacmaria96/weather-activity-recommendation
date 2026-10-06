import type { ProviderLocation } from '../../../application/providers/provider.types.js';
import type { OpenMeteoGeocodingResult } from './open-meteo.types.js';

const OPEN_METEO_PROVIDER = 'open-meteo';

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
