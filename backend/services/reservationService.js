const Reservation = require("../models/Reservation");
const Table = require("../models/Table");

const normalizeTableId = (value) => value?.toString?.() ?? String(value);

const buildCandidateKey = (tableIds) => [...tableIds].sort().join("|");

const sumCapacities = (tables) => tables.reduce((total, table) => total + Number(table.capacity || 0), 0);

const buildCombinationCandidates = ({ tables, partySize, maxTables = 4 }) => {
  if (!Array.isArray(tables) || tables.length === 0) return [];

  const parsedPartySize = Number(partySize);
  if (!Number.isInteger(parsedPartySize) || parsedPartySize < 1) return [];

  const tableMap = new Map();
  const adjacency = new Map();

  for (const table of tables) {
    const tableId = normalizeTableId(table._id);
    tableMap.set(tableId, table);
    adjacency.set(tableId, new Set());
  }

  for (const table of tables) {
    const currentId = normalizeTableId(table._id);
    const adjacentIds = (table.adjacentTo || [])
      .map(normalizeTableId)
      .filter((adjacentId) => tableMap.has(adjacentId) && adjacentId !== currentId);

    for (const adjacentId of adjacentIds) {
      adjacency.get(currentId).add(adjacentId);
      adjacency.get(adjacentId)?.add(currentId);
    }
  }

  const candidates = [];
  const seen = new Set();

  const addCandidate = (tableIds) => {
    if (!Array.isArray(tableIds) || tableIds.length === 0) return;

    const uniqueIds = [...new Set(tableIds.map(normalizeTableId))].sort();
    if (uniqueIds.length === 0 || uniqueIds.length > maxTables) return;

    const totalCapacity = sumCapacities(uniqueIds.map((id) => tableMap.get(id)).filter(Boolean));
    if (totalCapacity < parsedPartySize) return;

    const key = buildCandidateKey(uniqueIds);
    if (seen.has(key)) return;

    seen.add(key);
    candidates.push({
      tableIds: uniqueIds,
      totalCapacity,
      tableCount: uniqueIds.length,
      overshoot: totalCapacity - parsedPartySize
    });
  };

  for (const table of tables) {
    addCandidate([table._id]);
  }

  for (const table of tables) {
    const startId = normalizeTableId(table._id);
    const dfs = (currentId, currentPath, visited) => {
      if (currentPath.length >= maxTables) return;

      const neighbors = [...(adjacency.get(currentId) || [])];
      for (const neighborId of neighbors) {
        if (visited.has(neighborId)) continue;

        const nextPath = [...currentPath, neighborId];
        addCandidate(nextPath);

        if (nextPath.length < maxTables) {
          const nextVisited = new Set(visited);
          nextVisited.add(neighborId);
          dfs(neighborId, nextPath, nextVisited);
        }
      }
    };

    const initialVisited = new Set([startId]);
    dfs(startId, [startId], initialVisited);
  }

  return candidates
    .sort((a, b) => {
      if (a.overshoot !== b.overshoot) return a.overshoot - b.overshoot;
      if (a.tableCount !== b.tableCount) return a.tableCount - b.tableCount;
      return a.tableIds.join(",").localeCompare(b.tableIds.join(","));
    })
    .slice(0, 3);
};

/**
 * Check if any existing confirmed/seated reservation on the given tables
 * overlaps with the requested time window.
 *
 * @param {Array} tableIds - array of table ObjectId or string
 * @param {Date|string|number} timeSlot - requested start time
 * @param {number} durationMinutes
 * @param {string} excludeReservationId - optional reservation id to ignore
 * @returns {Promise<boolean>} true if overlap found
 */
exports.checkTableOverlap = async (tableIds, timeSlot, durationMinutes, excludeReservationId) => {
  const requestedStart = new Date(timeSlot);
  const requestedEnd = new Date(requestedStart.getTime() + (durationMinutes || 90) * 60000);

  const query = {
    tables: { $in: tableIds },
    status: { $in: ["confirmed", "seated"] }
  };

  if (excludeReservationId) query._id = { $ne: excludeReservationId };

  const existing = await Reservation.find(query).lean();

  for (const r of existing) {
    const existingStart = new Date(r.timeSlot);
    const existingEnd = new Date(existingStart.getTime() + (r.durationMinutes || 90) * 60000);

    if (existingStart < requestedEnd && requestedStart < existingEnd) {
      return true;
    }
  }

  return false;
};

exports.findTableCombinations = async (restaurantId, partySize, timeSlot, durationMinutes) => {
  if (!restaurantId || !partySize || !timeSlot) return [];

  const parsedPartySize = Number(partySize);
  if (!Number.isInteger(parsedPartySize) || parsedPartySize < 1) return [];

  const requestedDuration = Number(durationMinutes || 90);
  if (!Number.isFinite(requestedDuration) || requestedDuration <= 0) return [];

  const combinableTables = await Table.find({ restaurantId, combinable: true }).lean();
  if (!combinableTables.length) return [];

  const freeTables = [];
  for (const table of combinableTables) {
    const tableId = normalizeTableId(table._id);
    const overlap = await exports.checkTableOverlap([tableId], timeSlot, requestedDuration);
    if (!overlap) {
      freeTables.push(table);
    }
  }

  if (!freeTables.length) return [];

  return buildCombinationCandidates({
    tables: freeTables,
    partySize: parsedPartySize,
    maxTables: 4
  });
};

module.exports = {
  checkTableOverlap: exports.checkTableOverlap,
  findTableCombinations: exports.findTableCombinations,
  buildCombinationCandidates
};
