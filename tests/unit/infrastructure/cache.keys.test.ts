import { expect } from 'chai';
import {
  forecastCacheKey,
  locationSearchCacheKey,
  normalizeSearchQuery,
} from '../../../src/infrastructure/cache/cache.keys.js';

describe('cache keys', () => {
  it('uses the approved versioned location-search namespace', () => {
    const normalizedQuery = normalizeSearchQuery('  New   York  ');

    expect(locationSearchCacheKey(normalizedQuery)).to.equal(
      'weather-activity:v1:location-search:new york',
    );
  });

  it('keeps forecast keys in the approved versioned namespace', () => {
    expect(forecastCacheKey('loc_123')).to.equal(
      'weather-activity:v1:forecast:loc_123',
    );
  });
});
