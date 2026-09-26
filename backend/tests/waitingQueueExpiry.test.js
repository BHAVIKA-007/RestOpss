const test = require('node:test');
const assert = require('node:assert/strict');
const WaitingQueue = require('../models/WaitingQueue');
const { isWaitingEntryExpired, viewWaitingQueue } = require('../services/allocationService');

const minute = 60 * 1000;
const now = Date.now();

test('walk-in waitlist entry older than two hours expires on fetch', () => {
  const entry = {
    status: 'waiting',
    requestedTimeSlot: new Date(now - 1630 * minute),
    createdAt: new Date(now - 1630 * minute),
    requestedDurationMinutes: 90
  };

  assert.equal(isWaitingEntryExpired(entry, now), true);
});

test('a fresh waitlist fetch persists a 1630-minute-old entry as expired', async () => {
  const storedEntry = {
    _id: 'old-walk-in',
    restaurantId: 'restaurant',
    status: 'waiting',
    requestedTimeSlot: new Date(now - 1630 * minute),
    createdAt: new Date(now - 1630 * minute),
    requestedDurationMinutes: 90,
    toObject() { return { ...this }; }
  };
  const originalFind = WaitingQueue.find;
  const originalUpdateMany = WaitingQueue.updateMany;
  WaitingQueue.find = (filter) => {
    if (filter.status === 'waiting') return Promise.resolve([storedEntry])
    return {
      populate() { return this },
      sort: async () => [storedEntry],
    }
  };
  WaitingQueue.updateMany = async () => {
    storedEntry.status = 'expired'
    return { modifiedCount: 1 }
  }

  try {
    const result = await viewWaitingQueue('restaurant');
    assert.equal(result[0].status, 'expired');
    assert.equal(storedEntry.status, 'expired');
  } finally {
    WaitingQueue.find = originalFind;
    WaitingQueue.updateMany = originalUpdateMany;
  }
});

test('a future request whose requested slot and duration have passed persists as expired on fetch', async () => {
  const expiredEntry = {
    _id: 'expired-future',
    restaurantId: 'restaurant',
    status: 'waiting',
    requestedTimeSlot: new Date(now - 91 * minute),
    createdAt: new Date(now - 181 * minute),
    requestedDurationMinutes: 90,
    toObject() { return { ...this }; }
  };
  const originalFind = WaitingQueue.find;
  const originalUpdateMany = WaitingQueue.updateMany;
  WaitingQueue.find = (filter) => filter.status === 'waiting'
    ? Promise.resolve([expiredEntry])
    : { populate() { return this }, sort: async () => [expiredEntry] };
  WaitingQueue.updateMany = async () => { expiredEntry.status = 'expired'; return { modifiedCount: 1 } };

  try {
    const entries = await viewWaitingQueue('restaurant');
    assert.equal(entries[0].status, 'expired');
    assert.equal(expiredEntry.status, 'expired');
  } finally {
    WaitingQueue.find = originalFind;
    WaitingQueue.updateMany = originalUpdateMany;
  }
});

test('walk-in waitlist entry remains active for its first two hours', () => {
  const entry = {
    status: 'waiting',
    requestedTimeSlot: new Date(now - 119 * minute),
    createdAt: new Date(now - 119 * minute),
    requestedDurationMinutes: 90
  };

  assert.equal(isWaitingEntryExpired(entry, now), false);
});

test('future-dated entries retain seating-duration expiry behavior', () => {
  const expiredFutureEntry = {
    status: 'waiting',
    requestedTimeSlot: new Date(now - 91 * minute),
    createdAt: new Date(now - 181 * minute),
    requestedDurationMinutes: 90
  };
  const upcomingEntry = {
    ...expiredFutureEntry,
    requestedTimeSlot: new Date(now + minute),
    createdAt: new Date(now)
  };

  assert.equal(isWaitingEntryExpired(expiredFutureEntry, now), true);
  assert.equal(isWaitingEntryExpired(upcomingEntry, now), false);
});

test('non-waiting entries are not reclassified by waiting-entry expiry', () => {
  const entry = {
    status: 'notified',
    requestedTimeSlot: new Date(now - 1630 * minute),
    createdAt: new Date(now - 1630 * minute),
    requestedDurationMinutes: 90
  };

  assert.equal(isWaitingEntryExpired(entry, now), false);
});