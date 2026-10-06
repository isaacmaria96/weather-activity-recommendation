# Weather Activity Recommendation

A TypeScript/Node.js GraphQL service that searches locations, retrieves a 7-day weather forecast, evaluates activity suitability, and ranks days for:

- Skiing
- Surfing
- Outdoor sightseeing
- Indoor sightseeing

The implementation is intentionally structured as a layered application with clear domain, application, infrastructure, and presentation boundaries.

## Current Implementation

The assignment is implemented through **Phase 3C — Core End-to-End Recommendation Flow**.

### Implemented

- Location search through Open-Meteo Geocoding
- PostgreSQL location persistence
- Redis location-search caching
- Weather forecast retrieval through Open-Meteo
- Marine forecast retrieval through Open-Meteo
- Normalized forecast model
- Immutable forecast snapshot persistence
- Activity scoring:
  - Skiing
  - Surfing
  - Outdoor sightseeing
  - Indoor sightseeing
- Activity ranking
- GraphQL API
- End-to-end recommendation flow
- Unit and integration-style tests

### Intentionally Not Implemented

The following are outside the current assignment phase:

- Forecast Redis caching
- Forecast freshness policy
- Stale forecast fallback
- Single-flight refresh
- Background refresh jobs
- Scheduled jobs
- Production deployment infrastructure
- Authentication/authorization
- Monitoring/observability infrastructure

These are deliberately left out rather than partially implemented.

---

# Architecture

The high-level request flow is:

```text
GraphQL
   │
   ▼
Resolver
   │
   ▼
RecommendationService
   │
   ├──────────────► LocationRepository ─────► PostgreSQL
   │
   ▼
ForecastService
   │
   ├──────────────► WeatherProvider ────────► Open-Meteo
   │
   ├──────────────► MarineProvider ─────────► Open-Meteo
   │
   ▼
ForecastRepository ─────────────────────────► PostgreSQL
   │
   ▼
Normalized Forecast
   │
   ▼
Activity Scorers
   │
   ▼
Ranking
   │
   ▼
GraphQL Response
```

Location search has a separate cache path:

```text
GraphQL
   │
   ▼
LocationResolver
   │
   ▼
LocationService
   │
   ├────► LocationSearchCache ─────► Redis
   │
   ├────► LocationProvider ─────────► Open-Meteo
   │
   └────► LocationRepository ───────► PostgreSQL
```

The domain layer does not depend on GraphQL, Prisma, Redis, Open-Meteo, or HTTP infrastructure.

---

# Prerequisites

Install the following:

- Node.js 22
- npm
- Docker Desktop

Verify Node:

```bash
node --version
```

Expected:

```text
v22.x.x
```

Verify Docker:

```bash
docker --version
```

---

# 1. Install Dependencies

From the project root:

```bash
npm install
```

---

# 2. Start PostgreSQL

The application expects PostgreSQL to be available on port `5432`.

You can run PostgreSQL directly with Docker:

```bash
docker run --name weather-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=weather_activity \
  -p 5432:5432 \
  -d postgres:16
```

Verify:

```bash
docker ps
```

If the container already exists:

```bash
docker start weather-postgres
```

---

# 3. Start Redis

Redis is used for location-search caching.

Start it with:

```bash
docker run --name weather-redis \
  -p 6379:6379 \
  -d redis:7
```

Verify:

```bash
docker ps
```

If the container already exists:

```bash
docker start weather-redis
```

You can verify Redis is responding:

```bash
docker exec -it weather-redis redis-cli ping
```

Expected:

```text
PONG
```

---

# 4. Configure Environment Variables

Create a `.env` file in the project root.

Example:

```env
NODE_ENV=development
PORT=4000

DATABASE_URL="postgresql://postgres:postgres@localhost:5432/weather_activity?schema=public"

REDIS_URL="redis://localhost:6379"

OPEN_METEO_GEOCODING_URL="https://geocoding-api.open-meteo.com"
OPEN_METEO_FORECAST_URL="https://api.open-meteo.com"
OPEN_METEO_MARINE_URL="https://marine-api.open-meteo.com"

OPEN_METEO_TIMEOUT_MS=10000
```

Do not commit `.env` or real credentials.

---

# 5. Generate Prisma Client

```bash
npx prisma generate
```

---

# 6. Apply Database Migrations

Run:

```bash
npx prisma migrate deploy
```

If this is a fresh development database and the project requires creating migrations rather than applying existing ones, follow the Prisma migration workflow already present in the repository.

---

# 7. Start the Application

Start the development server using the project's npm script:

```bash
npm run dev
```

The GraphQL endpoint should be:

```text
http://localhost:4000/graphql
```

If the configured port is different, use the port specified by `PORT`.

---

# GraphQL API

