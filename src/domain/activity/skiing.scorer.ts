import type { ForecastDay } from '../forecast/forecast.types.js';
import type { ActivityScorer } from './activity-scorer.js';
import { Activity, type ActivityScore } from './activity.types.js';
import { SKIING_WEIGHTS } from './scoring.config.js';
import {
  availableScore,
  isSevereWeatherCode,
  midpoint,
  notAvailableScore,
  weightedScore,
  windComfortScore,
} from './scoring.helpers.js';

export class SkiingScorer implements ActivityScorer {
  readonly activity = Activity.SKIING;

  score(day: ForecastDay): ActivityScore {
    const {
      snowfallSum,
      minTemperature,
      maxTemperature,
      maxWindSpeed,
      rainSum,
      weatherCode,
    } = day;

    if (
      snowfallSum === null ||
      minTemperature === null ||
      maxTemperature === null ||
      maxWindSpeed === null ||
      rainSum === null ||
      weatherCode === null
    ) {
      return notAvailableScore();
    }

    const score = weightedScore([
      {
        score: scoreSnowfall(snowfallSum),
        weight: SKIING_WEIGHTS.snowfall,
      },
      {
        score: scoreTemperature(midpoint(minTemperature, maxTemperature)),
        weight: SKIING_WEIGHTS.temperature,
      },
      {
        score: windComfortScore(maxWindSpeed),
        weight: SKIING_WEIGHTS.wind,
      },
      {
        score: scoreRainSeverity(rainSum, weatherCode),
        weight: SKIING_WEIGHTS.rainSeverity,
      },
    ]);

    return availableScore(score);
  }
}

function scoreSnowfall(snowfallSum: number): number {
  if (snowfallSum === 0) {
    return 20;
  }

  if (snowfallSum < 2) {
    return 45;
  }

  if (snowfallSum < 10) {
    return 80;
  }

  if (snowfallSum < 25) {
    return 100;
  }

  return 90;
}

function scoreTemperature(temperatureMidpoint: number): number {
  if (temperatureMidpoint >= -8 && temperatureMidpoint <= -2) {
    return 100;
  }

  if (temperatureMidpoint >= -12 && temperatureMidpoint < -8) {
    return 75;
  }

  if (temperatureMidpoint > -2 && temperatureMidpoint <= 2) {
    return 85;
  }

  if (temperatureMidpoint > 2 && temperatureMidpoint <= 5) {
    return 60;
  }

  if (temperatureMidpoint < -12) {
    return 50;
  }

  if (temperatureMidpoint <= 10) {
    return 25;
  }

  return 0;
}

function scoreRainSeverity(rainSum: number, weatherCode: number): number {
  if (isSevereWeatherCode(weatherCode) || rainSum >= 10) {
    return 0;
  }

  if (rainSum >= 2) {
    return 35;
  }

  if (rainSum > 0) {
    return 70;
  }

  return 100;
}
