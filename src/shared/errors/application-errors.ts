export class ApplicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidInputError extends ApplicationError {}

export class LocationNotFoundError extends ApplicationError {}

export class ProviderUnavailableError extends ApplicationError {}

export class ForecastUnavailableError extends ApplicationError {}

export class PersistenceError extends ApplicationError {}
