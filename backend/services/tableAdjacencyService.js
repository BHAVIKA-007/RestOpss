const Table = require("../models/Table");

const normalizeIds = (ids = []) => [...new Set(ids.map((id) => id.toString()))];

exports.syncTableAdjacency = async ({ table, previousAdjacentTo = [], nextAdjacentTo = [], restaurantId, session }) => {
  const tableId = table._id.toString();
  const nextIds = normalizeIds(nextAdjacentTo);

  if (nextIds.includes(tableId)) {
    throw new Error("A table cannot be adjacent to itself");
  }

  const query = { _id: { $in: nextIds }, restaurantId };
  const referencedTables = await Table.find(query).select("_id").session(session || null);
  if (referencedTables.length !== nextIds.length) {
    throw new Error("adjacentTo contains a table that does not exist in this restaurant");
  }

  const previousIds = normalizeIds(previousAdjacentTo);
  const removedIds = previousIds.filter((id) => !nextIds.includes(id));
  const addedIds = nextIds.filter((id) => !previousIds.includes(id));

  if (removedIds.length) {
    await Table.updateMany(
      { _id: { $in: removedIds }, restaurantId },
      { $pull: { adjacentTo: table._id } },
      session ? { session } : undefined
    );
  }

  if (addedIds.length) {
    await Table.updateMany(
      { _id: { $in: addedIds }, restaurantId },
      { $addToSet: { adjacentTo: table._id } },
      session ? { session } : undefined
    );
  }
};

exports.removeTableFromAdjacency = async ({ tableId, restaurantId, session }) => {
  await Table.updateMany(
    { restaurantId, adjacentTo: tableId },
    { $pull: { adjacentTo: tableId } },
    session ? { session } : undefined
  );
};