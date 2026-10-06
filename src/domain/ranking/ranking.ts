import type { ActivityScorer } from '../activity/activity-scorer.js';
import { Availability } from '../activity/activity.types.js';
import type { ForecastDay } from '../forecast/forecast.types.js';

export type RankedActivityDay = {
  date: string;
  score: number | null;
  availability: Availability;
};

export function rankDays(
  days: ForecastDay[],
  scorer: ActivityScorer,
): RankedActivityDay[] {
  return days
    .map((day) => {
      const score = scorer.score(day);

      return {
        date: day.localDate,
        score: score.score,
        availability: score.availability,
      };
    })
    .sort(compareRankedDays);
}

function compareRankedDays(
  left: RankedActivityDay,
  right: RankedActivityDay,
): number {
  if (left.availability !== right.availability) {
    return left.availability === Availability.AVAILABLE ? -1 : 1;
  }

  if (
    left.availability === Availability.AVAILABLE &&
    right.availability === Availability.AVAILABLE
  ) {
    const scoreComparison = (right.score ?? 0) - (left.score ?? 0);

    if (scoreComparison !== 0) {
      return scoreComparison;
    }
  }

  return left.date.localeCompare(right.date);
}
