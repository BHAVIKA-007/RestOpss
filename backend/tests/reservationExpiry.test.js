const test = require('node:test');
const assert = require('node:assert/strict');
const Reservation = require('../models/Reservation');
const socketService = require('../services/socketService');
const reservationExpiry = require('../jobs/reservationExpiry');
const jobs = require('../jobs');
const allocationService = require('../services/allocationService');
const reservationController = require('../controllers/reservationController');
const { EXPIRY_SWEEP_MARGIN_MS, APPROVAL_PENDING_GRACE_MS } = require('../config/timing');

const now = new Date('2026-11-01T10:00:00.000Z');
const originalEmit = socketService.emitToRestaurant;
let nextReservationId = 0;

test.before(() => {
  socketService.emitToRestaurant = () => {};
});

test.after(() => {
  socketService.emitToRestaurant = originalEmit;
});

function isCandidate(reservation, filter) {
  if (reservation.status !== filter.status) return false;
  return filter.$or.some((branch) => {
    const approvalMatches = branch.requiresApproval === true
      ? reservation.requiresApproval === true
      : reservation.requiresApproval !== true;
    return approvalMatches && reservation.lockExpiresAt < branch.lockExpiresAt.$lt;
  });
}

function matchesUpdateFilter(reservation, filter) {
  const approvalMatches = typeof filter.requiresApproval === 'object'
    ? reservation.requiresApproval !== true
    : reservation.requiresApproval === filter.requiresApproval;
  return reservation._id === filter._id
    && reservation.status === filter.status
    && approvalMatches
    && reservation.lockExpiresAt < filter.lockExpiresAt.$lt;
}

async function withReservations(reservations, run) {
  const originalFind = Reservation.find;
  const originalFindOneAndUpdate = Reservation.findOneAndUpdate;
  let batchSize;

  Reservation.find = (filter) => ({
    sort() { return this; },
    limit(limit) { batchSize = limit; return this; },
    lean: async () => reservations
      .filter((reservation) => isCandidate(reservation, filter))
      .sort((a, b) => a.lockExpiresAt - b.lockExpiresAt)
      .slice(0, batchSize)
  });

  Reservation.findOneAndUpdate = async (filter, update) => {
    const reservation = reservations.find((item) => item._id === filter._id);
    if (!reservation || !matchesUpdateFilter(reservation, filter)) return null;
    Object.assign(reservation, update.$set);
    return reservation;
  };

  try {
    return await run();
  } finally {
    Reservation.find = originalFind;
    Reservation.findOneAndUpdate = originalFindOneAndUpdate;
  }
}

function makeReservation(overrides = {}) {
  return {
    _id: `reservation-${++nextReservationId}`,
    restaurantId: 'restaurant-1',
    customer: 'customer-1',
    tables: ['table-1'],
    status: 'locked',
    requiresApproval: false,
    lockExpiresAt: new Date(now.getTime() - 2 * 60 * 1000),
    lockedTableSlots: ['slot-1'],
    expiredAt: null,
    ...overrides
  };
}

test('expires a stale locked reservation and clears its locked table slots', async () => {
  const reservation = makeReservation();

  const result = await withReservations([reservation], async () => {
    const before = { ...reservation };
    const after = await reservationExpiry.expireStaleReservations(now);
    return { before, after };
  });

  assert.equal(result.before.status, 'locked');
  assert.deepEqual(result.before.lockedTableSlots, ['slot-1']);
  assert.equal(result.after.expiredCount, 1);
  assert.deepEqual(result.after.ids, [reservation._id]);
  assert.equal(reservation.status, 'expired');
  assert.equal(reservation.expiredAt, now);
  assert.deepEqual(reservation.lockedTableSlots, []);
});

test('leaves future and locks inside the one-minute safety margin untouched', async () => {
  const reservations = [
    makeReservation({ lockExpiresAt: new Date(now.getTime() + 1000) }),
    makeReservation({ lockExpiresAt: new Date(now.getTime() - EXPIRY_SWEEP_MARGIN_MS + 1000) })
  ];

  const result = await withReservations(reservations, () => reservationExpiry.expireStaleReservations(now));

  assert.equal(result.expiredCount, 0);
  assert.ok(reservations.every((reservation) => reservation.status === 'locked'));
});

test('gives approval-required locks the grace period and expires them after it passes', async () => {
  const withinGrace = makeReservation({
    requiresApproval: true,
    lockExpiresAt: new Date(now.getTime() - APPROVAL_PENDING_GRACE_MS + 1000)
  });
  const pastGrace = makeReservation({
    requiresApproval: true,
    lockExpiresAt: new Date(now.getTime() - APPROVAL_PENDING_GRACE_MS - 1000)
  });

  const result = await withReservations([withinGrace, pastGrace], () => reservationExpiry.expireStaleReservations(now));

  assert.equal(withinGrace.status, 'locked');
  assert.equal(pastGrace.status, 'expired');
  assert.deepEqual(result.ids, [pastGrace._id]);
});