## Location Search

Example:

```graphql
query {
  searchLocations(query: "Mumbai") {
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

The response contains location candidates returned by the Open-Meteo geocoding provider and persisted through the location repository.

Whitespace-only searches return an empty array.

---

## Activity Recommendations

First search for a location and copy its `id`.

Then:

```graphql
query {
  activityRankings(locationId: "<LOCATION_ID>") {
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

Each activity returns its seven forecast days ranked by:

1. Availability
2. Score descending
3. Date ascending as the tie-breaker

Scores are nullable when the activity cannot be evaluated because required forecast data is unavailable.

---

# Example Result

A successful recommendation response has the following general structure:

```json
{
  "data": {
    "activityRankings": {
      "location": {
        "id": "...",
        "name": "Mumbai",
        "country": "India",
        "region": "Maharashtra",
        "latitude": 19.07283,
        "longitude": 72.88261,
        "timezone": "Asia/Kolkata"
      },
      "forecast": {
        "fetchedAt": "2026-10-06T05:37:21.475Z",
        "stale": false
      },
      "skiing": {
        "days": [
          {
            "date": "2026-10-08",
            "score": 38,
            "availability": "AVAILABLE"
          }
        ]
      },
      "surfing": {
        "days": [
          {
            "date": "2026-10-11",
            "score": 72,
            "availability": "AVAILABLE"
          }
        ]
      },
      "outdoorSightseeing": {
        "days": [
          {
            "date": "2026-10-08",
            "score": 84,
            "availability": "AVAILABLE"
          }
        ]
      },
      "indoorSightseeing": {
        "days": [
          {
            "date": "2026-10-06",
            "score": 69,
            "availability": "AVAILABLE"
          }
        ]
      }
    }
  }
}
```

The exact values depend on the live Open-Meteo forecast at request time.

---

# Testing

Run the complete test suite:

```bash
npm test
```

Run unit tests:

```bash
npm run test:unit
```

Run integration tests:

```bash
npm run test:integration
```

---

# Validation

The project can be validated with:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Also check:

```bash
git diff --check
```

---

# Local Infrastructure

The application currently requires only two external local infrastructure components:

| Component | Purpose | Default Port |
|---|---|---:|
| PostgreSQL | Location and forecast snapshot persistence | 5432 |
| Redis | Location-search cache | 6379 |

The Node.js application itself runs directly on the host during local development.

---

# Design Notes

## Location Search

Location queries are normalized before cache lookup and persistence.

The Redis key format is versioned:

```text
weather-activity:v1:location-search:{normalizedQuery}
```

This allows the cache key format to evolve without silently mixing incompatible cache entries.

## Forecast Persistence

Forecasts are persisted as immutable snapshots.

A snapshot contains:

- location association
- fetch timestamp
- forecast days
- normalized weather data
- normalized marine data when available

The recommendation flow retrieves the latest persisted forecast snapshot.

## Partial Provider Availability

Weather data is required for the core forecast flow.

Marine data is optional.

When marine data is unavailable:

- weather-based activities can still be evaluated
- surfing is returned as unavailable rather than inventing marine values

## Activity Scoring

The activity scorers are pure domain logic.

They do not know about:

- GraphQL
- Prisma
- Redis
- HTTP
- Open-Meteo

The scoring configuration preserves the approved activity weights. Where the design documents did not specify deterministic component thresholds, the MVP uses documented deterministic heuristic assumptions rather than treating those assumptions as calibrated product requirements.

---

# Project Structure

A simplified structure:

```text
src/
├── application/
│   ├── cache/
│   ├── forecast/
│   ├── location/
│   └── providers/
│
├── domain/
│   ├── activity/
│   ├── forecast/
│   ├── location/
│   └── ranking/
│
├── infrastructure/
│   ├── cache/
│   ├── database/
│   └── providers/
│       └── open-meteo/
│
├── presentation/
│   ├── graphql/
│   └── http/
│
└── composition-root.ts
```

The composition root is responsible for connecting concrete infrastructure implementations to application services.

---

# Scope and Future Work

The current implementation deliberately stops before the later production-oriented phases.

Potential future work includes:

- forecast Redis caching
- forecast freshness policies
- stale fallback
- refresh coordination
- single-flight requests
- background refresh
- scheduled jobs
- production deployment
- observability
- authentication and authorization

These concerns are intentionally separated from the current core recommendation flow so that the assignment remains focused on the requested functionality.

---

# Assignment Focus

The primary objective of this implementation is a clear, testable end-to-end recommendation flow with explicit boundaries between:

```text
Domain
  ↓
Application
  ↓
Infrastructure
  ↓
External Services
```

The implementation favors explicit contracts, dependency inversion, deterministic domain logic, and testability over premature production infrastructure.