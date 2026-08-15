// seed-combination-test.js
// Throwaway test tooling — NOT part of the actual project.
// Run with: node seed-combination-test.js
// Requires: npm install axios (in whatever folder you put this file)

const axios = require('axios');

const BASE = 'http://localhost:5000';
const MANAGER_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhNzg5NjE4ZDk2MmNiN2I5ZGY2YTNjZSIsInJvbGUiOiJjdXN0b21lciIsImlhdCI6MTc4NjI4NzcwMSwiZXhwIjoxNzg2ODkyNTAxfQ.uEELIsolBHEqqVqBVjclLYxpkQWV2UDQ0M_sGSvnpx4'; // Restaurant 1's manager

async function createTable(number, capacity, gridX, gridY, combinable) {
  const res = await axios.post(`${BASE}/api/tables`, {
    number, capacity, gridX, gridY, shape: 'square', combinable
  }, { headers: { Authorization: `Bearer ${MANAGER_TOKEN}` } });
  return res.data.table._id; // adjust path if your response shape differs
}

async function setAdjacency(tableId, adjacentToIds) {
  await axios.patch(`${BASE}/api/tables/${tableId}`, {
    adjacentTo: adjacentToIds
  }, { headers: { Authorization: `Bearer ${MANAGER_TOKEN}` } });
}

async function seed() {
  console.log('Creating tables...');
  const t1 = await createTable(9001, 2, 0, 0, true);
  const t2 = await createTable(9002, 2, 1, 0, true);
  const t3 = await createTable(9003, 2, 2, 0, true);
  const t4 = await createTable(9004, 6, 5, 0, true);
  const t5 = await createTable(9005, 4, 0, 2, false);
  const t6 = await createTable(9006, 2, 1, 2, true);

  console.log('Setting adjacency...');
  await setAdjacency(t1, [t2]);
  await setAdjacency(t2, [t1, t3]);
  await setAdjacency(t3, [t2]);
  // t4 stays isolated — no adjacency set
  await setAdjacency(t5, [t6]); // t5 is non-combinable, shouldn't matter
  await setAdjacency(t6, [t5]);

  console.log('\nDone. Table IDs:');
  console.log({ t1, t2, t3, t4, t5, t6 });
  console.log('\nSave these somewhere — you\'ll need them to verify results.');
}

seed().catch(err => console.error(err.response?.data || err.message));