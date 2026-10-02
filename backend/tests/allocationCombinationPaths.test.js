const test = require('node:test');
const assert = require('node:assert/strict');
const Table = require('../models/Table');
const WaitingQueue = require('../models/WaitingQueue');
const Restaurant = require('../models/Restaurant');
const Reservation = require('../models/Reservation');
const socketService = require('../services/socketService');
socketService.emitToRestaurant = () => {};
const reservationService = require('../services/reservationService');
const allocationService = require('../services/allocationService');
const allocationController = require('../controllers/allocationController');

const restaurantId = 'restaurant-1';
const tables = [
  {
    _id: 'table-4', restaurantId, number: 4, capacity: 4, status: 'available', combinable: true,
    adjacentTo: ['table-3'], async save() {}
  },
  {
    _id: 'table-3', restaurantId, number: 3, capacity: 3, status: 'available', combinable: true,
    adjacentTo: ['table-4'], async save() {}
  }
];

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('host walk-in can select and immediately occupy a free adjacent table combination', async () => {
  const originals = {
    tableFind: Table.find,
    tableFindOne: Table.findOne,
    restaurantFindById: Restaurant.findById,
    reservationFind: Reservation.find,
    checkTableOverlap: reservationService.checkTableOverlap,
    findTableCombinations: reservationService.findTableCombinations
  };
  Table.findOne = () => ({ sort: async () => null });
  Table.find = (filter) => ({
    lean: async () => tables.filter((table) => filter.status !== 'available' || table.status === 'available'),
    then(resolve, reject) {
      return Promise.resolve(tables.filter((table) => !filter._id || filter._id.$in.includes(table._id)))
        .then(resolve, reject);
    }
  });
  Restaurant.findById = () => ({ select: async () => ({ defaultSeatingDurationMinutes: 90 }) });
  Reservation.find = () => ({ lean: async () => [] });
  reservationService.checkTableOverlap = async () => false;
  reservationService.findTableCombinations = originals.findTableCombinations;

  try {
    const host = { role: 'host', restaurantId };
    const optionsResponse = response();
    await allocationController.allocateTable({ user: host, body: { groupSize: 7 } }, optionsResponse);
    assert.equal(optionsResponse.body.status, 'combination_options');
    assert.deepEqual(optionsResponse.body.suggestions[0].tableIds, ['table-3', 'table-4']);

    const seatResponse = response();
    await allocationController.allocateTable({
      user: host,
      body: { groupSize: 7, tableIds: ['table-3', 'table-4'] }
    }, seatResponse);
    assert.equal(seatResponse.body.status, 'allocated');
    assert.deepEqual(tables.map((table) => table.status), ['occupied', 'occupied']);
  } finally {
    Table.find = originals.tableFind;
    Table.findOne = originals.tableFindOne;
    Restaurant.findById = originals.restaurantFindById;
    Reservation.find = originals.reservationFind;
    reservationService.checkTableOverlap = originals.checkTableOverlap;
    reservationService.findTableCombinations = originals.findTableCombinations;
    tables.forEach((table) => { table.status = 'available'; });
  }
});

test('a customer with an available combined-table option cannot enter manager review', async () => {
  const originals = {
    restaurantFindById: Restaurant.findById,
    findTableCombinations: reservationService.findTableCombinations,
    waitingCreate: WaitingQueue.create
  };
  Restaurant.findById = () => ({ select: async () => ({ defaultSeatingDurationMinutes: 90 }) });
  reservationService.findTableCombinations = async () => [{ tableIds: ['table-3', 'table-4'] }];
  let queueCreated = false;
  WaitingQueue.create = async () => { queueCreated = true; };

  try {
    const res = response();
    await allocationController.joinWaitlist({
      user: { role: 'customer', _id: 'customer-1' },
      body: { restaurantId, groupSize: 7, requestedTimeSlot: new Date(Date.now() + 60 * 60 * 1000) }
    }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.status, 'combination_available');
    assert.equal(queueCreated, false);
  } finally {
    Restaurant.findById = originals.restaurantFindById;
    reservationService.findTableCombinations = originals.findTableCombinations;
    WaitingQueue.create = originals.waitingCreate;
  }
});

test('manager approval creates a confirmed reservation and rejection cancels the request', async () => {
  const originals = {
    waitingFindById: WaitingQueue.findById,
    tableFind: Table.find,
    reservationCreate: Reservation.create,
    reservationSlots: Reservation.getLockedTableSlots,
    checkTableOverlap: reservationService.checkTableOverlap
  };
  const entry = {
    _id: 'entry-1',
    restaurantId,
    customer: 'customer-1',
    groupSize: 9,
    requestedTimeSlot: new Date(Date.now() + 60 * 60 * 1000),
    requestedDurationMinutes: 90,
    needsManagerReview: true,
    status: 'waiting',
    async save() {}
  };
  let reservationPayload;
  WaitingQueue.findById = async () => entry;
  Table.find = async () => [{ _id: 'table-3' }, { _id: 'table-4' }];
  Reservation.getLockedTableSlots = () => ['slots'];
  Reservation.create = async (payload) => {
    reservationPayload = payload;
    return { _id: 'reservation-1', timeSlot: payload.timeSlot, toString() { return this._id; } };
  };
  reservationService.checkTableOverlap = async () => false;

  try {
    const manager = { role: 'manager', restaurantId };
    const approveResponse = response();
    await allocationController.resolveManagerReview({
      params: { id: entry._id },
      body: { decision: 'approve', tableIds: ['table-3', 'table-4'] },
      user: manager
    }, approveResponse);
    assert.equal(approveResponse.statusCode, 200);
    assert.equal(entry.status, 'allocated');
    assert.equal(reservationPayload.status, 'confirmed');
    assert.equal(reservationPayload.requiresApproval, false);
    assert.deepEqual(reservationPayload.tables, ['table-3', 'table-4']);

    entry.status = 'waiting';
    const rejectResponse = response();
    await allocationController.resolveManagerReview({
      params: { id: entry._id }, body: { decision: 'reject' }, user: manager
    }, rejectResponse);
    assert.equal(rejectResponse.statusCode, 200);
    assert.equal(entry.status, 'cancelled');
  } finally {
    WaitingQueue.findById = originals.waitingFindById;
    Table.find = originals.tableFind;
    Reservation.create = originals.reservationCreate;
    Reservation.getLockedTableSlots = originals.reservationSlots;
    reservationService.checkTableOverlap = originals.checkTableOverlap;
  }
});

test('manager and host queue queries request active statuses only', async () => {
  const originalFind = WaitingQueue.find;
  const filters = [];
  WaitingQueue.find = (filter) => {
    filters.push(filter);
    if (filter.status === 'waiting') return Promise.resolve([]);
    return {
      populate() { return this; },
      sort: async () => []
    };
  };

  try {
    await allocationService.viewWaitingQueue(restaurantId);
    await allocationService.viewWaitingQueueWithPosition(restaurantId);
    const dashboardFilters = filters.filter((filter) => filter.status?.$in);
    assert.equal(dashboardFilters.length, 2);
    assert.deepEqual(dashboardFilters.map((filter) => filter.status.$in), [
      ['waiting', 'notified'], ['waiting', 'notified']
    ]);
  } finally {
    WaitingQueue.find = originalFind;
  }
});