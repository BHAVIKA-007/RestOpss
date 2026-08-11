const assert = require('assert');
const { describe, it } = require('node:test');

const floorLayoutController = require('../controllers/floorLayoutController');

describe('floorLayoutController', () => {
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
