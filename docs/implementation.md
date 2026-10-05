# Implementation Guide

This document is the implementation contract for the Weather Activity Recommendation Service.

It converts the approved requirements, HLD, LLD, and design decisions into concrete implementation instructions for Codex.

The implementation should follow this document rather than making new architecture decisions during coding.

If implementation uncovers a genuine conflict with the approved design, stop and flag the conflict before changing the architecture. Record any approved deviation in `docs/decisions.md`.

---

## 1. Implementation Goals

Build a focused TypeScript/Node.js/GraphQL backend that:

- searches for locations;
- issues an opaque service-owned `locationId`;
- retrieves and persists seven-day forecasts from Open-Meteo;
- uses Redis as a performance cache;
- uses PostgreSQL as the durable source of truth;
- refreshes stale forecasts on demand;
- falls back to usable stale data during a temporary provider outage;
- scores skiing, surfing, outdoor sightseeing, and indoor sightseeing deterministically;
- returns all seven local dates ranked for each activity;
- keeps GraphQL, domain logic, persistence, cache, and provider concerns separated;
- is straightforward to run locally and review from a public GitHub repository.

Do not add functionality that is not required by the approved design.

---

## 2. Technology Choices

Use the following concrete stack.

### Runtime

- Node.js 22 LTS or newer compatible LTS release available when implementation begins.
- TypeScript with `strict` mode enabled.

### API

- Apollo Server.
- GraphQL.
- No REST API is required for the exercise.

### Persistence

- PostgreSQL.
- Prisma ORM.

### Cache

- Redis.
- `ioredis` client.

### HTTP

Use the Node.js native `fetch` API. Do not add Axios unless a concrete provider integration requirement makes it necessary.

### Logging

- `pino` for structured application logs.

### Validation/configuration

- `zod` for environment/runtime configuration validation.

### Testing

- Mocha for test execution.
- Chai for assertions.
- Sinon for mocks, stubs, and spies where required.
- Integration tests run against PostgreSQL and Redis containers.

### Tooling

- ESLint.
- Prettier.
- `tsx` for local TypeScript execution.

### Dependency policy

Use current stable compatible package versions when installing dependencies and commit the generated lockfile.

Do not pin arbitrary versions in this document; the lockfile is the authoritative dependency state for the submission.

---

## 3. Repository Structure

Create the following structure:

```text
weather-activity-recommendation/
├── docs/
│   ├── requirements.md
│   ├── hld.md
│   ├── lld.md
│   ├── decisions.md
│   └── implementation.md
│
├── prisma/
│   └── schema.prisma
│
├── src/
│   ├── config/
│   │   ├── config.ts
│   │   └── constants.ts
│   │
│   ├── domain/
│   │   ├── activity/
│   │   │   ├── activity.types.ts
│   │   │   ├── activity-scorer.ts
│   │   │   ├── skiing.scorer.ts
│   │   │   ├── surfing.scorer.ts
│   │   │   ├── outdoor-sightseeing.scorer.ts
│   │   │   ├── indoor-sightseeing.scorer.ts
│   │   │   ├── scoring.helpers.ts
│   │   │   └── scoring.config.ts
│   │   ├── forecast/
│   │   │   └── forecast.types.ts
│   │   ├── location/
│   │   │   └── location.types.ts
│   │   └── ranking/
│   │       └── ranking.ts
│   │
│   ├── application/
│   │   ├── location/
│   │   │   └── location.service.ts
│   │   ├── forecast/
│   │   │   └── forecast.service.ts
│   │   └── recommendation/
│   │       └── recommendation.service.ts
│   │
│   ├── infrastructure/
│   │   ├── cache/
│   │   │   ├── cache.ts
│   │   │   ├── redis.cache.ts
│   │   │   └── cache.keys.ts
│   │   │
│   │   ├── database/
│   │   │   ├── prisma.ts
│   │   │   └── repositories/
│   │   │       ├── prisma.location.repository.ts
│   │   │       └── prisma.forecast.repository.ts
│   │   │
│   │   └── providers/
│   │       └── open-meteo/
│   │           ├── open-meteo.location.provider.ts
│   │           ├── open-meteo.weather.provider.ts
│   │           ├── open-meteo.marine.provider.ts
│   │           ├── open-meteo.client.ts
│   │           ├── open-meteo.mapper.ts
│   │           └── open-meteo.types.ts
│   │
│   ├── presentation/
│   │   └── graphql/
│   │       ├── schema.ts
│   │       ├── resolvers.ts
│   │       └── error-mapper.ts
│   │
│   ├── shared/
│   │   ├── errors/
│   │   │   └── application-errors.ts
│   │   ├── logger.ts
│   │   └── time.ts
│   │
│   ├── composition-root.ts
│   └── server.ts
│
├── tests/
│   ├── unit/
│   │   ├── domain/
│   │   ├── application/
│   │   └── infrastructure/
│   └── integration/
│       ├── graphql/
│       ├── postgres/
│       └── redis/
│
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── .mocharc.json
├── eslint.config.js
├── prettier.config.js
├── package.json
├── package-lock.json
└── tsconfig.json
```

The exact filenames above are intentional. Keep modules small and aligned with the responsibilities already approved in the LLD.

---

## 4. Dependency Direction

Enforce this dependency direction:

```text
presentation
     ↓
application
     ↓
domain
     ↑
infrastructure adapters
```

The practical dependency rule is:

