import { ApolloServer } from '@apollo/server';
import { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { loadConfig, type AppConfig } from './config/config.js';
import {
  RedisForecastCache,
  RedisLocationSearchCache,
} from './infrastructure/cache/redis.cache.js';
import { createPrismaClient } from './infrastructure/database/prisma.js';
import { resolvers } from './presentation/graphql/resolvers.js';
import { typeDefs } from './presentation/graphql/schema.js';
import { createLogger } from './shared/logger.js';
import { SystemClock } from './shared/time.js';

export type Application = {
  config: AppConfig;
  logger: Logger;
  apolloServer: ApolloServer;
  shutdown(): Promise<void>;
};

export function createApplication(): Application {
  const config = loadConfig();
  const logger = createLogger(config);
  const prisma = createPrismaClient(config.databaseUrl);
  const redis = new Redis(config.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });

  const clock = new SystemClock();
  const forecastCache = new RedisForecastCache(redis, logger);
  const locationSearchCache = new RedisLocationSearchCache(redis, logger);

  void clock;
  void forecastCache;
  void locationSearchCache;

  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers,
  });

  return {
    config,
    logger,
    apolloServer,
    async shutdown(): Promise<void> {
      await apolloServer.stop();
      redis.disconnect();
      await prisma.$disconnect();
    },
  };
}
