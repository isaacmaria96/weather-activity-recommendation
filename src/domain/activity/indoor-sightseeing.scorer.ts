import type { ForecastDay } from '../forecast/forecast.types.js';
import type { ActivityScorer } from './activity-scorer.js';
import { Activity, type ActivityScore } from './activity.types.js';
import { INDOOR_SIGHTSEEING_WEIGHTS } from './scoring.config.js';
import {
  availableScore,
  isPoorWeatherCode,
  isSevereWeatherCode,
  midpoint,
  notAvailableScore,
  weightedScore,
} from './scoring.helpers.js';

export class IndoorSightseeingScorer implements ActivityScorer {
  readonly activity = Activity.INDOOR_SIGHTSEEING;

  score(day: ForecastDay): ActivityScore {
    const {
      precipitationProbabilityMax,
      precipitationSum,
      minTemperature,
      maxTemperature,
      maxWindSpeed,
      weatherCode,
    } = day;

    if (
      precipitationProbabilityMax === null ||
      precipitationSum === null ||
      minTemperature === null ||
      maxTemperature === null ||
      maxWindSpeed === null ||
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
        weight: INDOOR_SIGHTSEEING_WEIGHTS.precipitation,
      },
      {
        score: scoreTemperature(midpoint(minTemperature, maxTemperature)),
        weight: INDOOR_SIGHTSEEING_WEIGHTS.temperature,
      },
      {
        score: scoreWind(maxWindSpeed),
        weight: INDOOR_SIGHTSEEING_WEIGHTS.wind,
      },
      {
        score: scoreSeverity(weatherCode),
        weight: INDOOR_SIGHTSEEING_WEIGHTS.severity,
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
    return 100;
  }

  if (precipitationSum >= 2 || precipitationProbabilityMax >= 50) {
    return 85;
  }

  if (precipitationSum > 0 || precipitationProbabilityMax >= 30) {
    return 55;
  }

  return 20;
}

function scoreTemperature(temperatureMidpoint: number): number {
  if (temperatureMidpoint >= 18 && temperatureMidpoint <= 24) {
    return 20;
  }

  if (
    (temperatureMidpoint >= 12 && temperatureMidpoint < 18) ||
    (temperatureMidpoint > 24 && temperatureMidpoint <= 28)
  ) {
    return 45;
  }

  if (
    (temperatureMidpoint >= 5 && temperatureMidpoint < 12) ||
    (temperatureMidpoint > 28 && temperatureMidpoint <= 32)
  ) {
    return 80;
  }

  return 100;
}

function scoreWind(maxWindSpeed: number): number {
  if (maxWindSpeed <= 15) {
    return 20;
  }

  if (maxWindSpeed <= 30) {
    return 50;
  }

  if (maxWindSpeed <= 45) {
    return 80;
  }

  return 100;
}

function scoreSeverity(weatherCode: number): number {
  if (isSevereWeatherCode(weatherCode)) {
    return 100;
  }

  if (isPoorWeatherCode(weatherCode)) {
    return 70;
  }

  return 20;
}
