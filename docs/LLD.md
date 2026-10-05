# Low-Level Design

## 1. Purpose

This document defines the concrete design needed to implement the approved High-Level Design.

It focuses on contracts, domain models, persistence relationships, provider boundaries, caching behaviour, forecast refresh behaviour, scoring, error handling, and testing.

Implementation-specific details such as exact file names, package versions, environment variables, Docker commands, and coding conventions will be defined separately in the implementation guide used for Codex.

---

## 2. Design Principles

- Keep GraphQL resolvers thin.
- Keep business and scoring logic independent of infrastructure.
- Treat PostgreSQL as the durable source of truth.
- Treat Redis as a performance cache only.
- Hide external weather providers behind capability-based interfaces.
- Keep forecast snapshots immutable.
- Make scoring deterministic and independently testable.
- Fail explicitly when required forecast data is unavailable.
- Keep the implementation proportional to the exercise.

---

## 3. Logical Boundaries

```text
GraphQL API
    ↓
Application Services
    ↓
Domain Logic
    ↑
Infrastructure Adapters
```

### GraphQL API

Owns the public GraphQL contract, resolver wiring, API-level validation, and mapping application errors to GraphQL errors.

### Application Services

Own use-case orchestration, including location search, forecast retrieval, freshness/refresh behaviour, ranking, and coordination between repositories, cache, and providers.

### Domain

Owns normalized models, scoring rules, and ranking logic.

The domain does not depend on GraphQL, Prisma, Redis, or provider-specific response models.

### Infrastructure

Owns PostgreSQL persistence, Redis caching, provider integrations, and provider-specific mappings.

---

## 4. GraphQL Contract

The MVP exposes two queries:

```graphql
type Query {
  searchLocations(query: String!): [LocationCandidate!]!
  activityRankings(locationId: ID!): ActivityRankingResponse!
}
```

### Location candidate

```graphql
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
```

### Ranking response

```graphql
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

### Contract rules

- `date` is an ISO `YYYY-MM-DD` local date.
- `score` is `0..100` when available.
- `score` is `null` when unavailable.
- Each activity returns the seven local dates.
- Days are ranked from highest score to lowest score.
- Equal scores are resolved by earlier date first.
- `stale=true` identifies a forecast older than six hours but still usable within the 24-hour degraded-service window.
- Score-contributing factors are not exposed in the MVP.

---

## 5. Resolver and Service Boundaries

```text
searchLocations()
    ↓
LocationService

activityRankings()
    ↓
RecommendationService
```

Resolvers must not contain:

- scoring logic.
- provider calls.
- database queries.
- Redis access.
- refresh/retry/fallback logic.

---

## 6. Domain Model

### Location

```text
Location
- id
- name
- country
- countryCode
- region
- latitude
- longitude
- timezone
```

The service-issued `id` is opaque to API clients.

Provider-specific identifiers remain outside the core domain and are kept in the infrastructure/persistence boundary where required for provider record identity and deduplication.

### Forecast

```text
Forecast
- snapshotId
- locationId
- fetchedAt
- weatherAvailable
- marineAvailable
- days[]
```

### ForecastDay

A normalized representation of one local forecast date containing only the weather and marine values required by the scoring rules.

```text
ForecastDay
- localDate
- temperature
- precipitation
- rain
- snowfall
- wind
- weatherCode
- sunshine
- marine conditions where available
```

The application uses normalized names and units rather than provider-specific fields.

---

## 7. Persistence Model

### Relationships

```text
Location
   │
   │ 1:N
   ▼
ForecastSnapshot
   │
   │ 1:N
   ▼
ForecastDay
```

### Location

Persists:

- resolved location identity.
- provider identity needed for deduplication.
- display information.
- coordinates.
- timezone.

### ForecastSnapshot

Represents one persisted forecast fetch for a location.

It records the fetch timestamp and availability of weather/marine data.

Snapshots are immutable. A refresh creates a new snapshot instead of modifying an existing one.

### ForecastDay

Contains one normalized row for each local forecast date within a snapshot.

A snapshot must not contain duplicate local dates.

The exact relational columns, constraints, indexes, and Prisma representation are implementation details and belong in the Codex implementation guide.

---

## 8. Forecast Data Contract

The application requests only forecast fields required by the scoring algorithms.

### Weather data

The normalized weather contract supports:

```text
minimum temperature
maximum temperature
maximum precipitation probability
precipitation sum
rain sum
snowfall sum
maximum wind speed
weather code
sunshine duration
```

### Marine data

The normalized marine contract supports:

```text
maximum wave height
maximum wave period
maximum wind-wave height
maximum swell height
maximum swell period
```

Daily values are used because the product ranks days rather than individual hours.

If a future requirement needs "best time of day", hourly data can be introduced without changing the GraphQL concept of a seven-day ranking.

---

## 9. Provider Abstraction

The application depends on weather capabilities, not directly on Open-Meteo.

### Location provider

```ts
interface LocationProvider {
  searchLocations(query: string): Promise<ProviderLocation[]>;
}
```

### Weather provider

```ts
interface WeatherProvider {
  getDailyForecast(
    request: WeatherForecastRequest
  ): Promise<ProviderWeatherForecast>;
}
```

### Marine provider

```ts
interface MarineProvider {
  getDailyForecast(
    request: MarineForecastRequest
  ): Promise<ProviderMarineForecast>;
}
```

The current infrastructure implementation uses Open-Meteo adapters:

```text
LocationProvider
      ↑
