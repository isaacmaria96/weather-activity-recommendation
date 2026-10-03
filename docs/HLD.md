# High-Level Design

## 1. Overview

The Weather Activity Recommendation Service is a TypeScript/Node.js GraphQL backend that:

1. Resolves a city or town through Open-Meteo's geocoding API.
2. Persists resolved locations locally and returns an opaque `locationId`.
3. Retrieves a seven-day forecast for a selected location.
4. Persists forecast snapshots rather than calling Open-Meteo for every client request.
5. Uses Redis as a short-lived application cache in front of PostgreSQL.
6. Calculates deterministic suitability scores for:
   - Skiing
   - Surfing
   - Outdoor sightseeing
   - Indoor sightseeing
7. Returns ranked days with deterministic suitability scores through GraphQL.

The design deliberately keeps the initial system focused on the coding challenge. Authentication, users, saved trips, proactive refresh jobs, and production-scale deployment infrastructure are out of scope.

---

## 2. Goals

### Functional goals

- Search for a city or town.
- Return selectable location candidates.
- Issue an opaque `locationId` for a selected location.
- Retrieve the next seven local calendar days for a location.
- Rank all seven days for each supported activity.
- Provide a numeric suitability score.
- Persist location and forecast data.
- Avoid calling Open-Meteo on every ranking request.
- Refresh stale forecast data.
- Gracefully handle temporary Open-Meteo failures.

### Non-functional goals

- Deterministic and testable scoring logic.
- Clear separation between API, application, domain, and infrastructure concerns.
- Low-latency repeated requests through caching.
- Resilience to temporary upstream failures.
- Simple local development and testing.
- Architecture that can evolve without prematurely introducing unnecessary infrastructure.

---

## 3. High-Level Architecture

```text
                              ┌──────────────────────┐
                              │        Client        │
                              └──────────┬───────────┘
                                         │
                                         │ GraphQL
                                         ▼
                              ┌──────────────────────┐
                              │     GraphQL API      │
                              │                      │
                              │ searchLocations()    │
                              │ activityRankings()   │
                              └──────────┬───────────┘
                                         │
                                         ▼
                              ┌──────────────────────┐
                              │  Application Layer   │
                              │                      │
                              │ Location Service     │
                              │ Forecast Service     │
                              │ Recommendation       │
                              │ Service              │
                              └───────┬───────┬──────┘
                                      │       │
                         cache lookup │       │ scoring
                                      │       ▼
                                      │  ┌───────────────┐
                                      │  │ Scoring Engine│
                                      │  │               │
                                      │  │ Skiing        │
                                      │  │ Surfing       │
                                      │  │ Outdoor       │
                                      │  │ Indoor        │
                                      │  └───────────────┘
                                      │
                                      ▼
                              ┌──────────────────┐
                              │      Redis       │
                              │ Short-lived cache│
                              └────────┬─────────┘
                                       │ cache miss
                                       ▼
                              ┌──────────────────┐
                              │   PostgreSQL      │
                              │                  │
                              │ Locations        │
                              │ Forecasts        │
                              │ Forecast snapshots│
                              └────────┬─────────┘
                                       │
                                       │ refresh when stale
                                       ▼
                              ┌──────────────────┐
                              │    Open-Meteo    │
                              │ Geocoding +       │
                              │ Weather/MARINE   │
                              └──────────────────┘
```

### Component responsibilities

| Component | Responsibility |
| --- | --- |
| GraphQL API | Expose the public contract, validate inputs, invoke application services, and map application errors to GraphQL errors. |
| Location Service | Resolve free-text locations through Open-Meteo, normalize candidates, persist them, and return stable location IDs. |
| Forecast Service | Retrieve forecasts from cache/database, determine freshness, refresh stale forecasts, and persist new snapshots. |
| Recommendation Service | Orchestrate forecast retrieval, scoring, ranking, and response construction. |
| Scoring Engine | Apply deterministic activity-specific rules to forecast data. It has no database or HTTP dependency. |
| Redis | Short-lived cache for frequently requested location/forecast data and potentially location-search results. |
| PostgreSQL | Source of persisted application data and forecast snapshots. |
| Open-Meteo Client | Encapsulate all external HTTP interaction with Open-Meteo APIs. |

---

## 4. Request Flow: Location Search

