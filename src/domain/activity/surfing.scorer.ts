import type { ForecastDay } from '../forecast/forecast.types.js';
import type { ActivityScorer } from './activity-scorer.js';
import { Activity, type ActivityScore } from './activity.types.js';
import { SURFING_WEIGHTS } from './scoring.config.js';
import {
  availableScore,
  notAvailableScore,
  weightedScore,
  windComfortScore,
} from './scoring.helpers.js';

export class SurfingScorer implements ActivityScorer {
  readonly activity = Activity.SURFING;

  score(day: ForecastDay): ActivityScore {
    const { marine, maxWindSpeed } = day;

    if (
      marine === null ||
      marine.maxWaveHeight === null ||
      marine.maxWavePeriod === null ||
      marine.maxWindWaveHeight === null ||
      marine.maxSwellHeight === null ||
      marine.maxSwellPeriod === null ||
      maxWindSpeed === null
    ) {
      return notAvailableScore();
    }

    const score = weightedScore([
      {
        score: scoreWaveHeight(marine.maxWaveHeight),
        weight: SURFING_WEIGHTS.waveHeight,
      },
      {
        score: scoreWavePeriod(marine.maxWavePeriod),
        weight: SURFING_WEIGHTS.wavePeriod,
      },
      {
        score: scoreSwellStructure(
          marine.maxSwellHeight,
          marine.maxWindWaveHeight,
        ),
        weight: SURFING_WEIGHTS.swellStructure,
      },
      {
        score: windComfortScore(maxWindSpeed),
        weight: SURFING_WEIGHTS.wind,
      },
    ]);

    return availableScore(score);
  }
}

function scoreWaveHeight(maxWaveHeight: number): number {
  if (maxWaveHeight < 0.5) {
    return 20;
  }

  if (maxWaveHeight < 1) {
    return 60;
  }

  if (maxWaveHeight <= 2.5) {
    return 100;
  }

  if (maxWaveHeight <= 4) {
    return 80;
  }

  return 40;
}

function scoreWavePeriod(maxWavePeriod: number): number {
  if (maxWavePeriod < 5) {
    return 20;
  }

  if (maxWavePeriod < 8) {
    return 60;
  }

  if (maxWavePeriod <= 12) {
    return 100;
  }

  if (maxWavePeriod <= 16) {
    return 90;
  }

  return 70;
}

function scoreSwellStructure(
  maxSwellHeight: number,
  maxWindWaveHeight: number,
): number {
  if (maxSwellHeight >= maxWindWaveHeight * 1.5) {
    return 100;
  }

  if (maxSwellHeight >= maxWindWaveHeight) {
    return 65;
  }

  return 35;
}