OpenMeteoLocationProvider

WeatherProvider
      ↑
OpenMeteoWeatherProvider

MarineProvider
      ↑
OpenMeteoMarineProvider
```

The application and scoring layers therefore remain independent of the current weather provider.

Provider-specific response formats are mapped into normalized application models before reaching the domain.

---

## 10. Location Search

```text
searchLocations(query)
       │
       ├── normalize input
       │
       ├── optional Redis lookup
       │
       ├── cache hit ───────────────► return candidates
       │
       └── cache miss
              │
              ▼
        LocationProvider
              │
              ▼
        normalize candidates
              │
              ▼
        upsert persisted locations
              │
              ▼
        optionally cache candidates
              │
              ▼
        return candidates
```

Rules:

- Trim whitespace.
- Return no candidates for empty/whitespace-only input without calling the provider.
- Apply a reasonable maximum query length to non-empty input.
- Do not silently choose one result when several candidates are plausible.
- The service-issued `locationId` is used by subsequent ranking requests.

The persistence upsert uses the provider identity to avoid duplicate location records.

---

## 11. Redis Cache Design

Redis is a performance cache and is not the source of truth.

The high-level cache model is:

```text
Redis
  ↓ cache miss
PostgreSQL
  ↓ stale/missing
Weather providers
```

### Forecast cache

The key is versioned at the cache representation level, not at the GraphQL endpoint level.

Conceptually:

```text
weather-activity:v1:forecast:{locationId}
```

The cached forecast includes enough metadata to identify the snapshot and determine its age.

### Location-search cache

Conceptually:

```text
weather-activity:v1:location-search:{normalizedQuery}
```

### Cache behaviour

- Fresh cached data can be returned without querying PostgreSQL or the providers.
- Redis eviction does not change forecast freshness semantics.
- PostgreSQL remains the fallback when Redis is empty or unavailable.
- Cache failures should not fail an otherwise successful request.

Exact TTLs and serialization belong in the implementation guide.

---

## 12. Forecast Retrieval and Refresh

Forecast freshness is defined as:

```text
< 6 hours      → fresh
6–24 hours     → stale but usable
>= 24 hours    → expired
```

The retrieval flow is:

```text
1. Validate/load location.
2. Check Redis.
3. Fresh cache → return.
4. On cache miss/stale cache, load latest DB snapshot.
5. Fresh DB snapshot → populate cache and return.
6. Stale DB snapshot → attempt provider refresh.
7. Refresh succeeds → persist new snapshot, update cache, return.
8. Refresh fails with usable stale data → return stale data.
9. No usable forecast → return FORECAST_UNAVAILABLE.
```

A successful refresh creates a new immutable snapshot.

---

## 13. Partial Provider Failure

Weather and marine data are independent capabilities.

Expected behaviour:

```text
Weather ✅  Marine ✅
→ full result

Weather ✅  Marine ❌
→ weather-based activities available
→ surfing unavailable

Weather ❌  Marine ✅
→ required weather forecast unavailable
→ service error

Weather ❌  Marine ❌
→ service error
```

Missing marine data is represented as:

```text
availability = NOT_AVAILABLE
score = null
```

It is not treated as a zero-quality weather day.

---

## 14. Refresh Concurrency

Multiple requests may observe the same stale location.

For the initial single-process implementation, a per-location single-flight mechanism prevents duplicate provider refreshes:

```text
locationId → in-flight refresh
```

Conceptually:

```text
Request A ─┐
Request B ─┼── stale location
Request C ─┘
              ↓
       one refresh operation
              ↓
         shared result
```

A distributed lock is not required for the initial implementation and can be introduced if the service is later deployed across multiple application instances.

---

## 15. Scoring Contract

```ts
type Activity =
  | "SKIING"
  | "SURFING"
  | "OUTDOOR_SIGHTSEEING"
  | "INDOOR_SIGHTSEEING";

type Availability =
  | "AVAILABLE"
  | "NOT_AVAILABLE";

type ActivityScore = {
  score: number | null;
  availability: Availability;
};