- GraphQL may depend on application services and shared error types.
- Application services may depend on domain types and interfaces.
- Domain code depends on nothing in infrastructure or presentation.
- Infrastructure implements application-facing interfaces.
- Composition root wires concrete infrastructure implementations into application services.

Do not import Prisma, Redis, `fetch`, Apollo, or Open-Meteo types into domain scoring files.

---

## 5. Manual Dependency Injection

Use manual dependency injection.

Do not introduce NestJS, Inversify, tsyringe, or another DI framework.

The composition root should construct:

```text
Logger
PrismaClient
RedisClient
Repositories
Open-Meteo providers
Scorers
LocationService
ForecastService
RecommendationService
GraphQL resolvers
```

Prefer constructor injection.

Example shape:

```ts
export class ForecastService {
  constructor(
    private readonly forecastRepository: ForecastRepository,
    private readonly cache: ForecastCache,
    private readonly weatherProvider: WeatherProvider,
    private readonly marineProvider: MarineProvider,
    private readonly logger: Logger,
  ) {}
}
```

Do not instantiate infrastructure dependencies inside application services.

### Naming conventions

Keep the architectural layer names explicit:

- `application/` represents use-case orchestration; individual use cases may be implemented as services.
- `presentation/` represents the external presentation/API boundary; GraphQL is the current implementation.
- `shared/` contains only genuinely cross-cutting utilities and error types.
- `composition-root.ts` is responsible for assembling the application object graph and wiring concrete dependencies.

Do not rename `composition-root.ts` to `factory.ts`; a composition root wires the application rather than manufacturing one domain object.
Do not rename the architectural directories to `service/`, `apis/`, or `commons/` merely for brevity.

---

## 6. Runtime Configuration

Environment variables are for runtime/deployment configuration, not business rules.

`.env.example`:

```text
NODE_ENV=development
PORT=4000
LOG_LEVEL=info
DATABASE_URL=postgresql://weather:weather@localhost:5432/weather
REDIS_URL=redis://localhost:6379
OPEN_METEO_GEOCODING_BASE_URL=https://geocoding-api.open-meteo.com
OPEN_METEO_WEATHER_BASE_URL=https://api.open-meteo.com
OPEN_METEO_MARINE_BASE_URL=https://marine-api.open-meteo.com
OPEN_METEO_TIMEOUT_MS=5000
```

Validate all required configuration at startup.

Do not put these product rules in environment variables:

- six-hour freshness;
- 24-hour stale limit;
- 30-day retention;
- activity scoring weights;
- score thresholds.

Those belong in typed application/domain constants.

---

## 7. Product Constants

Create `src/config/constants.ts`.

Use typed constants similar to:

```ts
export const FORECAST_FRESHNESS_MS = 6 * 60 * 60 * 1000;
export const FORECAST_STALE_MAX_MS = 24 * 60 * 60 * 1000;
export const FORECAST_RETENTION_DAYS = 30;

export const FORECAST_CACHE_TTL_SECONDS = 24 * 60 * 60;
export const LOCATION_SEARCH_CACHE_TTL_SECONDS = 24 * 60 * 60;

export const FORECAST_DAYS = 7;
export const MAX_LOCATION_QUERY_LENGTH = 120;
```

Freshness logic must use `fetchedAt`, not Redis TTL, as the source of truth.

Redis TTL only controls how long a cached representation remains available.

---

## 8. Prisma Data Model

Implement the approved relationships exactly:

```text
Location
   │ 1:N
   ▼
ForecastSnapshot
   │ 1:N
   ▼
ForecastDay
```

Use this Prisma model as the starting point:

```prisma
model Location {
  id                   String             @id @default(cuid())
  provider             String
  providerLocationId   String
  name                 String
  country              String
  countryCode          String?
  region               String?
  latitude             Float
  longitude            Float
  timezone             String
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt
  forecastSnapshots    ForecastSnapshot[]

  @@unique([provider, providerLocationId])
  @@index([name])
}

model ForecastSnapshot {
  id               String         @id @default(cuid())
  locationId       String
  fetchedAt        DateTime
  weatherAvailable Boolean
  marineAvailable  Boolean
  location         Location       @relation(fields: [locationId], references: [id], onDelete: Cascade)
  days             ForecastDay[]

  @@index([locationId, fetchedAt(sort: Desc)])
}

model ForecastDay {
  id                           String           @id @default(cuid())
  snapshotId                   String
  localDate                    DateTime         @db.Date
  minTemperature               Float?
  maxTemperature               Float?
  precipitationProbabilityMax  Float?
  precipitationSum             Float?
  rainSum                      Float?
  snowfallSum                  Float?
  maxWindSpeed                 Float?
  weatherCode                  Int?
  sunshineDuration             Float?
  maxWaveHeight                Float?
  maxWavePeriod                Float?
  maxWindWaveHeight            Float?
  maxSwellHeight               Float?
  maxSwellPeriod               Float?
  snapshot                     ForecastSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)

  @@unique([snapshotId, localDate])
  @@index([snapshotId, localDate])
}
```

Notes:

- `localDate` is stored as a PostgreSQL `DATE`, not a timestamp.
- Forecast values are nullable because marine data may be unavailable.
- Snapshots are immutable; never update an existing snapshot's forecast values.
- The provider identity on `Location` is used to deduplicate search results.

Create the initial migration with Prisma and commit the migration files.

---

## 9. Domain Types

### Location

`src/domain/location/location.types.ts`

