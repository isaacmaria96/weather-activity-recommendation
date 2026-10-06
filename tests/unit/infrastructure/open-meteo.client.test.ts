import { expect } from 'chai';
import type { Logger } from 'pino';
import sinon from 'sinon';
import { OpenMeteoClient } from '../../../src/infrastructure/providers/open-meteo/open-meteo.client.js';
import { ProviderUnavailableError } from '../../../src/shared/errors/application-errors.js';

describe('OpenMeteoClient', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('builds a URL with query parameters and parses JSON responses', async () => {
    const fetchStub = sinon.stub().resolves(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = new OpenMeteoClient(
      5000,
      createLogger(),
      fetchStub as typeof fetch,
    );

    const result = await client.get<{ ok: boolean }>(
      'https://example.test',
      '/v1/search',
      { name: 'london', count: 10 },
    );

    expect(result).to.deep.equal({ ok: true });
    const requestedUrl = fetchStub.firstCall.args[0] as URL;
    expect(requestedUrl.toString()).to.equal(
      'https://example.test/v1/search?name=london&count=10',
    );
  });

  it('translates non-2xx responses into provider errors', async () => {
    const fetchStub = sinon
      .stub()
      .resolves(new Response(null, { status: 500 }));
    const client = new OpenMeteoClient(
      5000,
      createLogger(),
      fetchStub as typeof fetch,
    );

    try {
      await client.get('https://example.test', '/v1/search', {
        name: 'london',
      });
      throw new Error('Expected provider error');
    } catch (error) {
      expect(error).to.be.instanceOf(ProviderUnavailableError);
    }
  });

  function createLogger(): Logger {
    return {
      debug: sinon.stub(),
      warn: sinon.stub(),
    } as unknown as Logger;
  }
});
