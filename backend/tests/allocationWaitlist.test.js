const test = require('node:test');
const assert = require('node:assert/strict');
const WaitingQueue = require('../models/WaitingQueue');
const socketService = require('../services/socketService');

socketService.emitToRestaurant = () => {};
const { cancelWaitlistEntry, expireWaitlistEntry } = require('../controllers/allocationController');

function makeEntry() {
  return {
    _id: 'entry-id',
    status: 'waiting',
    restaurantId: {
      equals: (id) => id === 'restaurant-1',
      toString: () => 'restaurant-1'
    },
    customer: {
      equals: (id) => id === 'customer-1'
    },
    async save() {}
  };
}

async function cancelAs(entry, user) {
  const originalFindById = WaitingQueue.findById;
  WaitingQueue.findById = async () => entry;

  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };

  try {
    await cancelWaitlistEntry({ params: { id: 'entry-id' }, user }, response);
    return response;
  } finally {
    WaitingQueue.findById = originalFindById;
  }
}

test('manager or host can cancel entries belonging to their restaurant', async () => {
  for (const role of ['manager', 'host']) {
    const entry = makeEntry();
    const response = await cancelAs(entry, { role, restaurantId: 'restaurant-1' });

    assert.equal(response.statusCode, 200);
    assert.equal(entry.status, 'cancelled');
  }
});

test('staff from another restaurant cannot cancel an entry', async () => {
  const entry = makeEntry();
  const response = await cancelAs(entry, { role: 'host', restaurantId: 'restaurant-2' });

  assert.equal(response.statusCode, 403);
  assert.equal(entry.status, 'waiting');
});

test('a customer can cancel only their own linked entry', async () => {
  const ownEntry = makeEntry();
  const ownResponse = await cancelAs(ownEntry, { role: 'customer', _id: 'customer-1' });
  const otherEntry = makeEntry();
  const otherResponse = await cancelAs(otherEntry, { role: 'customer', _id: 'customer-2' });

  assert.equal(ownResponse.statusCode, 200);
  assert.equal(ownEntry.status, 'cancelled');
  assert.equal(otherResponse.statusCode, 403);
  assert.equal(otherEntry.status, 'waiting');
});

test('manual expiry check marks an abandoned walk-in entry expired', async () => {
  const entry = makeEntry();
  entry.requestedTimeSlot = new Date(Date.now() - 1630 * 60 * 1000);
  entry.createdAt = entry.requestedTimeSlot;
  entry.requestedDurationMinutes = 90;
  const originalFindById = WaitingQueue.findById;
  WaitingQueue.findById = async () => entry;
  const response = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };

  try {
    await expireWaitlistEntry({
      params: { id: 'entry-id' },
      body: {},
      user: { role: 'host', restaurantId: 'restaurant-1' }
    }, response);
  } finally {
    WaitingQueue.findById = originalFindById;
  }

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.entry.status, 'expired');
  assert.equal(entry.status, 'expired');
});