```ts
export type Location = {
  id: string;
  name: string;
  country: string;
  countryCode: string | null;
  region: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
};

export type LocationCandidate = Location;
```

Provider identifiers should not appear in this domain type.

### Forecast

`src/domain/forecast/forecast.types.ts`

```ts
export type MarineConditions = {
  maxWaveHeight: number | null;
  maxWavePeriod: number | null;
  maxWindWaveHeight: number | null;
  maxSwellHeight: number | null;
  maxSwellPeriod: number | null;
};

export type ForecastDay = {
  localDate: string;
  minTemperature: number | null;
  maxTemperature: number | null;
  precipitationProbabilityMax: number | null;
  precipitationSum: number | null;
  rainSum: number | null;
  snowfallSum: number | null;
  maxWindSpeed: number | null;
  weatherCode: number | null;
  sunshineDuration: number | null;
  marine: MarineConditions | null;
};

export type Forecast = {
  snapshotId: string;
  locationId: string;
  fetchedAt: Date;
  weatherAvailable: boolean;
  marineAvailable: boolean;
  days: ForecastDay[];
};
```

### Activity score

`src/domain/activity/activity.types.ts`

```ts
export enum Activity {
  SKIING = 'SKIING',
  SURFING = 'SURFING',
  OUTDOOR_SIGHTSEEING = 'OUTDOOR_SIGHTSEEING',
  INDOOR_SIGHTSEEING = 'INDOOR_SIGHTSEEING',
}

export enum Availability {
  AVAILABLE = 'AVAILABLE',
  NOT_AVAILABLE = 'NOT_AVAILABLE',
}

export type ActivityScore = {
  score: number | null;
  availability: Availability;
};
```

---

## 10. Repository Interfaces

Define interfaces in the application layer or a dedicated application contracts module.

### LocationRepository

```ts
export interface LocationRepository {
  findById(id: string): Promise<Location | null>;

  upsertCandidates(candidates: ProviderLocation[]): Promise<Location[]>;
}
```

The exact provider candidate type can remain at the infrastructure/application boundary; do not leak Prisma models into services.

### ForecastRepository

```ts
export interface ForecastRepository {
  findLatest(locationId: string): Promise<Forecast | null>;

  createSnapshot(forecast: Forecast): Promise<Forecast>;

  deleteOlderThan(locationId: string, cutoff: Date): Promise<void>;
}
```

Repositories must return domain models, not Prisma-generated model objects.

Use explicit mapping functions between Prisma records and domain models.

---

## 11. Cache Interface

Define a small cache abstraction.

```ts
export interface ForecastCache {
  get(locationId: string): Promise<Forecast | null>;
  set(locationId: string, forecast: Forecast, ttlSeconds: number): Promise<void>;
}

export interface LocationSearchCache {
  get(query: string): Promise<LocationCandidate[] | null>;
  set(query: string, candidates: LocationCandidate[], ttlSeconds: number): Promise<void>;
}
```

The Redis implementation must treat Redis failures as cache failures, not application failures.

Recommended behaviour:

```ts
try {
  return await redis.get(...);
} catch (error) {
  logger.warn(...);
  return null;
}
```

The application must continue to PostgreSQL/provider paths when Redis is unavailable.

---

## 12. Redis Key Design

Use namespaced keys with a cache representation/schema version.

The cache stores domain-level representations rather than GraphQL response objects, so the version should identify the cached data contract rather than the API endpoint.

```text
weather-activity:v1:forecast:{locationId}
weather-activity:v1:location-search:{normalizedQuery}
```

Do not use raw user input without normalization for location search keys.

Normalization:

```ts
function normalizeSearchQuery(query: string): string {
  return query.trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
}
```

The cache value should be JSON containing the serialized domain `Forecast` or `LocationCandidate[]`.

If the serialized cache contract changes incompatibly, increment the cache version rather than attempting to read the old representation with the new code.

Do not couple Redis keys to GraphQL operation names or endpoint versions. GraphQL is the presentation layer and the cache is intentionally below that boundary.

Do not cache the GraphQL response object. Cache the domain-level representation so the cache is independent of the presentation layer.

---

## 13. Open-Meteo Provider Interfaces

Implement the approved provider abstraction.

```ts
export interface LocationProvider {
  searchLocations(query: string): Promise<ProviderLocation[]>;
}

export interface WeatherProvider {
  getDailyForecast(
    request: WeatherForecastRequest,
  ): Promise<ProviderWeatherForecast>;
}

export interface MarineProvider {
  getDailyForecast(
    request: MarineForecastRequest,
  ): Promise<ProviderMarineForecast>;
}
```

Provider-specific types live under `infrastructure/providers/open-meteo`.

The application/domain layer must not depend on Open-Meteo response shapes.

---

## 14. Open-Meteo HTTP Client

Create one small HTTP client responsible for:

- base URL selection;
- request construction;
- timeout handling;
- non-2xx detection;
- JSON parsing;
- logging request duration;
- translating low-level failures into a provider-level error.

Use `AbortSignal.timeout(config.openMeteoTimeoutMs)`.

Do not retry provider calls automatically in the first implementation.

Do not add a circuit breaker unless explicitly approved later.

Pseudo-shape:

```ts
export class OpenMeteoClient {
  async get<T>(
    baseUrl: string,
    path: string,
    query: Record<string, string | number>,
  ): Promise<T> {
    // build URL
    // perform fetch with timeout
    // validate HTTP status
    // parse JSON
    // translate failure
  }
}
```

