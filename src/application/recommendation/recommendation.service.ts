import type { ActivityScorer } from '../../domain/activity/activity-scorer.js';
import { Activity } from '../../domain/activity/activity.types.js';
import type { Location } from '../../domain/location/location.types.js';
import type { RankedActivityDay } from '../../domain/ranking/ranking.js';
import { rankDays } from '../../domain/ranking/ranking.js';
import { LocationNotFoundError } from '../../shared/errors/application-errors.js';
import type { ForecastReader } from '../forecast/forecast.service.js';
import type { LocationRepository } from '../location/location.repository.js';

export type ActivityRanking = {
  days: RankedActivityDay[];
};

export type ActivityRankingResponse = {
  location: Location;
  forecast: {
    fetchedAt: string;
    stale: boolean;
  };
  skiing: ActivityRanking;
  surfing: ActivityRanking;
  outdoorSightseeing: ActivityRanking;
  indoorSightseeing: ActivityRanking;
};

export interface RecommendationReader {
  getRankings(locationId: string): Promise<ActivityRankingResponse>;
}

export class RecommendationService implements RecommendationReader {
  private readonly scorersByActivity: Map<Activity, ActivityScorer>;

  constructor(
    private readonly locationRepository: LocationRepository,
    private readonly forecastService: ForecastReader,
    scorers: ActivityScorer[],
  ) {
    this.scorersByActivity = new Map(
      scorers.map((scorer) => [scorer.activity, scorer]),
    );
  }

  async getRankings(locationId: string): Promise<ActivityRankingResponse> {
    const location = await this.locationRepository.findById(locationId);

    if (location === null) {
      throw new LocationNotFoundError('Location not found');
    }

    const forecast = await this.forecastService.getForecast(location);

    return {
      location,
      forecast: {
        fetchedAt: forecast.fetchedAt.toISOString(),
        stale: false,
      },
      skiing: {
        days: rankDays(forecast.days, this.requireScorer(Activity.SKIING)),
      },
      surfing: {
        days: rankDays(forecast.days, this.requireScorer(Activity.SURFING)),
      },
      outdoorSightseeing: {
        days: rankDays(
          forecast.days,
          this.requireScorer(Activity.OUTDOOR_SIGHTSEEING),
        ),
      },
      indoorSightseeing: {
        days: rankDays(
          forecast.days,
          this.requireScorer(Activity.INDOOR_SIGHTSEEING),
        ),
      },
    };
  }

  private requireScorer(activity: Activity): ActivityScorer {
    const scorer = this.scorersByActivity.get(activity);

    if (scorer === undefined) {
      throw new Error(`Missing scorer for ${activity}`);
    }

    return scorer;
  }
}
