import type { AppConfig } from '../../../config/config.js';
import type { LocationProvider } from '../../../application/providers/provider.interfaces.js';
import type { ProviderLocation } from '../../../application/providers/provider.types.js';
import { mapOpenMeteoLocation } from './open-meteo.mapper.js';
import type { OpenMeteoGeocodingResponse } from './open-meteo.types.js';
import type { OpenMeteoClient } from './open-meteo.client.js';

export class OpenMeteoLocationProvider implements LocationProvider {
  constructor(
    private readonly client: OpenMeteoClient,
    private readonly config: Pick<AppConfig, 'openMeteoGeocodingBaseUrl'>,
  ) {}

  async searchLocations(query: string): Promise<ProviderLocation[]> {
    const response = await this.client.get<OpenMeteoGeocodingResponse>(
      this.config.openMeteoGeocodingBaseUrl,
      '/v1/search',
      {
        name: query,
        count: 10,
        language: 'en',
        format: 'json',
      },
    );

    return (response.results ?? [])
      .map(mapOpenMeteoLocation)
      .filter((location): location is ProviderLocation => location !== null);
  }
}