```text
Client
  │
  │ searchLocations("London")
  ▼
GraphQL Resolver
  │
  ▼
Location Service
  │
  ├── Redis lookup
  │      │
  │      └── cache hit ───────────────► return candidates
  │
  └── cache miss
         │
         ▼
    Open-Meteo Geocoding API
         │
         ▼
    Normalize candidates
         │
         ▼
    Persist locations
         │
         ▼
    Cache candidates
         │
         ▼
    Return candidates
```

The service does not silently select one location when multiple candidates match.

The client selects a candidate and receives/uses the service-issued `locationId` for subsequent ranking requests.

### Location caching

Location search results can be cached in Redis using a normalized query key, for example:

```text
location-search:london
```

This is an optimization and is independent of forecast freshness.

---

## 5. Request Flow: Activity Rankings

```text
Client
  │
  │ activityRankings(locationId)
  ▼
GraphQL Resolver
  │
  ▼
Recommendation Service
  │
  ▼
Location Repository
  │
  ├── unknown location ──────────────► GraphQL error
  │
  ▼
Forecast Service
  │
  ▼
Redis
  │
  ├── fresh cache hit ───────────────► Forecast
  │
  └── cache miss
         │
         ▼
     PostgreSQL
         │
         ├── fresh forecast ─────────► Cache + Forecast
         │
         └── stale/missing
                │
                ▼
           Open-Meteo
                │
                ├── success
                │      │
                │      ▼
                │   PostgreSQL
                │      │
                │      ▼
                │    Redis
                │      │
                │      ▼
                │   Forecast
                │
                └── failure
                       │
                       ▼
               Existing forecast
               < 24 hours old?
                    │
               ┌────┴────┐
              yes        no
               │          │
               ▼          ▼
         stale forecast  error
         + stale flag
```

After obtaining the forecast:

```text
Forecast
   │
   ▼
Scoring Engine
   │
   ├── Skiing scorer
   ├── Surfing scorer
   ├── Outdoor sightseeing scorer
   └── Indoor sightseeing scorer
   │
   ▼
Rank seven local dates per activity
   │
   ▼
GraphQL response
```

---

## 6. Cache Strategy

Redis is used as a performance optimization, not as the system of record.

### Cache hierarchy

The service uses:

```text
Redis
  ↓ cache miss
PostgreSQL
  ↓ stale/missing
Open-Meteo
```

This avoids unnecessary database reads for frequently requested locations while ensuring that persisted PostgreSQL data remains available if Redis is empty or restarted.

### Forecast freshness

The working requirement defines a six-hour freshness period.

A forecast is considered:

- **Fresh:** persisted less than six hours ago.
- **Stale but usable:** older than six hours but less than 24 hours old.
- **Expired:** 24 hours old or more.

Fresh data can be returned directly.

Stale data should trigger an attempted Open-Meteo refresh. If the refresh fails and the existing forecast is less than 24 hours old, it may be returned with a stale indicator.

Expired data is not silently presented as current forecast data.

### Redis TTL

Redis TTL should be aligned with the application freshness policy but should not be treated as the authoritative freshness mechanism.

The database timestamp remains the source used to determine whether the forecast itself is fresh.

This prevents an accidental Redis eviction from changing business semantics.

Redis is therefore a performance optimization, not a replacement for persistence. If Redis is unavailable or its entries are evicted, the application can fall back to PostgreSQL.

---

## 7. Persistence Model

PostgreSQL is the durable source of truth for persisted locations and forecast data.

At a high level, the data model consists of three related concepts:

```text
Location
   │
   └── ForecastSnapshot
          │
          └── ForecastDay
```

### Location

Represents a resolved city or town returned by the location search flow.

It contains the geographic identity needed to request and interpret forecasts, including the location name, coordinates, and timezone.

### Forecast Snapshot

Represents one forecast response fetched for a location at a particular point in time.

A snapshot provides the freshness boundary for the forecast and allows prior snapshots to be retained for the defined history period.

### Forecast Day

Represents the normalized weather data for one local calendar day within a forecast snapshot.

The detailed fields will depend on the weather variables required by the scoring rules.

### Persistence responsibility

PostgreSQL is responsible for durable persistence and remains usable when Redis is empty, evicted, or unavailable.

Redis is used only as a performance cache and does not replace these persisted records.

The detailed relational schema, primary/foreign keys, uniqueness constraints, indexes, nullable fields, retention implementation, and Prisma models are defined in the LLD.

---

## 8. Scoring Architecture

Scoring is deliberately isolated from external systems.

```text
ForecastDay
    │
    ├──► SkiingScorer
    │
    ├──► SurfingScorer
    │
    ├──► OutdoorSightseeingScorer
    │
    └──► IndoorSightseeingScorer
```

