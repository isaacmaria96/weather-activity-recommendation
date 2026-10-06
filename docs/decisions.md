# Design Decisions

This document records the key design decisions made during the design of the Weather Activity Recommendation Service.

| ID | Decision | Status |
|---|---|---|
| 001 | PostgreSQL over MongoDB | Accepted |
| 002 | Redis as performance cache | Accepted |
| 003 | On-demand forecast refresh | Accepted |
| 004 | Score-only MVP | Accepted |
| 005 | Public location search | Accepted |
| 006 | Two-step `locationId` flow | Accepted |
| 007 | 6h freshness / 24h stale fallback | Accepted |
| 008 | Versioned Redis cache namespace | Accepted |
| 009 | Mocha + Chai + Sinon for testing | Accepted |
| 010 | MVP activity scoring heuristics | Accepted |

---

## 001 — PostgreSQL over MongoDB

**Decision**

Use PostgreSQL as the durable data store.

**Why**

The service has clear relationships between locations, forecast snapshots, and forecast days. A relational model keeps those relationships explicit and supports the required persistence and retention behaviour.

**Trade-off**

A document store could represent provider responses more directly, but it is not necessary for the scope of this exercise.

---

## 002 — Redis as Performance Cache

**Decision**

Use Redis as a shared performance cache in front of PostgreSQL.

**Why**

Repeated requests for the same location can avoid database and provider calls, reducing latency and unnecessary upstream traffic.

**Important constraint**

Redis is not the source of truth. PostgreSQL remains durable storage, so Redis eviction or unavailability must not invalidate the application.

**Trade-off**

Redis adds infrastructure and operational complexity. The design therefore keeps the application correct without depending on Redis for persistence.

---

## 003 — On-Demand Forecast Refresh

**Decision**

Refresh stale forecasts on demand when a ranking request arrives.

**Why**

The exercise requires persisted forecast data but does not require proactive refresh infrastructure. On-demand refresh keeps the implementation focused.

**Trade-off**

The first request after a forecast becomes stale may incur the upstream provider latency.

**Future consideration**

A scheduled or background refresh mechanism can be introduced when actual usage patterns justify it.

---

## 004 — Score-Only MVP

**Decision**

Return a deterministic suitability score in the initial GraphQL API without exposing score-contributing factors.

**Why**

The core requirement is to rank the next seven days for each activity. Keeping the MVP focused reduces API and implementation complexity.

**Design implication**

The scoring implementation remains structured and deterministic so that score factors can be exposed in a later iteration without redesigning the core scoring engine.

---

## 005 — Public Location Search

**Decision**

Expose location search as a public GraphQL query.

```graphql
searchLocations(query: String!): [LocationCandidate!]!
```

**Why**

A city name can match multiple real-world locations. Returning candidates allows the caller to choose the intended location instead of the service silently making that decision.

**Trade-off**

This creates a two-step client interaction, but gives the API an unambiguous location-selection flow.

---

## 006 — Two-Step `locationId` Flow

**Decision**

Use a service-issued opaque `locationId` for subsequent ranking requests.

```graphql
searchLocations(query: String!)
activityRankings(locationId: ID!)
```

**Why**

The location search resolves the human-readable query into a specific geographic location. The ranking API then operates on that stable selection rather than accepting free-text or arbitrary coordinates.

**Benefits**

- avoids ambiguous location resolution during ranking;
- provides a stable cache key;
- separates location discovery from forecast retrieval;
- keeps the ranking API contract simple.

---

## 007 — 6h Freshness / 24h Stale Fallback

**Decision**

Use the following forecast freshness policy:

```text
< 6 hours      → fresh
6–24 hours     → stale but usable
>= 24 hours    → expired
```

**Why**

The service should avoid unnecessary provider requests while still providing reasonably current data during temporary upstream failures.

**Behaviour**

- Fresh data can be returned directly.
- Stale data triggers an attempted provider refresh.
- If refresh fails and the persisted forecast is less than 24 hours old, return the stale forecast.
- If no usable forecast exists, return `FORECAST_UNAVAILABLE`.

**Trade-off**

Users may temporarily receive forecast data that is older than the target freshness window during an upstream outage, but the service remains useful rather than failing unnecessarily.

---

## Decision Evolution

This document records the design as it stands after the initial requirements, HLD, and LLD work. Where a decision changes during implementation, update the decision and record the reason rather than silently changing the design.

---

## 008 — Versioned Redis Cache Namespace

**Decision**

Use versioned, namespaced Redis keys:

```text
weather-activity:v1:forecast:{locationId}
weather-activity:v1:location-search:{normalizedQuery}
```

**Why**

Cached values represent application/domain data rather than GraphQL responses. Versioning the cache representation allows incompatible serialized-data changes to be introduced without attempting to read old values using the new model.

**Design implication**

The cache version is independent of GraphQL/API versioning. A change to the cached representation increments the cache version.

**Trade-off**

Old cache entries remain until their TTL expires or are explicitly invalidated when the version changes.

---

## 009 — Mocha + Chai + Sinon for Testing

**Decision**

Use Mocha for test execution, Chai for assertions, and Sinon for mocks, stubs, and spies where required.

**Why**

This is a mature TypeScript/Node.js testing stack and matches existing production experience, reducing unnecessary tooling and learning overhead while providing everything required for unit, integration, and GraphQL tests.

**Trade-off**

Unlike Jest, mocking is not built into the test runner, so Sinon is used where mocking or spying is required.

---

## 010 — MVP Activity Scoring Heuristics

**Decision**

Use simple deterministic piecewise scoring tables for MVP activity scoring where the requirements, HLD, LLD, and implementation guide define dimensions and weights but not exact component thresholds.

**Why**

The approved design requires deterministic scores for skiing, surfing, outdoor sightseeing, and indoor sightseeing. It explicitly defines each activity's scoring dimensions and weights, but only partially defines component threshold tables. The MVP needs complete, testable component scoring without adding new dimensions or pretending the thresholds are scientifically calibrated.

**Behaviour**

The implementation preserves the approved weights:

- Skiing: snowfall 40%, temperature 30%, wind 20%, rain/severity 10%.
- Surfing: wave height 40%, wave period 30%, swell/structure 15%, wind 15%.
- Outdoor sightseeing: precipitation 35%, temperature 30%, wind 20%, sunshine/severity 15%.
- Indoor sightseeing: precipitation 40%, temperature 25%, wind 20%, severity 15%.

Missing required inputs produce `NOT_AVAILABLE` with `score = null`. Missing marine data makes surfing unavailable. Scores remain bounded to 0-100.

**Assumption**

The component thresholds are implementation assumptions for the MVP. They are intentionally simple and deterministic, and should be revisited with product/domain input before treating them as calibrated recommendations.
