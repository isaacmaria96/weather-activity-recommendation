import { expect } from 'chai';
import type { ActivityScorer } from '../../../src/domain/activity/activity-scorer.js';
import {
  Activity,
  Availability,
  type ActivityScore,
} from '../../../src/domain/activity/activity.types.js';
import type { ForecastDay } from '../../../src/domain/forecast/forecast.types.js';
import { rankDays } from '../../../src/domain/ranking/ranking.js';

describe('rankDays', () => {
  it('ranks available days by descending score', () => {
    const result = rankDays(
      [day('2026-10-07'), day('2026-10-06')],
      scorer({
        '2026-10-06': available(90),
        '2026-10-07': available(40),
      }),
    );

    expect(result.map((entry) => entry.date)).to.deep.equal([
      '2026-10-06',
      '2026-10-07',
    ]);
  });

  it('places unavailable entries after available entries and preserves null scores', () => {
    const result = rankDays(
      [day('2026-10-06'), day('2026-10-07')],
      scorer({
        '2026-10-06': unavailable(),
        '2026-10-07': available(10),
      }),
    );

    expect(result).to.deep.equal([
      {
        date: '2026-10-07',
        score: 10,
        availability: Availability.AVAILABLE,
      },
      {
        date: '2026-10-06',
        score: null,
        availability: Availability.NOT_AVAILABLE,
      },
    ]);
  });

  it('uses date ascending as the deterministic tie-breaker', () => {
    const result = rankDays(
      [day('2026-10-08'), day('2026-10-06'), day('2026-10-07')],
      scorer({
        '2026-10-06': available(50),
        '2026-10-07': available(50),
        '2026-10-08': available(50),
      }),
    );

    expect(result.map((entry) => entry.date)).to.deep.equal([
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
    ]);
  });

  it('does not mutate the input array', () => {
    const days = [day('2026-10-08'), day('2026-10-06')];
    const originalDates = days.map((entry) => entry.localDate);

    rankDays(
      days,
      scorer({
        '2026-10-06': available(90),
        '2026-10-08': available(10),
      }),
    );

    expect(days.map((entry) => entry.localDate)).to.deep.equal(originalDates);
  });

  it('returns deterministic output for the same inputs', () => {
    const days = [day('2026-10-08'), day('2026-10-06'), day('2026-10-07')];
    const testScorer = scorer({
      '2026-10-06': available(20),
      '2026-10-07': unavailable(),
      '2026-10-08': available(60),
    });

    expect(rankDays(days, testScorer)).to.deep.equal(
      rankDays(days, testScorer),
    );
  });

  function scorer(scores: Record<string, ActivityScore>): ActivityScorer {
    return {
      activity: Activity.OUTDOOR_SIGHTSEEING,
      score(forecastDay: ForecastDay): ActivityScore {
        const score = scores[forecastDay.localDate];

        if (score === undefined) {
          throw new Error(`Missing test score for ${forecastDay.localDate}`);
        }

        return score;
      },
    };
  }

  function available(score: number): ActivityScore {
    return {
      score,
      availability: Availability.AVAILABLE,
    };
  }

  function unavailable(): ActivityScore {
    return {
      score: null,
      availability: Availability.NOT_AVAILABLE,
    };
  }

  function day(localDate: string): ForecastDay {
    return {
      localDate,
      minTemperature: null,
      maxTemperature: null,
      precipitationProbabilityMax: null,
      precipitationSum: null,
      rainSum: null,
      snowfallSum: null,
      maxWindSpeed: null,
      weatherCode: null,
      sunshineDuration: null,
      marine: null,
    };
  }
});
