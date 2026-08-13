const { Server } = require("socket.io");

let io;

const initSocket = (server) => {
  if (!server) return;

  io = new Server(server, {
    cors: {
      origin: "*"
    }
  });

  io.on("connection", (socket) => {
    socket.on("joinRestaurant", (restaurantId) => {
      if (!restaurantId) return;
      socket.join(`restaurant:${restaurantId}`);
    });
  });

  return io;
};

const emitToRestaurant = (restaurantId, eventName, payload) => {
  if (!restaurantId || !io || typeof eventName !== "string") {
    console.warn("Socket broadcast skipped: io not initialized or restaurantId missing");
    return;
  }

  io.to(`restaurant:${restaurantId}`).emit(eventName, payload);
};

module.exports = {
  initSocket,
  emitToRestaurant
};