Centralize the HTTP concerns here rather than duplicating `fetch` logic in three providers.

---

## 15. Location Search Implementation

`LocationService.search(query)` should follow this sequence:

```text
Input
 ↓
trim + normalize
 ↓
validate non-empty + max length
 ↓
Redis location-search lookup
 ├── hit  → return candidates
 └── miss
       ↓
LocationProvider.searchLocations()
       ↓
map provider candidates
       ↓
upsert by provider + providerLocationId
       ↓
cache service-owned candidates
       ↓
return candidates
```

Rules:

- Empty/whitespace-only query → `INVALID_INPUT`.
- Excessively long query → `INVALID_INPUT`.
- Multiple candidates remain multiple candidates.
- Never silently select the first candidate.
- Ranking never accepts free-text location names or arbitrary coordinates.

The provider candidate should contain at least:

```text
providerLocationId
name
country
countryCode
region
latitude
longitude
timezone
```

---

## 16. GraphQL SDL

Use this schema as the initial contract. Do not extend it casually.

```graphql
type Query {
  searchLocations(query: String!): [LocationCandidate!]!
  activityRankings(locationId: ID!): ActivityRankingResponse!
}

type LocationCandidate {
  id: ID!
  name: String!
  country: String!
  countryCode: String
  region: String
  latitude: Float!
  longitude: Float!
  timezone: String!
}

type ActivityRankingResponse {
  location: Location!
  forecast: ForecastMetadata!
  skiing: ActivityRanking!
  surfing: ActivityRanking!
  outdoorSightseeing: ActivityRanking!
  indoorSightseeing: ActivityRanking!
}

type Location {
  id: ID!
  name: String!
  country: String!
  region: String
  latitude: Float!
  longitude: Float!
  timezone: String!
}

type ForecastMetadata {
  fetchedAt: String!
  stale: Boolean!
}

type ActivityRanking {
  days: [ActivityDay!]!
}

type ActivityDay {
  date: String!
  score: Int
  availability: Availability!
}

enum Availability {
  AVAILABLE
  NOT_AVAILABLE
}
```

Implementation notes:

- Keep `score` nullable because unavailable activities must not be represented as score `0`.
- `date` is an ISO local date (`YYYY-MM-DD`).
- All seven days are returned in rank order for every activity.
- `fetchedAt` should be emitted as an ISO-8601 timestamp.
- `stale` means the persisted forecast is older than six hours but younger than 24 hours.

---

## 17. GraphQL Resolver Implementation

Resolvers remain thin.

### `searchLocations`

```text
resolver
  ↓
locationService.search(query)
  ↓
return domain candidates
```

### `activityRankings`

```text
resolver
  ↓
recommendationService.getRankings(locationId)
  ↓
return response DTO
```

The resolver must not:

- call Open-Meteo;
- access Prisma;
- access Redis;
- calculate scores;
- decide freshness;
- perform retries/fallbacks.

All application errors are mapped to GraphQL errors using `error-mapper.ts`.

---

## 18. Error Classes

Implement:

```ts
export class InvalidInputError extends Error {}
export class LocationNotFoundError extends Error {}
export class ProviderUnavailableError extends Error {}
export class ForecastUnavailableError extends Error {}
export class PersistenceError extends Error {}
```

Optional internal metadata may be attached, but never expose provider URLs, stack traces, SQL errors, or implementation details to clients.

Map to GraphQL codes:

```text
INVALID_INPUT
LOCATION_NOT_FOUND
UPSTREAM_UNAVAILABLE
FORECAST_UNAVAILABLE
INTERNAL_ERROR
```

Recommended mapping:

| Application error | GraphQL code |
|---|---|
| InvalidInputError | INVALID_INPUT |
| LocationNotFoundError | LOCATION_NOT_FOUND |
| ProviderUnavailableError | UPSTREAM_UNAVAILABLE |
| ForecastUnavailableError | FORECAST_UNAVAILABLE |
| PersistenceError | INTERNAL_ERROR |
| Unknown error | INTERNAL_ERROR |

---

## 19. Forecast Retrieval Algorithm

Implement the exact freshness policy:

```text
age < 6h      → fresh
6h ≤ age <24h → stale but usable
age ≥ 24h     → expired
```

Use a testable time source instead of calling `new Date()` throughout business logic.

### Retrieval sequence

```text
activityRankings(locationId)
        ↓
LocationRepository.findById()
        ↓
if missing → LocationNotFoundError
        ↓
ForecastService.getForecast(location)
        ↓
Redis.get(forecast:{locationId})
        ├── fresh → return cached forecast
        └── stale/miss
              ↓
        PostgreSQL.findLatest()
              ├── fresh → cache + return
              └── stale/missing
                    ↓
             single-flight refresh
                    ↓
              Open-Meteo
                    ├── success → persist + cache + return fresh
                    └── failure
                          ├── stale <24h → return stale
                          └── no usable forecast → FORECAST_UNAVAILABLE
```

A stale Redis value must not bypass PostgreSQL/provider freshness handling.

Redis freshness is only an optimization; `fetchedAt` remains authoritative.

---

## 20. Refresh Single-Flight

Implement a per-location in-flight refresh map in `ForecastService`.

```ts
private readonly refreshes = new Map<string, Promise<Forecast>>();
```

Algorithm:

```text
Request A sees stale location
   ↓
create refresh Promise
   ↓
store under locationId

Request B sees same stale location
   ↓
find existing Promise
   ↓
await same Promise

refresh completes
   ↓
remove map entry
```

