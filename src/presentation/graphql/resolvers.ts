import { GraphQLError } from 'graphql';

const notImplemented = () => {
  throw new GraphQLError('Resolver is not implemented in Phase 1', {
    extensions: { code: 'NOT_IMPLEMENTED' },
  });
};

export const resolvers = {
  Query: {
    searchLocations: notImplemented,
    activityRankings: notImplemented,
  },
};
