const axios = require('axios');

const CUSTOMER_A_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhN2RjYjg5MGY2YWY4NTE4NmZlMWM1YyIsInJvbGUiOiJjdXN0b21lciIsImlhdCI6MTc4NjYyOTEwNywiZXhwIjoxNzg3MjMzOTA3fQ.FkZupHSfYLaN0pIvwK8EyxbfekDZaCFUu5kothgT-zE';
const CUSTOMER_B_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhN2RjYjgyMGY2YWY4NTE4NmZlMWM1OSIsInJvbGUiOiJjdXN0b21lciIsImlhdCI6MTc4NjYyOTA5MSwiZXhwIjoxNzg3MjMzODkxfQ.uHUcfPYrrO8SFM1qPnc0h3E-oFpcxFvctz5AgbCDY1Q';
const CUSTOMER_C_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhN2RjYjdiMGY2YWY4NTE4NmZlMWM1NiIsInJvbGUiOiJjdXN0b21lciIsImlhdCI6MTc4NjYyOTA3MCwiZXhwIjoxNzg3MjMzODcwfQ.Noo3f8rGq-lQCwnjH8HmHPGAd7TMUBN5qE5BFw7p6NA';
const CUSTOMER_D_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhN2RjYjZkMGY2YWY4NTE4NmZlMWM1MCIsInJvbGUiOiJjdXN0b21lciIsImlhdCI6MTc4NjYyOTAzMiwiZXhwIjoxNzg3MjMzODMyfQ.JNEMvpnQADpKjnQ-56z9V7qFC76e7lG1gUN6FMYlQSo';
const CUSTOMER_E_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhN2RjYjc0MGY2YWY4NTE4NmZlMWM1MyIsInJvbGUiOiJjdXN0b21lciIsImlhdCI6MTc4NjYyOTA1NSwiZXhwIjoxNzg3MjMzODU1fQ.Y60VKpMuFcTc1lYq6IowOwWpl_mN1Bcl4GXr-wKepiw';

const restaurantId = '6a7896cad962cb7b9df6a3d3';
const tableId = '6a7b4659939afb14c2dfa702';

const api = axios.create({
  baseURL: 'http://localhost:5000',
  validateStatus: () => true
});

async function raceTest() {
  const body = {
    restaurantId: restaurantId,
    tableIds: [tableId],
    partySize: 2,
    timeSlot: '2026-08-21T20:00:00.000Z',
    durationMinutes: 60
  };

  console.log('Creating reservation 1...');

  const res1 = await api.post('/api/reservations', body, {
    headers: {
      Authorization: `Bearer ${CUSTOMER_A_TOKEN}`
    }
  });

  console.log('Reservation 1:', res1.status, res1.data);

  console.log('Creating reservation 2...');

  const res2 = await api.post('/api/reservations', body, {
    headers: {
      Authorization: `Bearer ${CUSTOMER_B_TOKEN}`
    }
  });

  console.log('Reservation 2:', res2.status, res2.data);

  console.log('Creating reservation 3...');

  const res3 = await api.post('/api/reservations', body, {
    headers: {
      Authorization: `Bearer ${CUSTOMER_C_TOKEN}`
    }
  });

  console.log('Reservation 3:', res3.status, res3.data);

  console.log('Creating reservation 4...');

  const res4 = await api.post('/api/reservations', body, {
    headers: {
      Authorization: `Bearer ${CUSTOMER_D_TOKEN}`
    }
  });

  console.log('Reservation 4:', res4.status, res4.data);

  console.log('Creating reservation 5...');

  const res5 = await api.post('/api/reservations', body, {
    headers: {
      Authorization: `Bearer ${CUSTOMER_E_TOKEN}`
    }
  });

  console.log('Reservation 5:', res5.status, res5.data);

  if (
    res1.status !== 201 ||
    res2.status !== 201 ||
    res3.status !== 201 ||
    res4.status !== 201 ||
    res5.status !== 201
  ) {
    console.log('Could not create all 5 reservations.');
    return;
  }

  const id1 = res1.data._id;
  const id2 = res2.data._id;
  const id3 = res3.data._id;
  const id4 = res4.data._id;
  const id5 = res5.data._id;

  console.log('Reservation 1 ID:', id1);
  console.log('Reservation 2 ID:', id2);
  console.log('Reservation 3 ID:', id3);
  console.log('Reservation 4 ID:', id4);
  console.log('Reservation 5 ID:', id5);

  console.log('Sending all 5 confirmations simultaneously...');

  const results = await Promise.all([
    api.patch(
      `/api/reservations/${id1}/confirm`,
      {},
      {
        headers: {
          Authorization: `Bearer ${CUSTOMER_A_TOKEN}`
        }
      }
    ),

    api.patch(
      `/api/reservations/${id2}/confirm`,
      {},
      {
        headers: {
          Authorization: `Bearer ${CUSTOMER_B_TOKEN}`
        }
      }
    ),

    api.patch(
      `/api/reservations/${id3}/confirm`,
      {},
      {
        headers: {
          Authorization: `Bearer ${CUSTOMER_C_TOKEN}`
        }
      }
    ),

    api.patch(
      `/api/reservations/${id4}/confirm`,
      {},
      {
        headers: {
          Authorization: `Bearer ${CUSTOMER_D_TOKEN}`
        }
      }
    ),

    api.patch(
      `/api/reservations/${id5}/confirm`,
      {},
      {
        headers: {
          Authorization: `Bearer ${CUSTOMER_E_TOKEN}`
        }
      }
    )
  ]);

  console.log('\n========== RESULTS ==========');

  console.log('\nResult 1:');
  console.log('Status:', results[0].status);
  console.log('Response:', results[0].data);

  console.log('\nResult 2:');
  console.log('Status:', results[1].status);
  console.log('Response:', results[1].data);

  console.log('\nResult 3:');
  console.log('Status:', results[2].status);
  console.log('Response:', results[2].data);

  console.log('\nResult 4:');
  console.log('Status:', results[3].status);
  console.log('Response:', results[3].data);

  console.log('\nResult 5:');
  console.log('Status:', results[4].status);
  console.log('Response:', results[4].data);
}

raceTest();