Use `try/finally` to guarantee cleanup.

This is intentionally process-local.

Do not implement Redis distributed locking for the initial submission.

---

## 21. Provider Refresh

Fetch weather and marine capabilities concurrently.

Use `Promise.allSettled`, not `Promise.all`, because marine data is optional for non-surfing activities.

Conceptually:

```ts
const [weatherResult, marineResult] = await Promise.allSettled([
  weatherProvider.getDailyForecast(request),
  marineProvider.getDailyForecast(request),
]);
```

### Result handling

```text
Weather ✅ Marine ✅
→ persist both
→ all four activities available

Weather ✅ Marine ❌
→ persist weather
→ marineAvailable=false
→ surfing NOT_AVAILABLE
→ other activities scored normally

Weather ❌ Marine ✅
→ required weather forecast unavailable
→ do not return rankings

Weather ❌ Marine ❌
→ required forecast unavailable
→ do not return rankings
```

When an existing stale forecast is still usable and a refresh fails, return the existing forecast and mark the response `stale=true`.

Log the provider failure with enough context to troubleshoot it, but do not expose the raw error to GraphQL clients.

---

## 22. Forecast Normalization

Provider adapters should convert provider-specific arrays into the normalized `ForecastDay[]` domain model.

The adapter must:

1. use the selected location timezone;
2. request daily data for seven days;
3. align daily arrays by index/date;
4. normalize units into the units expected by scoring;
5. convert missing provider values to `null`;
6. never fabricate missing data.

The normalized seven-day forecast must contain exactly seven distinct local dates.

Fail provider normalization explicitly if the required weather daily structure is malformed.

---

## 23. Persistence of a Refresh

Persist a successful refresh atomically.

Conceptually:

```text
BEGIN TRANSACTION
    INSERT ForecastSnapshot
    INSERT 7 ForecastDay rows
    DELETE ForecastSnapshot rows older than 30 days for this location
COMMIT
```

Do not update an existing snapshot.

If any step fails:

```text
ROLLBACK
previous snapshot remains available
```

After successful persistence, write the normalized forecast into Redis.

If the Redis write fails, log it and still return the successfully persisted forecast.

---

## 24. Forecast Repository Implementation

`findLatest(locationId)`:

```text
SELECT latest snapshot ordered by fetchedAt DESC
include forecast days ordered by localDate ASC
map Prisma records → domain Forecast
```

`createSnapshot(forecast)`:

- create snapshot record;
- create all day records in the same transaction;
- return the mapped domain model.

`deleteOlderThan(locationId, cutoff)`:

Delete snapshots older than the cutoff. Cascade should remove associated days.

Do not delete the latest snapshot merely because it is older than 30 days if it is the only available snapshot; use the simplest safe interpretation that preserves the current serving record. In normal operation, a recent snapshot should exist.

---

## 25. Scoring Architecture

Create four concrete scorers implementing:

```ts
export interface ActivityScorer {
  readonly activity: Activity;
  score(day: ForecastDay): ActivityScore;
}
```

Scorers must be pure functions.

They must not access:

- Redis;
- PostgreSQL;
- system time;
- HTTP;
- GraphQL;
- provider-specific types.

Keep all thresholds/weights in `scoring.config.ts`.

Do not create an admin endpoint or database table for scoring configuration.

---

## 26. Scoring Helper Functions

Use small deterministic helpers such as:

```ts
function clamp(value: number, min = 0, max = 100): number;

function weightedAverage(
  components: Array<{ score: number; weight: number }>,
): number;

function scoreRange(
  value: number,
  idealMin: number,
  idealMax: number,
  acceptableMin: number,
  acceptableMax: number,
): number;
```

The helpers should have no external dependencies.

Round the final score to the nearest integer and clamp to `0..100`.

---

## 27. Concrete Scoring Heuristics

These rules are implementation heuristics for the exercise, not scientifically validated recommendations.

Keep the weights exactly as approved in the LLD.

### Skiing

Weights:

```text
Snowfall       40%
Temperature    30%
Wind           20%
Rain/severity  10%
```

Suggested deterministic component behaviour:

**Snowfall**

```text
0 mm          → 20
>0 to <2 mm   → 45
2 to <10 mm   → 80
10 to <25 mm  → 100
>=25 mm       → 90
```

**Temperature**

Use the daily min/max midpoint for the suitability signal.

```text
-8°C to -2°C  → 100
-12°C to < -8  → 75
-2°C to 2°C    → 85
2°C to 5°C     → 60
outside above → progressively lower
```

Do not make the exact thresholds a safety guarantee.

**Wind**

Lower maximum daily wind is better.

**Rain/severity**

Rain and severe weather codes reduce the score.

### Surfing

Requires `day.marine`.

Weights:

```text
Wave height      40%
Wave period      30%
Swell/structure  15%
Wind             15%
```

If marine data is absent or required marine inputs are unavailable:

```ts
{
  score: null,
  availability: Availability.NOT_AVAILABLE,
}
```

Do not convert missing marine data into `score: 0`.

### Outdoor sightseeing

Weights:

```text
Precipitation     35%
Temperature       30%
Wind              20%
Sunshine/severity 15%
```

Dry, mild, lower-wind days score higher.

### Indoor sightseeing

Weights:

```text
Precipitation  40%
Temperature    25%
Wind           20%
Severity       15%
```

