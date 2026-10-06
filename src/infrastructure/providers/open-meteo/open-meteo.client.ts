import type { Logger } from 'pino';
import { ProviderUnavailableError } from '../../../shared/errors/application-errors.js';

export type FetchLike = typeof fetch;

export class OpenMeteoClient {
  constructor(
    private readonly timeoutMs: number,
    private readonly logger: Logger,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  async get<T>(
    baseUrl: string,
    path: string,
    query: Record<string, string | number>,
  ): Promise<T> {
    const url = new URL(path, baseUrl);

    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, String(value));
    }

    const startedAt = Date.now();

    try {
      const response = await this.fetchImpl(url, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const durationMs = Date.now() - startedAt;

      if (!response.ok) {
        this.logger.warn(
          { status: response.status, durationMs },
          'Open-Meteo request failed',
        );
        throw new ProviderUnavailableError('Open-Meteo request failed');
      }

      this.logger.debug({ durationMs }, 'Open-Meteo request succeeded');

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ProviderUnavailableError) {
        throw error;
      }

      this.logger.warn({ error }, 'Open-Meteo request failed');
      throw new ProviderUnavailableError('Open-Meteo is unavailable');
    }
  }
}
