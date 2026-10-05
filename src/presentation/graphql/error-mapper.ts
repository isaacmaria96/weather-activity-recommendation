import { GraphQLError } from 'graphql';
import {
  ApplicationError,
  ForecastUnavailableError,
  InvalidInputError,
  LocationNotFoundError,
  PersistenceError,
  ProviderUnavailableError,
} from '../../shared/errors/application-errors.js';

export function mapApplicationError(error: unknown): GraphQLError {
  if (error instanceof InvalidInputError) {
    return toGraphQLError(error, 'INVALID_INPUT');
  }

  if (error instanceof LocationNotFoundError) {
    return toGraphQLError(error, 'LOCATION_NOT_FOUND');
  }

  if (error instanceof ProviderUnavailableError) {
    return toGraphQLError(error, 'UPSTREAM_UNAVAILABLE');
  }

  if (error instanceof ForecastUnavailableError) {
    return toGraphQLError(error, 'FORECAST_UNAVAILABLE');
  }

  if (error instanceof PersistenceError || error instanceof ApplicationError) {
    return toGraphQLError(error, 'INTERNAL_ERROR');
  }

  return new GraphQLError('Internal service error', {
    extensions: { code: 'INTERNAL_ERROR' },
  });
}

function toGraphQLError(error: Error, code: string): GraphQLError {
  return new GraphQLError(error.message, {
    extensions: { code },
  });
}
