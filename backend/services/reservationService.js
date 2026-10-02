const Reservation = require("../models/Reservation");
const Table = require("../models/Table");
const Restaurant = require("../models/Restaurant");

const CUSTOMER_OVERSHOOT_CAP = (partySize) => Math.max(2, Math.ceil(partySize / 2));

const normalizeTableId = (value) => value?.toString?.() ?? String(value);

const buildCandidateKey = (tableIds) => [...tableIds].sort().join("|");

const sumCapacities = (tables) => tables.reduce((total, table) => total + Number(table.capacity || 0), 0);

const timeWindowsOverlap = (firstStart, firstDurationMinutes, secondStart, secondDurationMinutes) => {
  const firstEnd = new Date(firstStart).getTime() + Number(firstDurationMinutes) * 60000;
  const secondEnd = new Date(secondStart).getTime() + Number(secondDurationMinutes) * 60000;
  return new Date(firstStart).getTime() < secondEnd && new Date(secondStart).getTime() < firstEnd;
};

const buildCombinationCandidates = ({ tables, combinableTables = tables, partySize, maxTables = 4, overshootCap = null, resultLimit = 3 }) => {
  if (!Array.isArray(tables) || tables.length === 0) return [];

  const parsedPartySize = Number(partySize);
  if (!Number.isInteger(parsedPartySize) || parsedPartySize < 1) return [];

  const tableMap = new Map();
  const adjacency = new Map();

  for (const table of tables) {
    const tableId = normalizeTableId(table._id);
    tableMap.set(tableId, table);
  }

  for (const table of combinableTables) {
    const tableId = normalizeTableId(table._id);
    if (tableMap.has(tableId)) adjacency.set(tableId, new Set());
  }

  for (const table of combinableTables) {
    const currentId = normalizeTableId(table._id);
    if (!adjacency.has(currentId)) continue;
    const adjacentIds = (table.adjacentTo || [])
      .map(normalizeTableId)
      .filter((adjacentId) => adjacency.has(adjacentId) && adjacentId !== currentId);

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
    .filter((candidate) => overshootCap === null || candidate.overshoot <= overshootCap)
    .slice(0, resultLimit);
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
  if (!Number.isFinite(Number(durationMinutes)) || Number(durationMinutes) <= 0) {
    throw new Error("Reservation duration is required");
  }

  const requestedStart = new Date(timeSlot);

  const query = {
    tables: { $in: tableIds },
    status: { $in: ["confirmed", "seated"] }
  };

  if (excludeReservationId) query._id = { $ne: excludeReservationId };

  const existing = await Reservation.find(query).lean();

  for (const r of existing) {
    const existingStart = new Date(r.timeSlot);
    if (!Number.isFinite(Number(r.durationMinutes)) || Number(r.durationMinutes) <= 0) {
      throw new Error("Stored reservation duration is required");
    }

    if (timeWindowsOverlap(requestedStart, durationMinutes, existingStart, r.durationMinutes)) {
      return true;
    }
  }

  return false;
};

exports.findTableCombinations = async (restaurantId, partySize, timeSlot, durationMinutes, { enforceOvershootCap = false, onlyAvailableTables = false, resultLimit = 3 } = {}) => {
  if (!restaurantId || !partySize || !timeSlot) return [];

  const parsedPartySize = Number(partySize);
  if (!Number.isInteger(parsedPartySize) || parsedPartySize < 1) return [];

  const requestedDuration = Number(durationMinutes);
  if (!Number.isFinite(requestedDuration) || requestedDuration <= 0) return [];

  const allTables = await Table.find({ restaurantId, ...(onlyAvailableTables ? { status: "available" } : {}) }).lean();
  if (!allTables.length) return [];

  const freeTables = [];
  for (const table of allTables) {
    const tableId = normalizeTableId(table._id);
    const overlap = await exports.checkTableOverlap([tableId], timeSlot, requestedDuration);
    if (!overlap) {
      freeTables.push(table);
    }
  }

  if (!freeTables.length) return [];

  const combinableFreeTables = freeTables.filter((table) => table.combinable === true);

  return buildCombinationCandidates({
    tables: freeTables,
    combinableTables: combinableFreeTables,
    partySize: parsedPartySize,
    maxTables: 4,
    overshootCap: enforceOvershootCap ? CUSTOMER_OVERSHOOT_CAP(parsedPartySize) : null,
    resultLimit
  });
};

exports.getCustomerOvershootCap = CUSTOMER_OVERSHOOT_CAP;

const getComputedTheoreticalMaxSeatablePartySize = async (restaurantId) => {
  const tables = await Table.find({ restaurantId }).lean();
  if (!tables.length) return 0;

  const tableMap = new Map(tables.map((table) => [normalizeTableId(table._id), table]));
  const combinableIds = new Set(tables.filter((table) => table.combinable === true).map((table) => normalizeTableId(table._id)));
  const adjacency = new Map([...combinableIds].map((tableId) => [tableId, new Set()]));

  for (const table of tables) {
    const tableId = normalizeTableId(table._id);
    if (!combinableIds.has(tableId)) continue;

    for (const adjacentId of (table.adjacentTo || []).map(normalizeTableId)) {
      if (combinableIds.has(adjacentId) && adjacentId !== tableId) {
        adjacency.get(tableId).add(adjacentId);
        adjacency.get(adjacentId).add(tableId);
      }
    }
  }

  let maximum = Math.max(...tables.map((table) => Number(table.capacity || 0)));
  const visited = new Set();

  for (const startId of combinableIds) {
    if (visited.has(startId)) continue;

    const stack = [startId];
    let componentCapacity = 0;
    while (stack.length) {
      const tableId = stack.pop();
      if (visited.has(tableId)) continue;
      visited.add(tableId);
      componentCapacity += Number(tableMap.get(tableId)?.capacity || 0);
      stack.push(...(adjacency.get(tableId) || []));
    }
    maximum = Math.max(maximum, componentCapacity);
  }

  return maximum;
};

exports.getRestaurantMaxCapacity = async (restaurantId) => {
  const [restaurant, computedCapacity] = await Promise.all([
    Restaurant.findById(restaurantId).select("maxPartySizeOverride").lean(),
    getComputedTheoreticalMaxSeatablePartySize(restaurantId)
  ]);

  if (!restaurant) return null;

  const override = restaurant.maxPartySizeOverride;
  return Number.isFinite(override) ? Math.max(override, computedCapacity) : computedCapacity;
};

exports.getTableAvailability = async (restaurantId, timeSlot, durationMinutes) => {
  const tables = await Table.find({ restaurantId }).select("_id").lean();
  return Promise.all(tables.map(async (table) => ({
    tableId: normalizeTableId(table._id),
    availableAtRequestedTime: !(await exports.checkTableOverlap([table._id], timeSlot, durationMinutes))
  })));
};

module.exports = {
  checkTableOverlap: exports.checkTableOverlap,
  timeWindowsOverlap,
  findTableCombinations: exports.findTableCombinations,
  buildCombinationCandidates,
  getCustomerOvershootCap: exports.getCustomerOvershootCap,
  getRestaurantMaxCapacity: exports.getRestaurantMaxCapacity,
  getTableAvailability: exports.getTableAvailability
};
