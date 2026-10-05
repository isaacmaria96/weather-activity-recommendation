import { expect } from 'chai';
import sinon from 'sinon';
import { SystemClock, type Clock } from '../../../src/shared/time.js';

describe('Clock', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('can be mocked at the interface boundary', () => {
    const fixed = new Date('2026-10-05T00:00:00.000Z');
    const clock: Clock = { now: sinon.stub().returns(fixed) };

    expect(clock.now()).to.equal(fixed);
  });

  it('uses system time in SystemClock', () => {
    const fixed = new Date('2026-10-05T01:00:00.000Z');
    sinon.useFakeTimers(fixed);

    expect(new SystemClock().now().toISOString()).to.equal(
      '2026-10-05T01:00:00.000Z',
    );
  });
});