Calculate indoor suitability independently.

Do not implement:

```ts
indoorScore = 100 - outdoorScore;
```

The result is allowed to be high on a rainy day without being mathematically coupled to the outdoor scorer.

---

## 28. Ranking Implementation

Implement one generic ranking function.

```ts
export function rankDays(
  days: ForecastDay[],
  scorer: ActivityScorer,
): RankedActivityDay[]
```

Algorithm:

```text
for each day
    score day

sort:
    1. available before unavailable
    2. score descending
    3. localDate ascending for ties

return all seven days
```

Do not mutate the original `ForecastDay[]` while ranking different activities.

Use a copy before sorting.

---

## 29. RecommendationService

`RecommendationService.getRankings(locationId)` should:

1. validate/load the location;
2. retrieve the forecast through `ForecastService`;
3. invoke all four scorers for the seven forecast days;
4. rank results independently per activity;
5. map the domain result to the GraphQL response shape.

The service should not know how Redis or PostgreSQL work.

Conceptually:

```text
Location
   ↓
ForecastService
   ↓
ForecastDay[]
   ↓
┌─────────────┬────────────┬──────────────┬──────────────┐
│ Skiing      │ Surfing    │ Outdoor      │ Indoor       │
│ scorer      │ scorer     │ scorer       │ scorer       │
└─────────────┴────────────┴──────────────┴──────────────┘
   ↓
rank seven days per activity
   ↓
response DTO
```

---

## 30. Stale Response Metadata

The GraphQL response needs only:

```ts
{
  fetchedAt: forecast.fetchedAt.toISOString(),
  stale: isStale(forecast, now),
}
```

When the provider refresh succeeds:

```text
stale = false
```

When a usable stale fallback is returned:

```text
stale = true
```

Do not hide the fact that stale data was served.

---

## 31. Time Handling

Create `src/shared/time.ts` with testable helpers.

Example:

```ts
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
```

Freshness should accept the current time explicitly or receive a `Clock` dependency.

Do not spread direct `new Date()` calls throughout scoring/application logic.

For local forecast dates, trust the provider response requested with the selected IANA timezone.

Do not reinterpret the date using the server's timezone.

---

## 32. Logging

Use structured logs with fields rather than interpolated strings.

Log at minimum:

```text
GraphQL operation
locationId
cache hit/miss
forecast freshness
provider request success/failure
provider request duration
refresh success/failure
stale fallback usage
unexpected errors
```

Never log secrets.

For this exercise, do not add a full observability platform integration.

---

## 33. Health/Startup Behaviour

Startup sequence:

```text
load config
 ↓
create logger
 ↓
create Prisma client
 ↓
create Redis client
 ↓
construct providers/repositories/services
 ↓
start Apollo Server
```

Do not make the application startup call Open-Meteo.

Do not preload or refresh every location at startup.

Graceful shutdown should close:

```text
Apollo/HTTP server
Redis connection
Prisma connection
```

Handle `SIGINT` and `SIGTERM`.

---

## 34. npm Scripts

Use scripts approximately as follows:

```json
{
  "scripts": {
    "dev": "tsx src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "test": "mocha --import tsx \"tests/**/*.test.ts\"",
    "test:unit": "mocha --import tsx \"tests/unit/**/*.test.ts\"",
    "test:integration": "mocha --import tsx \"tests/integration/**/*.test.ts\"",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:migrate:deploy": "prisma migrate deploy"
  }
}
```

Add scripts only when they map to real implementation work.

---

## 35. TypeScript Configuration

Use strict TypeScript settings.

Minimum expectations:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

Keep import style consistent with the selected Node/TypeScript module configuration.

---

## 36. Mocha Configuration

Use Mocha with TypeScript execution through `tsx`.
Use Chai for assertions and Sinon for mocks, stubs, and spies where required.

Keep unit and integration tests easy to distinguish by path.

Example test roots:

```text
tests/unit/**
tests/integration/**
```

Use a simple `.mocharc.json` configuration equivalent to:

```json
{
  "extension": ["ts"],
  "spec": ["tests/**/*.test.ts"],
  "import": ["tsx"]
}
```

Unit tests should not require Docker.

Integration tests may require PostgreSQL/Redis from Docker Compose or CI service containers.

---

## 37. Unit Test Priorities

The highest-value unit tests are:

### Scoring

- skiing component calculations;
- surfing unavailable when marine data is absent;
- outdoor scoring;
- indoor scoring;
- final score clamping/rounding.

### Forecast freshness

Test boundary conditions exactly:

```text
5h 59m → fresh
6h     → stale
23h 59m → stale
24h     → expired
```

### Ranking

Test:

- descending score;
- unavailable after available;
- earlier date wins ties;
- all seven days retained.

### Provider mapping

Test deterministic mapping from representative Open-Meteo fixtures to domain `ForecastDay` values.

### Error mapping

Test every application error maps to the expected GraphQL code.

---

## 38. Integration Tests

### PostgreSQL

Test:

- location upsert;
- location lookup;
- snapshot creation;
- seven day persistence;
- latest snapshot retrieval;
- retention deletion;
- transaction rollback behaviour.

### Redis

Test:

- set/get forecast;
- set/get location search result;
- key construction;
- cache miss;
- serialization/deserialization.

Do not make integration tests depend on the live Open-Meteo service.

---

## 39. GraphQL Integration Tests

Use Apollo Server's operation execution support rather than starting an actual network server for every test.

Cover:

