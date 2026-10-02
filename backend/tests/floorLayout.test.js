const assert = require('assert');
const { describe, it } = require('node:test');

const Table = require('../models/Table');
const floorLayoutController = require('../controllers/floorLayoutController');
const { syncTableAdjacency } = require('../services/tableAdjacencyService');

describe('floorLayoutController', () => {
  it('marks reverse-linked tables combinable when synchronizing adjacency', async () => {
    const originalFind = Table.find;
    const originalUpdateMany = Table.updateMany;
    const table = { _id: 'table-1' };
    const adjacentTableId = 'table-2';
    const updates = [];

    Table.find = () => ({
      select: () => ({ session: async () => [{ _id: adjacentTableId }] })
    });
    Table.updateMany = async (...args) => updates.push(args);

    try {
      await syncTableAdjacency({ table, restaurantId: 'restaurant-1', nextAdjacentTo: [adjacentTableId] });
      assert.strictEqual(updates.length, 1);
      assert.deepStrictEqual(updates[0][1], {
        $addToSet: { adjacentTo: table._id },
        $set: { combinable: true }
      });
    } finally {
      Table.find = originalFind;
      Table.updateMany = originalUpdateMany;
    }
  });

  it('rejects invalid grid coordinates with a 400 response', async () => {
    const req = {
      user: { role: 'manager', restaurantId: '507f1f77bcf86cd799439011' },
      body: {
        tables: [{ number: 1, capacity: 4, gridX: -1, gridY: 2, shape: 'square', combinable: true, adjacentTo: [] }],
        elements: []
      }
    };

    const res = {
      statusCode: null,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      }
    };

    await floorLayoutController.saveFloorLayout(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.match(res.body.message, /gridX|gridY/i);
  });
});