Each scorer receives normalized forecast data and produces an activity result containing:

```text
score: 0..100
availability: available | notAvailable
```

The initial API exposes the score only. The scoring implementation should remain structured enough that contributing factors can be exposed in a future iteration without redesigning the core scoring model.

The scoring functions should be deterministic:

```text
same forecast + same scoring rules
              ↓
        same result
```

This makes them straightforward to unit test and prevents scoring behavior from depending on infrastructure.

### Missing data

Missing data is not automatically converted into a bad score.

For example, if marine data required for surfing is unavailable:

```text
availability = notAvailable
```

rather than:

```text
score = 0
```

This preserves the distinction between "bad conditions" and "insufficient information."

The underlying reason can be logged/telemetried internally and exposed to clients as part of a future explainability iteration.

---

## 9. Ranking

For each activity:

1. Calculate a score for all seven forecast days.
2. Retain the local calendar date.
3. Sort descending by score.
4. Apply a deterministic tie-breaker, such as earlier local date first.

The API therefore returns all seven days, not only the highest-scoring day.

This supports both:

- choosing the best day
- comparing the entire upcoming week

---

## 10. Error Handling

### Invalid location ID

If the supplied `locationId` does not exist:

```text
GraphQL request
      ↓
Location lookup
      ↓
not found
      ↓
intentional GraphQL error
```

The service does not fall back to arbitrary coordinates or free-text lookup.

### Open-Meteo failure

The service distinguishes between:

- upstream failure with usable stale data
- upstream failure with no usable data

If usable stale data exists, return it with stale metadata and record the refresh failure in telemetry.

If no usable forecast exists, return an intentional service error rather than fabricating a result.

### Database failure

A database failure should be surfaced as an internal service error. Cached Redis data may still be usable if the request can be safely fulfilled without accessing PostgreSQL.

The exact fallback behavior will be constrained by the consistency requirements defined in the LLD.

---

## 11. External API Boundary

All Open-Meteo communication should be isolated behind an infrastructure client.

```text
Application Services
        │
        ▼
OpenMeteoClient
        │
        ├── Geocoding API
        ├── Weather API
        └── Marine API where applicable
```

Application/domain code should not construct raw HTTP requests directly.

Benefits:

- easier unit testing
- centralized timeout/error handling
- easier replacement of the provider
- clearer separation of concerns

The client should define explicit timeouts and translate provider-specific failures into application-level errors.

---

## 12. Observability

The initial implementation should provide structured logging around:

- GraphQL operation
- location ID
- forecast cache hit/miss
- forecast freshness
- Open-Meteo request success/failure
- refresh duration
- stale fallback usage
- unexpected errors

Metrics are intentionally limited for this exercise, but useful production metrics would include:

- Open-Meteo error rate
- Open-Meteo latency
- Redis hit rate
- forecast refresh rate
- stale fallback rate
- GraphQL request latency

No sensitive user information is expected in the current system.

---

## 13. Scalability Considerations

The initial design is intentionally simple and can run as a single Node.js application.

It can later scale horizontally:

```text
                    ┌── Application instance
Client → Load Balancer├── Application instance
                    └── Application instance
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
                  Redis             PostgreSQL
```

Redis provides a shared cache across application instances rather than relying on process-local memory.

PostgreSQL remains the durable source of truth.

Potential future improvements include:

- scheduled forecast refresh
- distributed locking for concurrent refreshes
- background job processing
- read replicas
- more sophisticated caching
- rate limiting
- circuit breaker behavior around Open-Meteo

These are not required for the initial implementation.

---

## 14. Out of Scope

The initial implementation does not include:

- Authentication/authorization
- User accounts
- Saved trips
- Personalized recommendations
- Frontend/UI
- Payments
- Activity/resort availability
- Real-time weather alerts
- Proactive refresh for every location
- Multi-region deployment
- Kubernetes/ECS infrastructure
- Full production monitoring stack

These can be considered future extensions if actual product requirements justify them.

---

## 15. Follow-up Design Work

The LLD should next define:

1. GraphQL schema and response types.
2. PostgreSQL/Prisma schema.
3. Redis key structure and TTLs.
4. Repository interfaces.
5. Open-Meteo client interfaces.
6. Forecast normalization model.
7. Scoring interfaces and concrete scoring rules.
8. Error types and GraphQL error mapping.
9. Test boundaries and integration-test strategy.
10. Exact module/package structure.

The implementation should follow the HLD while keeping the codebase proportional to the scope of the exercise.
