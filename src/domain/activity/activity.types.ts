export enum Activity {
  SKIING = 'SKIING',
  SURFING = 'SURFING',
  OUTDOOR_SIGHTSEEING = 'OUTDOOR_SIGHTSEEING',
  INDOOR_SIGHTSEEING = 'INDOOR_SIGHTSEEING',
}

export enum Availability {
  AVAILABLE = 'AVAILABLE',
  NOT_AVAILABLE = 'NOT_AVAILABLE',
}

export type ActivityScore = {
  score: number | null;
  availability: Availability;
};
