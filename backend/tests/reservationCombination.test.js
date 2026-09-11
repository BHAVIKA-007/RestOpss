const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCombinationCandidates } = require('../services/reservationService');

test('buildCombinationCandidates prefers minimum overshoot and fewer tables', () => {
  const tables = [
    { _id: 't1', capacity: 2, adjacentTo: ['t2'] },
    { _id: 't2', capacity: 2, adjacentTo: ['t1', 't3'] },
    { _id: 't3', capacity: 4, adjacentTo: ['t2', 't4'] },
    { _id: 't4', capacity: 6, adjacentTo: ['t3'] },
    { _id: 't5', capacity: 6, adjacentTo: [] }
  ];

  const result = buildCombinationCandidates({
    tables,
    partySize: 4,
    maxTables: 4
  });

  assert.deepEqual(result[0], {
    tableIds: ['t3'],
    totalCapacity: 4,
    tableCount: 1,
    overshoot: 0
  });

  assert.equal(result.length, 3);
  assert.deepEqual(result.map((item) => item.tableIds).slice(0, 2), [
    ['t3'],
    ['t1', 't2']
  ]);
});

test('buildCombinationCandidates ignores disconnected and non-combinable groups', () => {
  const tables = [
    { _id: 'a', capacity: 2, adjacentTo: ['b'] },
    { _id: 'b', capacity: 2, adjacentTo: ['a'] },
    { _id: 'c', capacity: 2, adjacentTo: [] },
    { _id: 'd', capacity: 4, adjacentTo: [] }
  ];

  const result = buildCombinationCandidates({
    tables,
    partySize: 5,
    maxTables: 4,
    isCombinable: (table) => table._id === 'a' || table._id === 'b' || table._id === 'd'
  });

  assert.deepEqual(result, []);
});

test('buildCombinationCandidates includes a fitting non-combinable singleton', () => {
  const tables = [
    { _id: 'single', capacity: 4, combinable: false, adjacentTo: [] },
    { _id: 'joinable', capacity: 2, combinable: true, adjacentTo: [] }
  ];

  const result = buildCombinationCandidates({
    tables,
    combinableTables: tables.filter((table) => table.combinable),
    partySize: 4
  });

  assert.deepEqual(result[0].tableIds, ['single']);
  assert.equal(result[0].overshoot, 0);
});

test('buildCombinationCandidates does not fall back to oversized tables', () => {
  const result = buildCombinationCandidates({
    tables: [{ _id: 'eight-top', capacity: 8, combinable: false, adjacentTo: [] }],
    combinableTables: [],
    partySize: 2,
    overshootCap: Math.max(2, Math.ceil(2 / 2))
  });

  assert.deepEqual(result, []);
});
