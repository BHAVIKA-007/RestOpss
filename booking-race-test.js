// booking-race-test.js
// Tests the reservation concurrency backstop: many simultaneous CONFIRM
// requests against overlapping reservations on the SAME table/time slot.
// Expected result: exactly ONE confirms, the rest get 409 Conflict.
//
// Install k6: https://k6.io/docs/get-started/installation/
//
// Run:
//   k6 run \
//     --env BASE_URL=http://localhost:5000 \
//     --env MANAGER_EMAIL=manager1@test.com \
//     --env MANAGER_PASSWORD=test1234 \
//     --env CUSTOMER_EMAIL=customer1@test.com \
//     --env CUSTOMER_PASSWORD=test1234 \
//     --env CONCURRENT_ATTEMPTS=20 \
//     booking-race-test.js
//
// Requirements: the manager account must already own a restaurant with at
// least one table. The customer account must already exist.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = 'http://localhost:5000';
const MANAGER_EMAIL = 'manager1@test.com';
const MANAGER_PASSWORD = "test1234";
const CUSTOMER_EMAIL = "customer1@test.com";
const CUSTOMER_PASSWORD =  "test1234";
const CONCURRENT_ATTEMPTS = parseInt(__ENV.CONCURRENT_ATTEMPTS || '20', 10);

const confirmedCounter = new Counter('reservation_confirmed_total');
const conflictCounter = new Counter('reservation_conflict_total');
const unexpectedCounter = new Counter('reservation_unexpected_total');

export const options = {
  setupTimeout: '5m',

  scenarios: {
    booking_race: {
      executor: 'shared-iterations',
      vus: CONCURRENT_ATTEMPTS,
      iterations: CONCURRENT_ATTEMPTS,
      maxDuration: '30s',
    },
  },

  thresholds: {
    checks: ['rate>0.99'],
  },
};

function login(email, password) {
  const res = http.post(
    `${BASE_URL}/api/users/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(res, { [`login ${email} succeeded`]: (r) => r.status === 200 });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${email}: ${res.status} ${res.body}`);
  }
  return res.json('token');
}

export function setup() {
  if (!MANAGER_EMAIL || !MANAGER_PASSWORD || !CUSTOMER_EMAIL || !CUSTOMER_PASSWORD) {
    throw new Error(
      'Set MANAGER_EMAIL, MANAGER_PASSWORD, CUSTOMER_EMAIL, CUSTOMER_PASSWORD env vars before running.'
    );
  }

  const managerToken = login(MANAGER_EMAIL, MANAGER_PASSWORD);
  const customerToken = login(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

  // Resolve a restaurant this manager runs.
  const restRes = http.get(`${BASE_URL}/api/restaurants/my`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  });
  check(restRes, { 'fetched manager restaurants': (r) => r.status === 200 });
  const restaurants = restRes.json();
  if (!restaurants || restaurants.length === 0) {
    throw new Error('Manager account has no restaurant — create one first.');
  }
  const restaurantId = restaurants[0]._id;

  // Resolve a table under this restaurant.
  const tablesRes = http.get(`${BASE_URL}/api/tables`, {
    headers: { Authorization: `Bearer ${managerToken}` },
  });
  check(tablesRes, { 'fetched tables': (r) => r.status === 200 });
  const tables = tablesRes.json();
  if (!tables || tables.length === 0) {
    throw new Error('Restaurant has no tables — create one first.');
  }
  const table = tables
  .filter(t => t.status === "available")
  .sort((a, b) => a.capacity - b.capacity)[0];

if (!table) {
    throw new Error("No available table found");
}
  const tableId = table._id;
  const partySize = Math.min(2, table.capacity);

  // Pick a time slot safely in the future (2h + a random offset, so repeated
  // runs don't collide with a leftover confirmed reservation from a
  // previous run at the exact same table/time bucket).
  const offsetMinutes = 120 + Math.floor(Math.random() * 180);
  const timeSlot = new Date(Date.now() + offsetMinutes * 60 * 1000).toISOString();

  console.log(
    `Using restaurant ${restaurantId}, table ${tableId} (capacity ${table.capacity}), timeSlot ${timeSlot}`
  );
  console.log(`Creating ${CONCURRENT_ATTEMPTS} locked reservations on the same table/time slot...`);

  // NOTE: durationMinutes is intentionally NOT sent — the backend now
  // derives seating duration from the restaurant's own setting, not from
  // the caller.
  const reservationIds = [];
  for (let i = 0; i < CONCURRENT_ATTEMPTS; i++) {
    const res = http.post(
      `${BASE_URL}/api/reservations`,
      JSON.stringify({ restaurantId, tableIds: [tableId], partySize, timeSlot }),
      { headers: { Authorization: `Bearer ${customerToken}`, 'Content-Type': 'application/json' } }
    );

    if (res.status !== 201 && res.status !== 200) {
      console.error(`Failed to create locked reservation #${i}: ${res.status} ${res.body}`);
      continue;
    }
    const body = res.json();
    const id = (body.reservation && body.reservation._id) || body._id;
    if (id) reservationIds.push(id);
  }

  if (reservationIds.length < 2) {
    throw new Error(
      `Only created ${reservationIds.length} locked reservations — need at least 2 to test a race. Check errors above.`
    );
  }

  console.log(`Created ${reservationIds.length} locked reservations. Starting concurrent confirm attempts...`);

  return {
    customerToken,
    managerToken,
    restaurantId,
    reservationIds
};
}

export default function (data) {
  const idx = (__VU - 1) % data.reservationIds.length;
  const reservationId = data.reservationIds[idx];

  const res = http.patch(
    `${BASE_URL}/api/reservations/${reservationId}/confirm`,
    null,
    { headers: { Authorization: `Bearer ${data.customerToken}` } }
  );

  if (res.status === 200) {
    confirmedCounter.add(1);
  } else if (res.status === 409) {
    conflictCounter.add(1);
  } else {
    unexpectedCounter.add(1);
    console.warn(`Unexpected status ${res.status} confirming ${reservationId}: ${res.body}`);
  }

  check(res, {
    'response is 200 (confirmed) or 409 (conflict)': (r) => r.status === 200 || r.status === 409,
  });
}

export function teardown(data) {
  // Give the last writes a moment to settle before reading final state.
  sleep(1);

  const res = http.get(
    `${BASE_URL}/api/reservations?status=confirmed&restaurantId=${data.restaurantId}`,
    {
        headers: { Authorization: `Bearer ${data.managerToken}` },
    }
);

  if (res.status !== 200) {
    console.error(`Could not verify final state: ${res.status} ${res.body}`);
    return;
  }

  const confirmed = res.json();
  const confirmedFromThisTest = confirmed.filter((r) => data.reservationIds.includes(r._id));

  console.log('\n========== RACE CONDITION TEST RESULT ==========');
  console.log(`Locked reservations created for this test: ${data.reservationIds.length}`);
  console.log(`Now showing status=confirmed: ${confirmedFromThisTest.length}`);

  if (confirmedFromThisTest.length === 1) {
    console.log('PASS — exactly one reservation confirmed. Double-booking correctly prevented under concurrency.');
  } else if (confirmedFromThisTest.length === 0) {
    console.log('INCONCLUSIVE — zero confirmed. Check the "unexpected status" warnings above for an unrelated failure.');
  } else {
    console.log(`FAIL — ${confirmedFromThisTest.length} reservations confirmed simultaneously. Double-booking occurred.`);
  }
  console.log('=================================================\n');
}