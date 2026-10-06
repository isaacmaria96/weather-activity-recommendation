import { expect } from 'chai';
import {
  normalizeLocationQuery,
  validateLocationQuery,
} from '../../../src/application/location/location-query.js';
import { MAX_LOCATION_QUERY_LENGTH } from '../../../src/config/constants.js';
import { InvalidInputError } from '../../../src/shared/errors/application-errors.js';

describe('location query helpers', () => {
  it('normalizes whitespace and casing', () => {
    expect(normalizeLocationQuery('  New   York  ')).to.equal('new york');
  });

  it('allows empty normalized input for the empty-search flow', () => {
    expect(() => validateLocationQuery('')).not.to.throw();
  });

  it('rejects overlong non-empty input', () => {
    const query = 'a'.repeat(MAX_LOCATION_QUERY_LENGTH + 1);

    expect(() => validateLocationQuery(query)).to.throw(InvalidInputError);
  });
});