interface ActivityScorer {
  readonly activity: Activity;
  score(day: ForecastDay): ActivityScore;
}
```

Scorers are pure domain functions.

They do not depend on GraphQL, PostgreSQL, Redis, HTTP, external providers, or system time.

---

## 16. Initial Scoring Model

The scoring model is deterministic and rule-based.

The thresholds and weights are product heuristics for this exercise, not safety guarantees or scientifically validated recommendations.

Each weather input is converted into a component score in the `0..100` range before weighted aggregation.

### Skiing

Inputs:

```text
snowfall
temperature
wind
rain/weather severity
```

Illustrative weighting:

```text
Snowfall          40%
Temperature       30%
Wind              20%
Rain/severity     10%
```

### Surfing

Requires marine data.

Inputs:

```text
wave height
wave period
swell/wind-wave conditions
wind
```

Illustrative weighting:

```text
Wave height       40%
Wave period       30%
Swell/structure   15%
Wind              15%
```

If required marine data is unavailable:

```text
score = null
availability = NOT_AVAILABLE
```

### Outdoor sightseeing

Inputs:

```text
precipitation
temperature
wind
sunshine/weather severity
```

Illustrative weighting:

```text
Precipitation     35%
Temperature       30%
Wind              20%
Sunshine/severity 15%
```

### Indoor sightseeing

Inputs:

```text
precipitation
temperature extremes
wind
severe weather
```

Illustrative weighting:

```text
Precipitation     40%
Temperature       25%
Wind              20%
Severity           15%
```

Indoor suitability is independently calculated rather than `100 - outdoorScore`.

---

## 17. Ranking

For each activity:

1. Score all seven forecast days.
2. Keep the local date.
3. Sort available results by descending score.
4. Place unavailable results after available results.
5. Resolve equal scores using the earlier local date.

All seven dates remain in the API response.

---

## 18. Application Services

### LocationService

```ts
interface LocationService {
  search(query: string): Promise<LocationCandidate[]>;
}
```

Coordinates location normalization, provider lookup, persistence, and location-search caching.

### ForecastService

```ts
interface ForecastService {
  getForecast(location: Location): Promise<Forecast>;
}
```

Coordinates cache lookup, freshness evaluation, provider refresh, stale fallback, and snapshot persistence.

### RecommendationService

```ts
interface RecommendationService {
  getRankings(
    locationId: string
  ): Promise<ActivityRankingResponse>;
}
```

Coordinates location validation, forecast retrieval, scoring, ranking, and response construction.

---

## 19. Repository Contracts

### LocationUpsert

`LocationUpsert` is the application-facing persistence input used when persisting provider-resolved locations.

```ts
type LocationUpsert = {
  provider: string;
  providerLocationId: string;
  name: string;
  country: string;
  countryCode?: string;
  region?: string;
  latitude: number;
  longitude: number;
  timezone: string;
};
```

`ProviderLocation` remains provider-specific and must not leak into the repository contract.

The location persistence flow is:

```text
ProviderLocation
      ↓
provider adapter / application mapper
      ↓
LocationUpsert
      ↓
LocationRepository
      ↓
PostgreSQL
```

### LocationRepository

```ts
interface LocationRepository {
  findById(id: string): Promise<Location | null>;

  upsertCandidates(
    candidates: LocationUpsert[]
  ): Promise<Location[]>;
}
```

### ForecastRepository

```ts
interface ForecastRepository {
  findLatest(locationId: string): Promise<Forecast | null>;

  createSnapshot(
    forecast: Forecast
  ): Promise<Forecast>;

  deleteOlderThan(
    locationId: string,
    cutoff: Date
  ): Promise<void>;
}
```

The repositories hide PostgreSQL/Prisma details from application services.

---

## 20. Error Model

Application errors are categorized as:

```text
InvalidInputError
LocationNotFoundError
ProviderUnavailableError
ForecastUnavailableError
PersistenceError
```

GraphQL maps these to stable public error codes:

```text
INVALID_INPUT
LOCATION_NOT_FOUND
UPSTREAM_UNAVAILABLE
FORECAST_UNAVAILABLE
INTERNAL_ERROR
```

Provider-specific stack traces and internal details are not returned to clients.

---

## 21. Persistence and Retention Behaviour

A successful refresh persists the snapshot and its daily records atomically.

Conceptually:

```text
BEGIN
  create snapshot
  create forecast days
  COMMIT
```

If persistence fails, the new snapshot is rolled back and the previous snapshot remains intact.

The requirements define a 30-day forecast history window. Older snapshots can be pruned as part of refresh/maintenance without affecting the current snapshot.

---

## 22. Testing Strategy

Testing is organized around the architectural boundaries.

### Unit tests

Prioritize:

- four activity scorers.
- scoring helpers.
- freshness calculation.
- ranking/tie-breaking.
- provider-to-domain mapping.
- error translation.

### Integration tests

Cover:

```text
Repository ↔ PostgreSQL
Cache ↔ Redis
Forecast persistence transaction
```

### GraphQL tests

Cover:

- location search.
- multiple candidates.
- invalid input.
- valid rankings.
- unknown location ID.
- fresh cache path.
- database fallback.
- refresh success.
- stale fallback.
- expired forecast failure.
- seven dates.
- four activities.

### Provider tests

Use deterministic fixtures/mocks rather than live weather data.

---

## 23. Design Outcome

The implementation should preserve these core boundaries:

```text
                    ┌─────────────────┐
                    │   GraphQL API   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   Application   │
                    │    Services     │
                    └────────┬────────┘
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
             Domain                 Abstractions
          Scoring/Rank               Repository
                                     Cache
                                     Providers
                ▲                         ▲
                │                         │
                └────────── Infrastructure┘
                            PostgreSQL
                            Redis
                            Provider adapters
```

The implementation guide will convert these contracts and behaviours into the concrete TypeScript project structure and code.

