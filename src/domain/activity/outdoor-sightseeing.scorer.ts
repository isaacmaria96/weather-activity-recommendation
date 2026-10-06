import type { ForecastDay } from '../forecast/forecast.types.js';
import type { ActivityScorer } from './activity-scorer.js';
import { Activity, type ActivityScore } from './activity.types.js';
import { OUTDOOR_SIGHTSEEING_WEIGHTS } from './scoring.config.js';
import {
  availableScore,
  isPoorWeatherCode,
  isSevereWeatherCode,
  midpoint,
  notAvailableScore,
  weightedScore,
  windComfortScore,
} from './scoring.helpers.js';

export class OutdoorSightseeingScorer implements ActivityScorer {
  readonly activity = Activity.OUTDOOR_SIGHTSEEING;

  score(day: ForecastDay): ActivityScore {
    const {
      precipitationProbabilityMax,
      precipitationSum,
      minTemperature,
      maxTemperature,
      maxWindSpeed,
      sunshineDuration,
      weatherCode,
    } = day;

    if (
      precipitationProbabilityMax === null ||
      precipitationSum === null ||
      minTemperature === null ||
      maxTemperature === null ||
      maxWindSpeed === null ||
      sunshineDuration === null ||
      weatherCode === null
    ) {
      return notAvailableScore();
    }

    const score = weightedScore([
      {
        score: scorePrecipitation(
          precipitationProbabilityMax,
          precipitationSum,
        ),
        weight: OUTDOOR_SIGHTSEEING_WEIGHTS.precipitation,
      },
      {
        score: scoreTemperature(midpoint(minTemperature, maxTemperature)),
        weight: OUTDOOR_SIGHTSEEING_WEIGHTS.temperature,
      },
      {
        score: windComfortScore(maxWindSpeed),
        weight: OUTDOOR_SIGHTSEEING_WEIGHTS.wind,
      },
      {
        score: scoreSunshineSeverity(sunshineDuration, weatherCode),
        weight: OUTDOOR_SIGHTSEEING_WEIGHTS.sunshineSeverity,
      },
    ]);

    return availableScore(score);
  }
}

function scorePrecipitation(
  precipitationProbabilityMax: number,
  precipitationSum: number,
): number {
  if (precipitationSum >= 10 || precipitationProbabilityMax >= 80) {
    return 0;
  }

  if (precipitationSum >= 2 || precipitationProbabilityMax >= 50) {
    return 35;
  }

  if (precipitationSum > 0 || precipitationProbabilityMax >= 30) {
    return 75;
  }

  return 100;
}

function scoreTemperature(temperatureMidpoint: number): number {
  if (temperatureMidpoint >= 18 && temperatureMidpoint <= 24) {
    return 100;
  }

  if (
    (temperatureMidpoint >= 12 && temperatureMidpoint < 18) ||
    (temperatureMidpoint > 24 && temperatureMidpoint <= 28)
  ) {
    return 80;
  }

  if (
    (temperatureMidpoint >= 5 && temperatureMidpoint < 12) ||
    (temperatureMidpoint > 28 && temperatureMidpoint <= 32)
  ) {
    return 45;
  }

  return 15;
}

function scoreSunshineSeverity(
  sunshineDuration: number,
  weatherCode: number,
): number {
  if (isSevereWeatherCode(weatherCode)) {
    return 0;
  }

  if (sunshineDuration >= 6 * 60 * 60 && !isPoorWeatherCode(weatherCode)) {
    return 100;
  }

  if (sunshineDuration >= 3 * 60 * 60) {
    return 75;
  }

  return 45;
}
