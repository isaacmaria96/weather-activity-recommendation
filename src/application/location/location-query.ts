import { MAX_LOCATION_QUERY_LENGTH } from '../../config/constants.js';
import { InvalidInputError } from '../../shared/errors/application-errors.js';

export function normalizeLocationQuery(query: string): string {
  return query.trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
}

export function validateLocationQuery(normalizedQuery: string): void {
  if (normalizedQuery.length > MAX_LOCATION_QUERY_LENGTH) {
    throw new InvalidInputError('Location query is too long');
  }
}
