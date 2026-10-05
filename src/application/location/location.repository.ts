import type { Location } from '../../domain/location/location.types.js';

export type LocationUpsert = {
  provider: string;
  providerLocationId: string;
  name: string;
  country: string;
  countryCode?: string;
  region?: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export interface LocationRepository {
  findById(id: string): Promise<Location | null>;
  upsertCandidates(candidates: LocationUpsert[]): Promise<Location[]>;
}
