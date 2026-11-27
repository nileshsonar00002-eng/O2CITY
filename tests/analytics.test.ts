import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { StationWithAQI } from '../src/types/station.ts';
import {
  buildRankedCities,
  computeAqiDistribution,
  computeDominantPollutantBreakdown,
  computeStateAverages,
  getMaxUpdateTimestamp,
  getTopAndBottomStates,
  isStationCpcbValid,
} from '../src/utils/analytics.ts';

function makeStation(overrides: Partial<StationWithAQI> = {}): StationWithAQI {
  return {
    stationId: overrides.stationId ?? 'st-1',
    stationName: overrides.stationName ?? 'Test Station',
    city: overrides.city ?? 'Pune',
    state: overrides.state ?? 'Maharashtra',
    latitude: 18.52,
    longitude: 73.85,
    active: true,
    source: 'CPCB',
    aqi: 120,
    aqiCategory: 'Moderate',
    pollutants: {
      pm25: 55,
      pm10: 85,
      no2: 30,
      so2: 12,
      co: 0.8,
      o3: 40,
      nh3: null,
    },
    sourceTimestamp: '2026-11-26T10:00:00Z',
    fetchedAt: '2026-11-26T10:05:00Z',
    dataStatus: 'live',
    ...overrides,
  };
}

describe('computeAqiDistribution', () => {
  it('always sums to total stations including 500+ and invalid/null AQI', () => {
    const stations: StationWithAQI[] = [
      makeStation({ stationId: '1', aqi: 30, aqiCategory: 'Good' }),
      makeStation({ stationId: '2', aqi: 75, aqiCategory: 'Satisfactory' }),
      makeStation({ stationId: '3', aqi: 150, aqiCategory: 'Moderate' }),
      makeStation({ stationId: '4', aqi: 250, aqiCategory: 'Poor' }),
      makeStation({ stationId: '5', aqi: 350, aqiCategory: 'Very Poor' }),
      makeStation({ stationId: '6', aqi: 540, aqiCategory: 'Severe' }), // > 500 -> Severe
      makeStation({ stationId: '7', aqi: null, aqiCategory: 'Unavailable' }), // Unclassified
      makeStation({ stationId: '8', aqi: -5, aqiCategory: 'Unavailable' }), // Unclassified
    ];

    const buckets = computeAqiDistribution(stations);
    const total = buckets.reduce((sum, b) => sum + b.count, 0);

    assert.equal(total, stations.length);
    assert.equal(buckets.find((b) => b.category === 'Severe')?.count, 1);
    assert.equal(buckets.find((b) => b.category === 'Unclassified')?.count, 2);
  });
});

describe('isStationCpcbValid & buildRankedCities', () => {
  it('requires 3+ pollutants and at least one of PM2.5 or PM10', () => {
    const valid = makeStation();
    const onlyTwoPollutants = makeStation({
      pollutants: { pm25: 50, pm10: 80, no2: null, so2: null, co: null, o3: null, nh3: null },
    });
    const noParticulate = makeStation({
      pollutants: { pm25: null, pm10: null, no2: 40, so2: 20, co: 1.0, o3: 50, nh3: null },
    });

    assert.equal(isStationCpcbValid(valid), true);
    assert.equal(isStationCpcbValid(onlyTwoPollutants), false);
    assert.equal(isStationCpcbValid(noParticulate), false);
  });

  it('flags 1-valid-station cities as lowConfidence=true and 2+ as lowConfidence=false', () => {
    const stations: StationWithAQI[] = [
      makeStation({ stationId: 'p1', city: 'Pune', state: 'Maharashtra', aqi: 100 }),
      makeStation({ stationId: 'p2', city: 'Pune', state: 'Maharashtra', aqi: 140 }),
      makeStation({ stationId: 'n1', city: 'Nashik', state: 'Maharashtra', aqi: 90 }),
    ];

    const ranked = buildRankedCities(stations);
    const pune = ranked.find((c) => c.city === 'Pune');
    const nashik = ranked.find((c) => c.city === 'Nashik');

    assert.equal(pune?.averageAqi, 120);
    assert.equal(pune?.lowConfidence, false);
    assert.equal(nashik?.averageAqi, 90);
    assert.equal(nashik?.lowConfidence, true);
  });
});

describe('computeStateAverages & getTopAndBottomStates', () => {
  it('filters out states with fewer than 2 valid stations and returns top/bottom N', () => {
    const stations: StationWithAQI[] = [
      makeStation({ stationId: 'mh1', state: 'Maharashtra', aqi: 100 }),
      makeStation({ stationId: 'mh2', state: 'Maharashtra', aqi: 120 }),
      makeStation({ stationId: 'dl1', state: 'Delhi', aqi: 300 }),
      makeStation({ stationId: 'dl2', state: 'Delhi', aqi: 340 }),
      makeStation({ stationId: 'ga1', state: 'Goa', aqi: 40 }), // only 1 station -> excluded
    ];

    const stateAvgs = computeStateAverages(stations, 2);
    assert.equal(stateAvgs.length, 2);
    assert.equal(stateAvgs[0].state, 'Delhi');
    assert.equal(stateAvgs[0].averageAqi, 320);

    const { top, bottom } = getTopAndBottomStates(stateAvgs, 1);
    assert.equal(top[0].state, 'Delhi');
    assert.equal(bottom[0].state, 'Maharashtra');
  });
});

describe('computeDominantPollutantBreakdown & getMaxUpdateTimestamp', () => {
  it('identifies dominant pollutants and computes max timestamp across stations', () => {
    const stations: StationWithAQI[] = [
      makeStation({
        stationId: 'a',
        sourceTimestamp: '2026-11-26T08:00:00Z',
        pollutants: { pm25: 180, pm10: 90, no2: 20, so2: 10, co: 0.5, o3: 30, nh3: null },
      }),
      makeStation({
        stationId: 'b',
        sourceTimestamp: '2026-11-26T12:30:00Z',
        pollutants: { pm25: 30, pm10: 250, no2: 20, so2: 10, co: 0.5, o3: 30, nh3: null },
      }),
    ];

    const breakdown = computeDominantPollutantBreakdown(stations);
    assert.equal(breakdown.length, 2);
    assert.equal(breakdown.reduce((s, b) => s + b.count, 0), 2);

    const maxTs = getMaxUpdateTimestamp(stations, '2026-11-26T07:00:00Z');
    assert.equal(maxTs, '2026-11-26T12:30:00Z');
  });
});
