import type { LocationSearchService } from '../../application/location/location.service.js';
import type { RecommendationReader } from '../../application/recommendation/recommendation.service.js';
import { mapApplicationError } from './error-mapper.js';

export type ResolverDependencies = {
  locationService: LocationSearchService;
  recommendationService: RecommendationReader;
};

export function createResolvers({
  locationService,
  recommendationService,
}: ResolverDependencies) {
  return {
    Query: {
      searchLocations: async (_parent: unknown, args: { query: string }) => {
        try {
          return await locationService.search(args.query);
        } catch (error) {
          throw mapApplicationError(error);
        }
      },
      activityRankings: async (
        _parent: unknown,
        args: { locationId: string },
      ) => {
        try {
          return await recommendationService.getRankings(args.locationId);
        } catch (error) {
          throw mapApplicationError(error);
        }
      },
    },
  };
}
