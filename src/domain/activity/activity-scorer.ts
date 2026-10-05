import type { ForecastDay } from '../forecast/forecast.types.js';
import type { Activity, ActivityScore } from './activity.types.js';

export interface ActivityScorer {
  readonly activity: Activity;
  score(day: ForecastDay): ActivityScore;
}
