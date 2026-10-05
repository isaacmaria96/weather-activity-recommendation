import { expect } from 'chai';
import { loadConfig } from '../../../src/config/config.js';

describe('loadConfig', () => {
  it('loads defaults for local development', () => {
    const config = loadConfig({});

    expect(config.port).to.equal(4000);
    expect(config.databaseUrl).to.equal(
      'postgresql://weather:weather@localhost:5432/weather',
    );
    expect(config.redisUrl).to.equal('redis://localhost:6379');
  });

  it('validates provided environment values', () => {
    expect(() => loadConfig({ PORT: 'not-a-port' })).to.throw();
  });
});
