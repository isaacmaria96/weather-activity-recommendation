import { expect } from 'chai';
import {
  ApplicationError,
  InvalidInputError,
} from '../../../src/shared/errors/application-errors.js';

describe('application errors', () => {
  it('preserves error names and messages', () => {
    const error = new InvalidInputError('Invalid query');

    expect(error).to.be.instanceOf(ApplicationError);
    expect(error.name).to.equal('InvalidInputError');
    expect(error.message).to.equal('Invalid query');
  });
});
