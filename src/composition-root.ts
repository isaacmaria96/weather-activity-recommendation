import { ApolloServer } from '@apollo/server';
import { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { ForecastService } from './application/forecast/forecast.service.js';
import { LocationService } from './application/location/location.service.js';
import { RecommendationService } from './application/recommendation/recommendation.service.js';
import { loadConfig, type AppConfig } from './config/config.js';
import { IndoorSightseeingScorer } from './domain/activity/indoor-sightseeing.scorer.js';
import { OutdoorSightseeingScorer } from './domain/activity/outdoor-sightseeing.scorer.js';
import { SkiingScorer } from './domain/activity/skiing.scorer.js';
import { SurfingScorer } from './domain/activity/surfing.scorer.js';
import {
  RedisForecastCache,
  RedisLocationSearchCache,
} from './infrastructure/cache/redis.cache.js';
import { createPrismaClient } from './infrastructure/database/prisma.js';
import { PrismaForecastRepository } from './infrastructure/database/repositories/prisma.forecast.repository.js';
import { PrismaLocationRepository } from './infrastructure/database/repositories/prisma.location.repository.js';
import { OpenMeteoClient } from './infrastructure/providers/open-meteo/open-meteo.client.js';
import { OpenMeteoLocationProvider } from './infrastructure/providers/open-meteo/open-meteo.location.provider.js';
import { OpenMeteoMarineProvider } from './infrastructure/providers/open-meteo/open-meteo.marine.provider.js';
import { OpenMeteoWeatherProvider } from './infrastructure/providers/open-meteo/open-meteo.weather.provider.js';
import { createResolvers } from './presentation/graphql/resolvers.js';
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
  const openMeteoClient = new OpenMeteoClient(
    config.openMeteoTimeoutMs,
    logger,
  );
  const locationProvider = new OpenMeteoLocationProvider(
    openMeteoClient,
    config,
  );
  const weatherProvider = new OpenMeteoWeatherProvider(openMeteoClient, config);
  const marineProvider = new OpenMeteoMarineProvider(openMeteoClient, config);
  const locationRepository = new PrismaLocationRepository(prisma);
  const forecastRepository = new PrismaForecastRepository(prisma);
  const locationService = new LocationService(
    locationProvider,
    locationRepository,
    locationSearchCache,
    logger,
  );
  const forecastService = new ForecastService(
    forecastRepository,
    weatherProvider,
    marineProvider,
    clock,
  );
  const recommendationService = new RecommendationService(
    locationRepository,
    forecastService,
    [
      new SkiingScorer(),
      new SurfingScorer(),
      new OutdoorSightseeingScorer(),
      new IndoorSightseeingScorer(),
    ],
  );

  void forecastCache;

  const apolloServer = new ApolloServer({
    typeDefs,
    resolvers: createResolvers({ locationService, recommendationService }),
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