test('does not alter confirmed, seated, completed, cancelled, or no-show reservations', async () => {
  const reservations = ['confirmed', 'seated', 'completed', 'cancelled', 'no_show']
    .map((status) => makeReservation({ status }));

  const result = await withReservations(reservations, () => reservationExpiry.expireStaleReservations(now));

  assert.equal(result.expiredCount, 0);
  assert.deepEqual(reservations.map((reservation) => reservation.status), ['confirmed', 'seated', 'completed', 'cancelled', 'no_show']);
});

test('running the sweep twice is idempotent', async () => {
  const reservation = makeReservation();

  const results = await withReservations([reservation], async () => [
    await reservationExpiry.expireStaleReservations(now),
    await reservationExpiry.expireStaleReservations(now)
  ]);

  assert.equal(results[0].expiredCount, 1);
  assert.equal(results[1].expiredCount, 0);
});

test('expired reservations return 410 on confirm and disappear from the approvals query', async () => {
  const expiredLock = makeReservation({
    _id: 'expired-confirm',
    lockExpiresAt: new Date(now.getTime() - 2 * 60 * 1000)
  });
  const expiredApproval = makeReservation({
    _id: 'expired-approval',
    requiresApproval: true,
    lockExpiresAt: new Date(now.getTime() - APPROVAL_PENDING_GRACE_MS - 2 * 60 * 1000)
  });

  await withReservations([expiredLock, expiredApproval], () => reservationExpiry.expireStaleReservations(now));

  const originalFindById = Reservation.findById;
  const originalFind = Reservation.find;
  Reservation.findById = async () => expiredLock;
  Reservation.find = (filter) => {
    const matches = [expiredLock, expiredApproval].filter((reservation) =>
      filter.status.$in.includes(reservation.status)
      && reservation.requiresApproval === (filter.requiresApproval === true)
    );
    return {
      populate() { return this; },
      sort: async () => matches
    };
  };

  function response() {
    return {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }
    };
  }

  try {
    const confirmResponse = response();
    await reservationController.confirmReservation({
      params: { id: expiredLock._id },
      user: { _id: 'customer-1' }
    }, confirmResponse);

    const approvalResponse = response();
    await reservationController.getRestaurantReservations({
      restaurantId: 'restaurant-1',
      query: { status: 'locked', requiresApproval: 'true' }
    }, approvalResponse);

    assert.equal(confirmResponse.statusCode, 410);
    assert.equal(confirmResponse.body.message, 'Reservation lock expired; please create a new reservation');
    assert.equal(expiredLock.status, 'expired');
    assert.equal(expiredApproval.status, 'expired');
    assert.deepEqual(approvalResponse.body, []);
  } finally {
    Reservation.findById = originalFindById;
    Reservation.find = originalFind;
  }
});

test('a failed socket emit does not abort expiration of the batch', async () => {
  const reservations = [makeReservation(), makeReservation()];
  const originalEmit = socketService.emitToRestaurant;
  const originalError = console.error;
  let emitCount = 0;
  socketService.emitToRestaurant = () => {
    emitCount += 1;
    if (emitCount === 1) throw new Error('socket unavailable');
  };
  console.error = () => {};

  try {
    const result = await withReservations(reservations, () => reservationExpiry.expireStaleReservations(now));
    assert.equal(result.expiredCount, 2);
    assert.ok(reservations.every((reservation) => reservation.status === 'expired'));
  } finally {
    socketService.emitToRestaurant = originalEmit;
    console.error = originalError;
  }
});

test('the scheduler skips overlapping ticks while a sweep is running', async () => {
  const originalExpire = reservationExpiry.expireStaleReservations;
  const originalWaitlistExpiry = allocationService.expireStaleWaitingEntries;
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  const originalDisabled = process.env.DISABLE_BACKGROUND_JOBS;
  let intervalCallback;
  let resolveSweep;
  let sweepCount = 0;

  process.env.DISABLE_BACKGROUND_JOBS = 'false';
  reservationExpiry.expireStaleReservations = () => {
    sweepCount += 1;
    return new Promise((resolve) => { resolveSweep = resolve; });
  };
  allocationService.expireStaleWaitingEntries = async () => 0;
  global.setInterval = (callback) => {
    intervalCallback = callback;
    return 17;
  };
  global.clearInterval = () => {};

  try {
    jobs.startBackgroundJobs();
    intervalCallback();
    assert.equal(sweepCount, 1);
    intervalCallback();
    assert.equal(sweepCount, 1);
    resolveSweep({ expiredCount: 0 });
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    jobs.stopBackgroundJobs();
    reservationExpiry.expireStaleReservations = originalExpire;
    allocationService.expireStaleWaitingEntries = originalWaitlistExpiry;
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
    if (originalDisabled === undefined) delete process.env.DISABLE_BACKGROUND_JOBS;
    else process.env.DISABLE_BACKGROUND_JOBS = originalDisabled;
  }
});
