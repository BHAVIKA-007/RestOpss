const axios = require("axios");

const BASE = "http://localhost:5000";
const MANAGER_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhNzg5NjE4ZDk2MmNiN2I5ZGY2YTNjZSIsInJvbGUiOiJjdXN0b21lciIsImlhdCI6MTc4NjI4NzcwMSwiZXhwIjoxNzg2ODkyNTAxfQ.uEELIsolBHEqqVqBVjclLYxpkQWV2UDQ0M_sGSvnpx4";

const tables = [
  {
    _id: "6a801cb3bee84ffb304b5cb4",
    number: 9001,
    capacity: 2,
    gridX: 0,
    gridY: 0,
    shape: "square",
    combinable: true,
    adjacentTo: ["6a801cb3bee84ffb304b5cb8"]
  },
  {
    _id: "6a801cb3bee84ffb304b5cb8",
    number: 9002,
    capacity: 2,
    gridX: 1,
    gridY: 0,
    shape: "square",
    combinable: true,
    adjacentTo: [
      "6a801cb3bee84ffb304b5cb4",
      "6a801cb3bee84ffb304b5cbc"
    ]
  },
  {
    _id: "6a801cb3bee84ffb304b5cbc",
    number: 9003,
    capacity: 2,
    gridX: 2,
    gridY: 0,
    shape: "square",
    combinable: true,
    adjacentTo: ["6a801cb3bee84ffb304b5cb8"]
  },
  {
    _id: "6a801cb3bee84ffb304b5cc0",
    number: 9004,
    capacity: 6,
    gridX: 5,
    gridY: 0,
    shape: "square",
    combinable: true,
    adjacentTo: []
  },
  {
    _id: "6a801cb3bee84ffb304b5cc4",
    number: 9005,
    capacity: 4,
    gridX: 0,
    gridY: 2,
    shape: "square",
    combinable: false,
    adjacentTo: ["6a801cb3bee84ffb304b5cc8"]
  },
  {
    _id: "6a801cb3bee84ffb304b5cc8",
    number: 9006,
    capacity: 2,
    gridX: 1,
    gridY: 2,
    shape: "square",
    combinable: true,
    adjacentTo: ["6a801cb3bee84ffb304b5cc4"]
  }
];

async function fixAdjacency() {
  try {
    const res = await axios.post(
      `${BASE}/api/floor-layout`,
      {
        tables,
        elements: []
      },
      {
        headers: {
          Authorization: `Bearer ${MANAGER_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log(res.data.message);
    console.log("Adjacency updated successfully.");
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
}

fixAdjacency();