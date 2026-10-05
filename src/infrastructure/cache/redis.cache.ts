import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { Forecast } from '../../domain/forecast/forecast.types.js';
import type { LocationCandidate } from '../../domain/location/location.types.js';
import type { ForecastCache, LocationSearchCache } from './cache.js';
import {
  forecastCacheKey,
  locationSearchCacheKey,
  normalizeSearchQuery,
} from './cache.keys.js';

export class RedisForecastCache implements ForecastCache {
  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
  ) {}

  async get(locationId: string): Promise<Forecast | null> {
    return getJson<Forecast>(
      this.redis,
      this.logger,
      forecastCacheKey(locationId),
    );
  }

  async set(
    locationId: string,
    forecast: Forecast,
    ttlSeconds: number,
  ): Promise<void> {
    await setJson(
      this.redis,
      this.logger,
      forecastCacheKey(locationId),
      forecast,
      ttlSeconds,
    );
  }
}

export class RedisLocationSearchCache implements LocationSearchCache {
  constructor(
    private readonly redis: Redis,
    private readonly logger: Logger,
  ) {}

  async get(query: string): Promise<LocationCandidate[] | null> {
    return getJson<LocationCandidate[]>(
      this.redis,
      this.logger,
      locationSearchCacheKey(normalizeSearchQuery(query)),
    );
  }

  async set(
    query: string,
    candidates: LocationCandidate[],
    ttlSeconds: number,
  ): Promise<void> {
    await setJson(
      this.redis,
      this.logger,
      locationSearchCacheKey(normalizeSearchQuery(query)),
      candidates,
      ttlSeconds,
    );
  }
}

async function getJson<T>(
  redis: Redis,
  logger: Logger,
  key: string,
): Promise<T | null> {
  try {
    const value = await redis.get(key);
    return value === null ? null : (JSON.parse(value) as T);
  } catch (error) {
    logger.warn({ error, key }, 'Redis cache read failed');
    return null;
  }
}

async function setJson(
  redis: Redis,
  logger: Logger,
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (error) {
    logger.warn({ error, key }, 'Redis cache write failed');
  }
}
