const test = require('node:test');
const assert = require('node:assert/strict');
const Table = require('../models/Table');
const WaitingQueue = require('../models/WaitingQueue');
const reservationService = require('../services/reservationService');
const { rematchWaitingEntries } = require('../services/allocationService');

const tableId = '507f1f77bcf86cd799439011';
const restaurantId = '507f1f77bcf86cd799439012';

const query = (result) => ({
  lean: async () => result,
  select() { return this },
  sort: async () => result
});

test('a table already matched to an overlapping live request is not matched twice', async () => {
  const now = Date.now();
  const waitingEntry = {
    _id: 'waiting-entry',
    restaurantId,
    status: 'waiting',
    groupSize: 2,
    requestedTimeSlot: new Date(now + 30 * 60000),
    requestedDurationMinutes: 60,
    matchedTableIds: [],
    save: async () => {}
  };
  const activeMatch = {
    matchedTableIds: [tableId],
    requestedTimeSlot: new Date(now + 20 * 60000),
    requestedDurationMinutes: 60
  };

  const originalTableFind = Table.find;
  const originalQueueFind = WaitingQueue.find;
  const originalCheckOverlap = reservationService.checkTableOverlap;
  Table.find = (filter) => {
    if (filter.status === 'available' && filter._id) return query([{ _id: tableId, capacity: 4, combinable: false }]);
    return query([{ _id: tableId, capacity: 4, combinable: false }]);
  };
  WaitingQueue.find = (filter) => filter.status === 'waiting'
    ? query([waitingEntry])
    : query([activeMatch]);
  reservationService.checkTableOverlap = async () => false;

  try {
    const result = await rematchWaitingEntries({
      restaurantId,
      tableIds: [tableId],
      availabilityStart: new Date(now),
      availabilityDurationMinutes: 60
    });

    assert.deepEqual(result, { matched: false, reason: 'no_compatible_group' });
    assert.deepEqual(waitingEntry.matchedTableIds, []);
  } finally {
    Table.find = originalTableFind;
    WaitingQueue.find = originalQueueFind;
    reservationService.checkTableOverlap = originalCheckOverlap;
  }
});