```text
searchLocations with valid input
searchLocations with empty input
multiple location candidates
activityRankings with known locationId
activityRankings with unknown locationId
fresh cache path
fresh database fallback path
refresh success
stale fallback
expired forecast failure
marine unavailable → surfing NOT_AVAILABLE
all four activities present
exactly seven ranked days per activity
```

Use deterministic mocked providers.

---

## 40. Test Fixtures

Create reusable Open-Meteo fixtures under:

```text
tests/fixtures/open-meteo/
├── geocoding.json
├── weather.json
└── marine.json
```

Also create:

```text
tests/fixtures/forecast.ts
```

for normalized domain fixtures.

Fixtures should include:

- a normal seven-day forecast;
- an unusually wet forecast;
- missing marine data;
- a provider payload with malformed/missing required daily weather data for negative-path tests.

Do not use current live weather responses as test fixtures.

---

## 41. Mocking Rules

Mock at architectural boundaries.

### Unit tests

Mock:

- repositories;
- cache;
- weather provider;
- marine provider;
- clock.

Do not mock pure scoring helpers.

### Integration tests

Use real:

- PostgreSQL;
- Redis.

Mock external Open-Meteo providers.

This keeps the tests focused on the boundaries actually being tested.

---

## 42. Docker Compose

Provide local PostgreSQL and Redis dependencies.

Use a Compose file similar to:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: weather
      POSTGRES_USER: weather
      POSTGRES_PASSWORD: weather
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U weather -d weather"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10

  app:
    build: .
    environment:
      NODE_ENV: development
      PORT: 4000
      DATABASE_URL: postgresql://weather:weather@postgres:5432/weather
      REDIS_URL: redis://redis:6379
      OPEN_METEO_GEOCODING_BASE_URL: https://geocoding-api.open-meteo.com
      OPEN_METEO_WEATHER_BASE_URL: https://api.open-meteo.com
      OPEN_METEO_MARINE_BASE_URL: https://marine-api.open-meteo.com
      OPEN_METEO_TIMEOUT_MS: 5000
    ports:
      - "4000:4000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
```

The app container may run Prisma migrations before starting the server.

For local development without the app container, developers can run only PostgreSQL/Redis and start Node with `npm run dev`.

---

## 43. Dockerfile

Use a small production-oriented multi-stage build.

Stages:

```text
base
 ↓
dependencies
 ↓
builder
 ↓
production
```

Build stage responsibilities:

- install dependencies;
- generate Prisma client;
- compile TypeScript.

Production stage responsibilities:

- copy production dependencies;
- copy Prisma schema/migrations;
- copy compiled `dist`;
- expose application port;
- run migrations before startup.

Do not put secrets into the Docker image.

---

## 44. README Requirements

The final README must contain:

1. Problem statement.
2. Architecture summary.
3. Prerequisites.
4. Local setup.
5. Environment variables.
6. Database/Redis startup.
7. Prisma migration command.
8. How to run the API.
9. Sample `searchLocations` query.
10. Sample `activityRankings` query.
11. Example response.
12. Freshness/stale behaviour.
13. Scoring caveat: planning guidance, not safety guarantee.
14. Testing commands.
15. Known limitations.
16. Design docs links.

Keep the README short enough to read quickly.

The detailed reasoning remains in the design documents and commit history.

---

## 45. Sample GraphQL Queries

### Search

```graphql
query SearchLocations {
  searchLocations(query: "London") {
    id
    name
    country
    countryCode
    region
    latitude
    longitude
    timezone
  }
}
```

### Rankings

```graphql
query ActivityRankings {
  activityRankings(locationId: "REPLACE_WITH_LOCATION_ID") {
    location {
      id
      name
      country
      region
      latitude
      longitude
      timezone
    }
    forecast {
      fetchedAt
      stale
    }
    skiing {
      days {
        date
        score
        availability
      }
    }
    surfing {
      days {
        date
        score
        availability
      }
    }
    outdoorSightseeing {
      days {
        date
        score
        availability
      }
    }
    indoorSightseeing {
      days {
        date
        score
        availability
      }
    }
  }
}
```

---

## 46. CI/CD

Create `.github/workflows/ci.yml`.

The workflow should:

```text
checkout
 ↓
setup Node
 ↓
npm ci
 ↓
npm run prisma:generate
 ↓
npm run typecheck
 ↓
npm run lint
 ↓
npm run format:check
 ↓
npm run test
 ↓
