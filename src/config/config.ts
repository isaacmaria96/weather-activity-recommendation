import { z } from 'zod';

const configSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']).default('development'),
  port: z.coerce.number().int().positive().default(4000),
  logLevel: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  databaseUrl: z
    .string()
    .url()
    .default('postgresql://weather:weather@localhost:5432/weather'),
  redisUrl: z.string().url().default('redis://localhost:6379'),
  openMeteoGeocodingBaseUrl: z
    .string()
    .url()
    .default('https://geocoding-api.open-meteo.com'),
  openMeteoWeatherBaseUrl: z
    .string()
    .url()
    .default('https://api.open-meteo.com'),
  openMeteoMarineBaseUrl: z
    .string()
    .url()
    .default('https://marine-api.open-meteo.com'),
  openMeteoTimeoutMs: z.coerce.number().int().positive().default(5000),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return configSchema.parse({
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    openMeteoGeocodingBaseUrl: env.OPEN_METEO_GEOCODING_BASE_URL,
    openMeteoWeatherBaseUrl: env.OPEN_METEO_WEATHER_BASE_URL,
    openMeteoMarineBaseUrl: env.OPEN_METEO_MARINE_BASE_URL,
    openMeteoTimeoutMs: env.OPEN_METEO_TIMEOUT_MS,
  });
}
