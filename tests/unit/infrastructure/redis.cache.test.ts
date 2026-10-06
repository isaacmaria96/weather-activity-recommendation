import { expect } from 'chai';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import sinon from 'sinon';
import { RedisLocationSearchCache } from '../../../src/infrastructure/cache/redis.cache.js';

describe('RedisLocationSearchCache', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('treats Redis read failures as cache misses', async () => {
    const logger = createLogger();
    const redis = {
      get: sinon.stub().rejects(new Error('redis unavailable')),
    } as unknown as Redis;
    const cache = new RedisLocationSearchCache(redis, logger);

    const result = await cache.get('London');

    expect(result).to.equal(null);
    sinon.assert.calledOnce(logger.warn);
  });

  it('does not fail a valid flow when Redis writes fail', async () => {
    const logger = createLogger();
    const redis = {
      set: sinon.stub().rejects(new Error('redis unavailable')),
    } as unknown as Redis;
    const cache = new RedisLocationSearchCache(redis, logger);

    await cache.set(
      'London',
      [
        {
          id: 'loc_1',
          name: 'London',
          country: 'United Kingdom',
          countryCode: 'GB',
          region: 'England',
          latitude: 51.5,
          longitude: -0.12,
          timezone: 'Europe/London',
        },
      ],
      60,
    );

    sinon.assert.calledOnce(logger.warn);
  });

  function createLogger(): Logger & { warn: sinon.SinonStub } {
    return {
      warn: sinon.stub(),
    } as unknown as Logger & { warn: sinon.SinonStub };
  }
});
