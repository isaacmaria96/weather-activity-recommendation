# Requirements And Working Assumptions

## Problem Statement

Build a TypeScript, Node.js, GraphQL backend that evaluates the next seven days for the following activities:

- Skiing
- Surfing
- Outdoor sightseeing
- Indoor sightseeing

It must obtain forecast data from Open-Meteo, persist that data, and avoid calling Open-Meteo on every client request. There is no frontend in scope.

## Intended User And Outcome

A traveller, or a planning application acting for one, wants a quick view of which upcoming days best suit an activity in a chosen place.

The service should return a ranked list for each activity rather than claiming to make a definitive safety or travel recommendation.

## Core Use Cases

### Find A Supported Location

A caller searches for a city or town by name. The service returns matching location candidates with an opaque `locationId`, display name, country, region, coordinates, and timezone. The caller must choose one of these candidates before requesting rankings.

### Get Activity Rankings For A Location

Given a `locationId` returned by location search, the caller receives the next seven local calendar days, ranked from most to least suitable for each of the four activities. Each result includes a numeric score.

### Reuse A Recent Forecast

When the same location is requested again while its forecast is fresh, the service returns persisted data and does not call Open-Meteo.

### Refresh A Stale Forecast

When a persisted forecast is older than the configured freshness period, the service fetches a replacement from Open-Meteo, persists it, and ranks the new data.

### Handle An Invalid Location

An empty search returns no candidates. A ranking request for an unknown or expired `locationId` produces a clear GraphQL error. The service never silently chooses between similarly named locations.

### Handle Unavailable Data

When data required for an activity is unavailable, the service does not invent a score or treat missing data as poor weather. The response indicates that the activity cannot currently be scored.

## Initial GraphQL Contract

The first version will make location selection a two-step flow:

```graphql
type Query {
  searchLocations(query: String!): [LocationCandidate!]!
  activityRankings(locationId: ID!): ActivityRankingResponse!
}
```

`searchLocations` resolves a name through Open-Meteo and upserts the returned candidates into local storage. `activityRankings` accepts only an ID that this service issued through `searchLocations`; it does not accept arbitrary coordinates or free-text place names.

## Working Product Decisions

| Product question | Working answer for this exercise | Consequence for the implementation |
| --- | --- | --- |
| What does "rank the next 7 days" mean? | Return all seven days for every activity, ordered best to worst, while retaining each day's local date. | The API can support both planning by date and comparing suitability. |
| How should a caller select a location? | Expose `searchLocations(query)`. Rankings accept only a `locationId` returned by that search. | The service never silently selects between similarly named places, and the ranking query has a stable cache key. |
| How should suitability be expressed? | Use an integer score from 0 to 100; a higher score is better. | Keep scoring functions deterministic and unit-testable. |
| Are scores a safety guarantee? | No. They are planning guidance based on forecast data only. | The README and API description state this limitation. |
| How long is forecast data fresh? | Six hours. | Cache hits need no network request; stale entries are refreshed on demand. |
| What if a refresh fails but an older forecast exists? | Return the last persisted forecast only when it is less than 24 hours old, mark it as stale, and include the refresh failure in service telemetry. | The service remains useful during a transient provider outage without hiding freshness. |
| How much forecast history is retained? | Keep the latest snapshot per location for serving requests and retain prior snapshots for 30 days for debugging. | Demonstrates a practical retention policy without overbuilding analytics. |
| How should skiing be scored? | Treat snowfall, cold temperatures, and manageable wind as positive signals; heavy rain and warm temperatures reduce the score. | The result is a weather suitability score, not a claim about resort opening times or snowpack. |
| How should surfing be scored? | Use Open-Meteo marine data when it is available for the requested location; wave conditions and wind drive the score. | If marine data is unavailable, return `notAvailable` rather than inventing a score. |
| How should outdoor sightseeing be scored? | Prefer dry, mild, lower-wind conditions; penalise severe weather and high precipitation probability. | The rules remain deterministic and can later be extended or personalised. |
| How should indoor sightseeing be scored? | Prefer days when outdoor conditions are relatively poor, especially rain, cold, or high wind. | Indoor sightseeing is framed as an alternative when outdoor plans are less attractive. |
| Which timezone defines a day? | Use the timezone returned for the resolved location and display ISO local dates. | A "day" remains meaningful to the traveller instead of the server's timezone. |
| Are users, saved trips, and authentication required? | No. | Deliberately out of scope for the focused backend exercise. |
| Should the service proactively refresh every cached place? | No for the initial version. Refresh on demand when stale; a scheduled refresh job is a documented next step. | Avoids unnecessary background infrastructure while meeting the persistence requirement. |
| Should score explanations be part of the initial API? | No. The initial API returns the score only. The scoring implementation should remain structured enough that contributing factors can be exposed later. | Keeps the MVP focused while preserving a clean path to explainable scoring in a later iteration. |

## Acceptance Criteria

- A caller can search for a city or town and receive selectable location candidates.
- Rankings accept only a `locationId` returned by location search.
- A ranking response covers seven local dates and all four activities.
- Every scored result contains a score.
- A repeated request within six hours uses persisted forecast data rather than calling Open-Meteo again.
- Forecast, location, and freshness metadata are persisted in a local database.
- Invalid location IDs and upstream failures return intentional, documented GraphQL errors.
- Scoring rules and cache behaviour have automated tests.
- The repository documents setup, a sample query, assumptions, and known limitations.

## Decisions To Revisit With Product

- Whether the product wants a single winner per activity or all seven days ranked.
- Whether nearby coastal conditions should be inferred for inland locations, and what distance is acceptable.
- Whether score-contributing factors should be exposed to clients as part of a second iteration.
- The expected balance between transparent rule-based scoring and later personalised recommendations.
- Whether stale results should be shown to users at all during a provider outage.
- Desired forecast refresh frequency and data-retention requirements once real usage volume is known.

## Delivery Notes

This document will evolve alongside implementation. Meaningful commit messages and short notes beside changed assumptions are part of the submission's development trail; they are intentionally concise rather than a polished retrospective.
