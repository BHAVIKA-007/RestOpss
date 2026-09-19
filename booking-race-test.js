import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = 'http://localhost:5000';

const MANAGER_EMAIL = 'manager1@test.com';
const MANAGER_PASSWORD = 'test1234';

const CUSTOMER_EMAIL = 'customer1@test.com';
const CUSTOMER_PASSWORD = 'test1234';

const CONCURRENT_ATTEMPTS = parseInt(
  __ENV.CONCURRENT_ATTEMPTS || '20',
  10
);

// Counters
const confirmedCounter = new Counter('reservation_confirmed_total');
const conflictCounter = new Counter('reservation_conflict_total');
const unexpectedCounter = new Counter('reservation_unexpected_total');
const networkErrorCounter = new Counter('reservation_network_error_total');

// NEW: counts unexpected HTTP statuses separately
const unexpectedStatusCounter = new Counter(
  'reservation_unexpected_status_total'
);

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


// --------------------------------------------------
// LOGIN
// --------------------------------------------------

function login(email, password) {
  const res = http.post(
    `${BASE_URL}/api/users/login`,
    JSON.stringify({
      email,
      password,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  check(res, {
    [`login ${email} succeeded`]: (r) => r.status === 200,
  });

  if (res.status !== 200) {
    throw new Error(
      `Login failed for ${email}: ${res.status} ${res.body}`
    );
  }

  return res.json('token');
}


// --------------------------------------------------
// SETUP
// --------------------------------------------------

export function setup() {

  const managerToken = login(
    MANAGER_EMAIL,
    MANAGER_PASSWORD
  );

  const customerToken = login(
    CUSTOMER_EMAIL,
    CUSTOMER_PASSWORD
  );


  // Get manager's restaurants
  const restRes = http.get(
    `${BASE_URL}/api/restaurants/my`,
    {
      headers: {
        Authorization: `Bearer ${managerToken}`,
      },
    }
  );

  check(restRes, {
    'fetched manager restaurants': (r) =>
      r.status === 200,
  });

  const restaurants = restRes.json();

  if (!restaurants || restaurants.length === 0) {
    throw new Error(
      'Manager account has no restaurant -- create one first.'
    );
  }

  const restaurantId = restaurants[0]._id;


  // Get tables
  const tablesRes = http.get(
    `${BASE_URL}/api/tables`,
    {
      headers: {
        Authorization: `Bearer ${managerToken}`,
      },
    }
  );

  check(tablesRes, {
    'fetched tables': (r) => r.status === 200,
  });

  const tables = tablesRes.json();

  if (!tables || tables.length === 0) {
    throw new Error(
      'Restaurant has no tables -- create one first.'
    );
  }


  // Pick smallest available table
  const table = tables
    .filter((t) => t.status === 'available')
    .sort((a, b) => a.capacity - b.capacity)[0];

  if (!table) {
    throw new Error('No available table found');
  }

  const tableId = table._id;

  const partySize = Math.min(
    2,
    table.capacity
  );


  // Generate future time slot
  const offsetMinutes =
    120 +
    Math.floor(Math.random() * 180);

  const timeSlot = new Date(
    Date.now() +
    offsetMinutes * 60 * 1000
  ).toISOString();


  console.log(
    `Using restaurant ${restaurantId}, ` +
    `table ${tableId} ` +
    `(capacity ${table.capacity}), ` +
    `timeSlot ${timeSlot}`
  );

  console.log(
    `Creating ${CONCURRENT_ATTEMPTS} locked reservations ` +
    `on the same table/time slot...`
  );


  // Create N locked reservations
  const reservationIds = [];

  for (
    let i = 0;
    i < CONCURRENT_ATTEMPTS;
    i++
  ) {

    const res = http.post(
      `${BASE_URL}/api/reservations`,

      JSON.stringify({
        restaurantId,
        tableIds: [tableId],
        partySize,
        timeSlot,
      }),

      {
        headers: {
          Authorization: `Bearer ${customerToken}`,
          'Content-Type': 'application/json',
        },
      }
    );


    if (
      res.status !== 201 &&
      res.status !== 200
    ) {

      console.error(
        `Failed to create locked reservation #${i}: ` +
        `${res.status} ${res.body}`
      );

      continue;
    }


    const body = res.json();

    const id =
      (body.reservation &&
        body.reservation._id) ||
      body._id;


    if (id) {
      reservationIds.push(id);
    }
  }


  if (reservationIds.length < 2) {
    throw new Error(
      `Only created ${reservationIds.length} locked reservations ` +
      `-- need at least 2 to test a race.`
    );
  }


  console.log(
    `Created ${reservationIds.length} locked reservations. ` +
    `Starting concurrent confirm attempts...`
  );


  return {
    customerToken,
    managerToken,
    restaurantId,
    reservationIds,
  };
}


// --------------------------------------------------
// CONCURRENT CONFIRMATION
// --------------------------------------------------

export default function (data) {

  const idx =
    (__VU - 1) %
    data.reservationIds.length;

  const reservationId =
    data.reservationIds[idx];


  const res = http.patch(
    `${BASE_URL}/api/reservations/${reservationId}/confirm`,
    null,
    {
      headers: {
        Authorization:
          `Bearer ${data.customerToken}`,
      },
    }
  );


  // -----------------------------------------------
  // EXPECTED: 200
  // -----------------------------------------------

  if (res.status === 200) {

    confirmedCounter.add(1);
  }


  // -----------------------------------------------
  // EXPECTED: 409
  // -----------------------------------------------

  else if (res.status === 409) {

    conflictCounter.add(1);
  }


  // -----------------------------------------------
  // UNEXPECTED
  // -----------------------------------------------

  else {

    unexpectedCounter.add(1);


    // ---------------------------------------------
    // STATUS 0 = network/client-level failure
    // ---------------------------------------------

    if (res.status === 0) {

      const errorCode =
        res.error_code || 'unknown';

      const errorMessage =
        res.error || '(no error message)';


      networkErrorCounter.add(1, {
        error_code: String(errorCode),
      });


      console.warn(
        `NETWORK FAILURE | ` +
        `reservation=${reservationId} | ` +
        `status=0 | ` +
        `error_code=${errorCode} | ` +
        `error="${errorMessage}"`
      );
    }


    // ---------------------------------------------
    // ACTUAL UNEXPECTED HTTP STATUS
    // ---------------------------------------------

    else {

      unexpectedStatusCounter.add(1, {
        status: String(res.status),
      });


      console.warn(
        `UNEXPECTED HTTP STATUS | ` +
        `reservation=${reservationId} | ` +
        `status=${res.status} | ` +
        `body=${res.body || '(empty)'}`
      );
    }
  }


  // -----------------------------------------------
  // CHECK
  // -----------------------------------------------

  check(res, {
    'response is 200 (confirmed) or 409 (conflict)':
      (r) =>
        r.status === 200 ||
        r.status === 409,
  });
}


// --------------------------------------------------
// TEARDOWN / FINAL VERIFICATION
// --------------------------------------------------

export function teardown(data) {

  sleep(1);


  const res = http.get(
    `${BASE_URL}/api/reservations?status=confirmed&restaurantId=${data.restaurantId}`,
    {
      headers: {
        Authorization:
          `Bearer ${data.managerToken}`,
      },
    }
  );


  if (res.status !== 200) {

    console.error(
      `Could not verify final state: ` +
      `${res.status} ${res.body}`
    );

    return;
  }


  const confirmed = res.json();


  // Only count reservations created by THIS test
  const confirmedFromThisTest =
    confirmed.filter((r) =>
      data.reservationIds.includes(r._id)
    );


  console.log(
    '\n========== RACE CONDITION TEST RESULT =========='
  );

  console.log(
    `Locked reservations created for this test: ` +
    `${data.reservationIds.length}`
  );

  console.log(
    `Now showing status=confirmed: ` +
    `${confirmedFromThisTest.length}`
  );


  if (
    confirmedFromThisTest.length === 1
  ) {

    console.log(
      'PASS -- exactly one reservation confirmed. ' +
      'Double-booking correctly prevented under concurrency.'
    );

  }

  else if (
    confirmedFromThisTest.length === 0
  ) {

    console.log(
      'INCONCLUSIVE -- zero confirmed. ' +
      'Check unexpected/network failures above.'
    );

  }

  else {

    console.log(
      `FAIL -- ${confirmedFromThisTest.length} ` +
      `reservations confirmed simultaneously. ` +
      `Double-booking occurred.`
    );
  }


  console.log(
    '=================================================\n'
  );


  // -----------------------------------------------
  // NETWORK ERROR SUMMARY
  // -----------------------------------------------

  console.log(
    '========== NETWORK ERROR BREAKDOWN (status 0) =========='
  );

  console.log(
    'Network errors are recorded in: ' +
    'reservation_network_error_total'
  );

  console.log(
    '=========================================================\n'
  );


  // -----------------------------------------------
  // UNEXPECTED HTTP STATUS SUMMARY
  // -----------------------------------------------

  console.log(
    '========== UNEXPECTED HTTP STATUS =========='
  );

  console.log(
    'Unexpected HTTP statuses are recorded in:'
  );

  console.log(
    'reservation_unexpected_status_total{status="..."}'
  );

  console.log(
    'Examples: 400, 401, 403, 404, 422, 429, 500, etc.'
  );

  console.log(
    '============================================\n'
  );


  // -----------------------------------------------
  // INTERPRETATION
  // -----------------------------------------------

  console.log(
    '========== TEST INTERPRETATION =========='
  );

  console.log(
    '200 = successful confirmation'
  );

  console.log(
    '409 = expected conflict / correctly rejected'
  );

  console.log(
    'status 0 = no HTTP response received by k6'
  );

  console.log(
    'Other HTTP status = unexpected application/server response'
  );

  console.log(
    '==========================================\n'
  );
}