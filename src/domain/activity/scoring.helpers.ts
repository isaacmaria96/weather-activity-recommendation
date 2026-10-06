import { Availability, type ActivityScore } from './activity.types.js';

export function availableScore(score: number): ActivityScore {
  return {
    score: clampScore(Math.round(score)),
    availability: Availability.AVAILABLE,
  };
}

export function notAvailableScore(): ActivityScore {
  return {
    score: null,
    availability: Availability.NOT_AVAILABLE,
  };
}

export function weightedScore(
  components: Array<{ score: number; weight: number }>,
): number {
  return components.reduce(
    (total, component) => total + component.score * component.weight,
    0,
  );
}

export function midpoint(first: number, second: number): number {
  return (first + second) / 2;
}

export function hasMissingValues(
  values: Array<number | null | undefined>,
): boolean {
  return values.some((value) => value === null || value === undefined);
}

export function windComfortScore(maxWindSpeed: number): number {
  if (maxWindSpeed <= 15) {
    return 100;
  }

  if (maxWindSpeed <= 30) {
    return 75;
  }

  if (maxWindSpeed <= 45) {
    return 40;
  }

  return 10;
}

export function isSevereWeatherCode(weatherCode: number): boolean {
  return (
    weatherCode === 66 ||
    weatherCode === 67 ||
    weatherCode === 75 ||
    weatherCode === 77 ||
    weatherCode === 82 ||
    weatherCode === 86 ||
    weatherCode >= 95
  );
}

export function isPoorWeatherCode(weatherCode: number): boolean {
  return weatherCode >= 45;
}

function clampScore(score: number): number {
  if (score < 0) {
    return 0;
  }

  if (score > 100) {
    return 100;
  }

  return score;
}
