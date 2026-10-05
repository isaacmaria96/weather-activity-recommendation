export type Location = {
  id: string;
  name: string;
  country: string;
  countryCode: string | null;
  region: string | null;
  latitude: number;
  longitude: number;
  timezone: string;
};

export type LocationCandidate = Location;