npm run build
```

For integration tests, provide PostgreSQL and Redis service containers and run Prisma migrations before the integration suite.

Do not add deployment infrastructure for EKS/ECS/Terraform in the take-home unless the candidate explicitly chooses to extend the submission later. It is outside the current implementation scope.

---

## 47. Git Workflow

The submission is intentionally expected to show development reasoning.

Use small meaningful commits.

Recommended sequence:

```text
1. bootstrap project
2. add Prisma schema/migration
3. add domain models + scorers
4. add provider adapters
5. add repositories/cache
6. add application services
7. add GraphQL API
8. add tests
9. add Docker + local setup
10. add CI + README
```

Do not squash away the development trail merely to make the history look artificially perfect.

Commit messages should explain what changed:

```text
feat: add forecast persistence model
feat: add deterministic activity scoring
feat: add on-demand forecast refresh
fix: serve stale forecast when provider refresh fails
```

---

## 48. Coding Conventions

Prefer:

- small classes with one responsibility;
- explicit types at public boundaries;
- `readonly` dependencies;
- early validation;
- pure functions for scoring/ranking;
- explicit error types;
- async/await;
- `Promise.allSettled` where partial failure is intentional;
- immutable domain snapshots;
- mapping functions between layers.

Avoid:

- giant service classes;
- GraphQL logic mixed with domain logic;
- raw Prisma queries scattered across the app;
- direct Redis access from resolvers;
- provider-specific types in domain models;
- hidden retries;
- global mutable state except the deliberate per-process refresh map;
- speculative framework abstractions.

---

## 49. Security/Operational Basics

Even though authentication is out of scope:

- validate query input;
- apply a sensible location query length limit;
- do not log secrets;
- do not expose internal stack traces;
- use parameterized database access through Prisma;
- do not construct SQL from user input;
- use explicit upstream timeouts.

Rate limiting, authentication, authorization, API keys, and user accounts remain out of scope.

---

## 50. Behavioural Acceptance Checklist

The implementation is complete only when all of the following hold.

### Location

- [ ] Search returns selectable candidates.
- [ ] Candidates receive stable service-owned IDs.
- [ ] Multiple matching places are not silently collapsed.
- [ ] Repeated searches can use Redis.

### Forecast

- [ ] Exactly seven local dates are persisted and returned.
- [ ] Local timezone comes from the resolved location.
- [ ] Fresh data does not call Open-Meteo again.
- [ ] Stale data triggers an on-demand refresh.
- [ ] Refresh success creates a new immutable snapshot.
- [ ] Refresh failure with usable stale data returns stale data.
- [ ] Forecast age >=24h is not served.
- [ ] Older snapshots are retained only for the configured history window.

### Activities

- [ ] Skiing is scored deterministically.
- [ ] Surfing uses marine data when available.
- [ ] Missing marine data produces `NOT_AVAILABLE`, not score 0.
- [ ] Outdoor sightseeing is scored independently.
- [ ] Indoor sightseeing is scored independently.

### Ranking

- [ ] Each activity contains all seven dates.
- [ ] Higher scores rank first.
- [ ] Unavailable entries come after available entries.
- [ ] Equal scores use earlier date first.

### API/errors

- [ ] Invalid input has a stable GraphQL error code.
- [ ] Unknown location IDs have a stable GraphQL error code.
- [ ] Provider failure is handled intentionally.
- [ ] Internal errors do not leak implementation details.

### Infrastructure

- [ ] PostgreSQL works without Redis.
- [ ] Redis failure does not invalidate correct database-backed requests.
- [ ] Provider integrations are isolated behind interfaces.
- [ ] Application services do not know Prisma/Redis/Open-Meteo details.

### Tests

- [ ] Core scoring rules have unit tests.
- [ ] Freshness boundary conditions have unit tests.
- [ ] Ranking/tie-breaking has unit tests.
- [ ] Provider mapping has fixture-based tests.
- [ ] Repository/Redis integration tests exist.
- [ ] GraphQL integration tests cover the important request paths.

---

## 51. Explicit Non-Goals

Do not implement these for the initial submission:

- frontend/UI;
- authentication/authorization;
- user accounts;
- saved trips;
- personalized recommendations;
- activity/resort availability;
- real-time weather alerts;
- proactive refresh for every location;
- scheduled/background job infrastructure;
- Kafka/SQS;
- distributed locking;
- multi-region deployment;
- Kubernetes/EKS/ECS infrastructure;
- Terraform deployment stack;
- admin CRUD for score configuration;
- score explanation fields in the public GraphQL contract;
- full DataDog integration;
- database analytics/reporting.

These can be discussed as future extensions during the technical interview, but should not distract from the focused submission.

---

## 52. Codex Guardrails

Codex should implement the approved design, not redesign it.

### Do

- follow the folder structure;
- implement interfaces before infrastructure adapters where practical;
- keep domain logic pure;
- keep snapshots immutable;
- write tests alongside meaningful functionality;
- use deterministic fixtures;
- update README setup instructions as the implementation evolves;
- keep the public GraphQL contract stable.

### Do not

- switch PostgreSQL to MongoDB;
- remove Redis because the local implementation is simpler;
- make Redis the source of truth;
- add a second API style without need;
- add an admin API for scoring;
- expose score factors in the MVP;
- silently choose a location from ambiguous search results;
- call Open-Meteo directly from resolvers/scorers;
- add a framework merely to provide dependency injection;
- introduce asynchronous infrastructure such as queues/jobs for the first version;
- broaden the scope because a production system could be more sophisticated.

### Required when a conflict appears

If the implementation discovers that a specific technical detail conflicts with the HLD/LLD:

```text
STOP
↓
identify the conflict
↓
state the smallest viable resolution
↓
ask for approval / record the approved decision
↓
continue implementation
```

Never silently change a design decision just because another implementation happens to be easier.

---

## 53. Definition of Done

The take-home is ready for review when:

```text
requirements
    ✓
HLD
    ✓
LLD
    ✓
decisions
    ✓
implementation
    ✓
tests
    ✓
README
    ✓
local Docker setup
    ✓
CI checks
    ✓
```

The final repository should tell a coherent story:

```text
What are we building?
    → requirements.md

What does the system look like?
    → hld.md

How do the components behave?
    → lld.md

Why were these choices made?
    → decisions.md

Exactly how is it implemented?
    → implementations.md
```

The code should then be a direct, reviewable realization of those decisions rather than a second source of architecture.
