import { expect } from 'chai';
import { mapOpenMeteoLocation } from '../../../src/infrastructure/providers/open-meteo/open-meteo.mapper.js';

describe('mapOpenMeteoLocation', () => {
  it('maps an Open-Meteo geocoding result to a provider location', () => {
    const result = mapOpenMeteoLocation({
      id: 2643743,
      name: 'London',
      latitude: 51.5085,
      longitude: -0.1257,
      country: 'United Kingdom',
      country_code: 'GB',
      admin1: 'England',
      timezone: 'Europe/London',
    });

    expect(result).to.deep.equal({
      provider: 'open-meteo',
      providerLocationId: '2643743',
      name: 'London',
      country: 'United Kingdom',
      countryCode: 'GB',
      region: 'England',
      latitude: 51.5085,
      longitude: -0.1257,
      timezone: 'Europe/London',
    });
  });

  it('drops malformed geocoding results instead of fabricating required data', () => {
    expect(
      mapOpenMeteoLocation({
        id: 1,
        name: 'Missing Timezone',
        latitude: 1,
        longitude: 2,
        country: 'Nowhere',
      }),
    ).to.equal(null);
  });
});
