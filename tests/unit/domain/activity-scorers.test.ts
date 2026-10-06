import { expect } from 'chai';
import { IndoorSightseeingScorer } from '../../../src/domain/activity/indoor-sightseeing.scorer.js';
import { OutdoorSightseeingScorer } from '../../../src/domain/activity/outdoor-sightseeing.scorer.js';
import { SkiingScorer } from '../../../src/domain/activity/skiing.scorer.js';
import { SurfingScorer } from '../../../src/domain/activity/surfing.scorer.js';
import { Availability } from '../../../src/domain/activity/activity.types.js';
import type { ForecastDay } from '../../../src/domain/forecast/forecast.types.js';

describe('activity scorers', () => {
  describe('SkiingScorer', () => {
    const scorer = new SkiingScorer();

    it('scores normal valid skiing conditions', () => {
      expect(scorer.score(baseDay())).to.deep.equal({
        score: 100,
        availability: Availability.AVAILABLE,
      });
    });

    it('scores documented and MVP threshold boundaries deterministically', () => {
      expect(
        scorer.score(
          baseDay({
            minTemperature: -11,
            maxTemperature: -9,
            snowfallSum: 0,
            maxWindSpeed: 20,
            rainSum: 1,
            weatherCode: 61,
          }),
        ),
      ).to.deep.equal({
        score: 53,
        availability: Availability.AVAILABLE,
      });
    });

    it('returns not available when required skiing inputs are missing', () => {
      expect(scorer.score(baseDay({ snowfallSum: null }))).to.deep.equal({
        score: null,
        availability: Availability.NOT_AVAILABLE,
      });
    });

    it('keeps skiing scores in the 0-100 range', () => {
      expectScoreInRange(scorer.score(baseDay()));
    });
  });

  describe('SurfingScorer', () => {
    const scorer = new SurfingScorer();

    it('scores valid marine conditions', () => {
      expect(scorer.score(baseDay())).to.deep.equal({
        score: 100,
        availability: Availability.AVAILABLE,
      });
    });

    it('scores surfing component boundaries deterministically', () => {
      expect(
        scorer.score(
          baseDay({
            maxWindSpeed: 50,
            marine: {
              maxWaveHeight: 0.4,
              maxWavePeriod: 4,
              maxWindWaveHeight: 1,
              maxSwellHeight: 0.5,
              maxSwellPeriod: 6,
            },
          }),
        ),
      ).to.deep.equal({
        score: 21,
        availability: Availability.AVAILABLE,
      });
    });

    it('returns not available when marine data is missing', () => {
      expect(scorer.score(baseDay({ marine: null }))).to.deep.equal({
        score: null,
        availability: Availability.NOT_AVAILABLE,
      });
    });

    it('does not invent a zero score for missing marine inputs', () => {
      expect(
        scorer.score(
          baseDay({
            marine: {
              maxWaveHeight: null,
              maxWavePeriod: 10,
              maxWindWaveHeight: 0.5,
              maxSwellHeight: 1.5,
              maxSwellPeriod: 8,
            },
          }),
        ),
      ).to.deep.equal({
        score: null,
        availability: Availability.NOT_AVAILABLE,
      });
    });

    it('keeps surfing scores in the 0-100 range', () => {
      expectScoreInRange(scorer.score(baseDay()));
    });
  });

  describe('OutdoorSightseeingScorer', () => {
    const scorer = new OutdoorSightseeingScorer();

    it('scores valid outdoor sightseeing conditions', () => {
      expect(
        scorer.score(
          baseDay({
            minTemperature: 20,
            maxTemperature: 22,
          }),
        ),
      ).to.deep.equal({
        score: 100,
        availability: Availability.AVAILABLE,
      });
    });

    it('scores outdoor sightseeing boundaries deterministically', () => {
      expect(
        scorer.score(
          baseDay({
            minTemperature: 29,
            maxTemperature: 31,
            precipitationProbabilityMax: 60,
            precipitationSum: 3,
            maxWindSpeed: 35,
            sunshineDuration: 2 * 60 * 60,
            weatherCode: 61,
          }),
        ),
      ).to.deep.equal({
        score: 41,
        availability: Availability.AVAILABLE,
      });
    });

    it('returns not available when required outdoor inputs are missing', () => {
      expect(scorer.score(baseDay({ sunshineDuration: null }))).to.deep.equal({
        score: null,
        availability: Availability.NOT_AVAILABLE,
      });
    });

    it('keeps outdoor sightseeing scores in the 0-100 range', () => {
      expectScoreInRange(scorer.score(baseDay()));
    });
  });

  describe('IndoorSightseeingScorer', () => {
    const scorer = new IndoorSightseeingScorer();

    it('scores valid indoor sightseeing conditions independently', () => {
      expect(
        scorer.score(
          baseDay({
            minTemperature: 34,
            maxTemperature: 36,
            precipitationProbabilityMax: 90,
            precipitationSum: 12,
            maxWindSpeed: 50,
            weatherCode: 95,
          }),
        ),
      ).to.deep.equal({
        score: 100,
        availability: Availability.AVAILABLE,
      });
    });

    it('scores indoor sightseeing boundaries deterministically', () => {
      expect(
        scorer.score(
          baseDay({
            minTemperature: 20,
            maxTemperature: 22,
            precipitationProbabilityMax: 0,
            precipitationSum: 0,
            maxWindSpeed: 10,
            weatherCode: 3,
          }),
        ),
      ).to.deep.equal({
        score: 20,
        availability: Availability.AVAILABLE,
      });
    });

    it('returns not available when required indoor inputs are missing', () => {
      expect(scorer.score(baseDay({ precipitationSum: null }))).to.deep.equal({
        score: null,
        availability: Availability.NOT_AVAILABLE,
      });
    });

    it('keeps indoor sightseeing scores in the 0-100 range', () => {
      expectScoreInRange(scorer.score(baseDay()));
    });
  });

  it('produces deterministic scoring output for the same forecast day', () => {
    const scorer = new OutdoorSightseeingScorer();
    const day = baseDay();

    expect(scorer.score(day)).to.deep.equal(scorer.score(day));
  });

  function baseDay(overrides: Partial<ForecastDay> = {}): ForecastDay {
    return {
      localDate: '2026-10-06',
      minTemperature: -6,
      maxTemperature: -4,
      precipitationProbabilityMax: 10,
      precipitationSum: 0,
      rainSum: 0,
      snowfallSum: 12,
      maxWindSpeed: 10,
      weatherCode: 3,
      sunshineDuration: 8 * 60 * 60,
      marine: {
        maxWaveHeight: 1.5,
        maxWavePeriod: 10,
        maxWindWaveHeight: 0.5,
        maxSwellHeight: 1.5,
        maxSwellPeriod: 8,
      },
      ...overrides,
    };
  }

  function expectScoreInRange(score: {
    score: number | null;
    availability: Availability;
  }): void {
    expect(score.availability).to.equal(Availability.AVAILABLE);
    expect(score.score).to.be.a('number');
    expect(score.score).to.be.at.least(0);
    expect(score.score).to.be.at.most(100);
  }
});
