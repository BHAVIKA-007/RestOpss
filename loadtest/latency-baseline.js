// Run (PowerShell; replace example values):
// k6 run -e BASE_URL=http://localhost:5000 -e RESTAURANT_ID=your-restaurant-id -e CUSTOMER_EMAIL=customer@example.com -e CUSTOMER_PASSWORD=your-customer-password -e MANAGER_EMAIL=manager@example.com -e MANAGER_PASSWORD=your-manager-password loadtest/latency-baseline.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const endpointNames = ['restaurants', 'menu', 'suggestCombination', 'myReservations'];
const endpointMetrics = Object.fromEntries(endpointNames.map((name) => [
  name,
  {
    latency: new Trend(`latency_${name}`, true),
    errors: new Rate(`errors_${name}`),
  },
]));

export const options = {
  vus: 10,
  duration: '30s',
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(95)', 'p(99)'],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_failed{endpoint:restaurants}': ['rate<0.01'],
    'http_req_failed{endpoint:menu}': ['rate<0.01'],
    'http_req_failed{endpoint:suggestCombination}': ['rate<0.01'],
    'http_req_failed{endpoint:myReservations}': ['rate<0.01'],
  },
};

function login(email, password, role) {
  const response = http.post(
    `${BASE_URL}/api/users/login`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  let body;
  try {
    body = response.json();
  } catch {
    throw new Error(`${role} login returned non-JSON response (HTTP ${response.status})`);
  }

  if (response.status !== 200 || !body.token) {
    throw new Error(`${role} login failed (HTTP ${response.status}): ${body.message || 'token missing'}`);
  }
  return body.token;
}

export function setup() {
  const requiredEnv = [
    'RESTAURANT_ID',
    'CUSTOMER_EMAIL',
    'CUSTOMER_PASSWORD',
    'MANAGER_EMAIL',
    'MANAGER_PASSWORD',
  ];
  const missing = requiredEnv.filter((name) => !__ENV[name]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    customerToken: login(__ENV.CUSTOMER_EMAIL, __ENV.CUSTOMER_PASSWORD, 'Customer'),
    managerToken: login(__ENV.MANAGER_EMAIL, __ENV.MANAGER_PASSWORD, 'Manager'),
    restaurantId: __ENV.RESTAURANT_ID,
    partySize: __ENV.PARTY_SIZE || '2',
    timeSlot: __ENV.TIME_SLOT || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

function getEndpoint(name, path, token, validateBody) {
  const response = http.get(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { endpoint: name },
  });
  let body;
  try {
    body = response.json();
  } catch {
    body = null;
  }

  const successful = response.status >= 200
    && response.status < 300
    && validateBody(body);

  check(response, {
    [`${name}: HTTP 2xx and expected response shape`]: () => successful,
  });
  endpointMetrics[name].latency.add(response.timings.duration);
  endpointMetrics[name].errors.add(!successful);
}

export default function (data) {
  const suggestionParams = `restaurantId=${encodeURIComponent(data.restaurantId)}`
    + `&partySize=${encodeURIComponent(data.partySize)}`
    + `&timeSlot=${encodeURIComponent(data.timeSlot)}`;

  getEndpoint('restaurants', '/api/restaurants', data.customerToken, Array.isArray);
  getEndpoint('menu', `/api/menu/${encodeURIComponent(data.restaurantId)}`, data.managerToken, Array.isArray);
  getEndpoint(
    'suggestCombination',
    `/api/reservations/suggest-combination?${suggestionParams}`,
    data.customerToken,
    (body) => body !== null
      && Array.isArray(body.suggestions)
      && typeof body.exceedsMaxCapacity === 'boolean',
  );
  getEndpoint('myReservations', '/api/reservations/my', data.customerToken, Array.isArray);

  sleep(1);
}

export function handleSummary(data) {
  const lines = ['Latency baseline by endpoint (latency in ms; errors are response/shape failures):'];

  endpointNames.forEach((name) => {
    const latency = data.metrics[`latency_${name}`]?.values;
    const errors = data.metrics[`errors_${name}`]?.values;
    if (!latency || !errors) {
      lines.push(`${name}: no measurements`);
      return;
    }
    lines.push(
      `${name}: p50=${latency['p(50)']?.toFixed(2) ?? 'n/a'}`
      + ` p95=${latency['p(95)']?.toFixed(2) ?? 'n/a'}`
      + ` p99=${latency['p(99)']?.toFixed(2) ?? 'n/a'}`
      + ` error_rate=${(errors.rate * 100).toFixed(2)}%`,
    );
  });

  return { stdout: `${lines.join('\n')}\n` };
}
