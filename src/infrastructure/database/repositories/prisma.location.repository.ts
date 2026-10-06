import type { PrismaClient } from '@prisma/client';
import type { Location } from '../../../domain/location/location.types.js';
import type {
  LocationRepository,
  LocationUpsert,
} from '../../../application/location/location.repository.js';
import { PersistenceError } from '../../../shared/errors/application-errors.js';

export class PrismaLocationRepository implements LocationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Location | null> {
    try {
      const location = await this.prisma.location.findUnique({
        where: { id },
      });

      return location === null ? null : mapLocation(location);
    } catch {
      throw new PersistenceError('Failed to load location');
    }
  }

  async upsertCandidates(candidates: LocationUpsert[]): Promise<Location[]> {
    try {
      const locations = await this.prisma.$transaction(
        candidates.map((candidate) =>
          this.prisma.location.upsert({
            where: {
              provider_providerLocationId: {
                provider: candidate.provider,
                providerLocationId: candidate.providerLocationId,
              },
            },
            create: {
              provider: candidate.provider,
              providerLocationId: candidate.providerLocationId,
              name: candidate.name,
              country: candidate.country,
              countryCode: candidate.countryCode ?? null,
              region: candidate.region ?? null,
              latitude: candidate.latitude,
              longitude: candidate.longitude,
              timezone: candidate.timezone,
            },
            update: {
              name: candidate.name,
              country: candidate.country,
              countryCode: candidate.countryCode ?? null,
              region: candidate.region ?? null,
              latitude: candidate.latitude,
              longitude: candidate.longitude,
              timezone: candidate.timezone,
            },
          }),
        ),
      );

      return locations.map(mapLocation);
    } catch {
      throw new PersistenceError('Failed to persist location candidates');
    }
  }
}

type PrismaLocation =
  Awaited<ReturnType<PrismaClient['location']['findUnique']>> extends infer T
    ? NonNullable<T>
    : never;

function mapLocation(location: PrismaLocation): Location {
  return {
    id: location.id,
    name: location.name,
    country: location.country,
    countryCode: location.countryCode,
    region: location.region,
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: location.timezone,
  };
}
