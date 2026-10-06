import { GraphQLError } from 'graphql';
import type { LocationSearchService } from '../../application/location/location.service.js';
import { mapApplicationError } from './error-mapper.js';

const notImplemented = () => {
  throw new GraphQLError('Resolver is not implemented in Phase 1', {
    extensions: { code: 'NOT_IMPLEMENTED' },
  });
};

export type ResolverDependencies = {
  locationService: LocationSearchService;
};

export function createResolvers({ locationService }: ResolverDependencies) {
  return {
    Query: {
      searchLocations: async (_parent: unknown, args: { query: string }) => {
        try {
          return await locationService.search(args.query);
        } catch (error) {
          throw mapApplicationError(error);
        }
      },
      activityRankings: notImplemented,
    },
  };
}
