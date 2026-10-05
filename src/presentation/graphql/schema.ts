export const typeDefs = `#graphql
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
`;
