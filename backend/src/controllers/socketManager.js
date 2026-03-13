import { Server } from "socket.io";

let connections = {};
let messages = {};
let timeOnline = {};

export const connectToSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("join-call", (path) => {
      socket.data.room = path;

      if (!connections[path]) {
        connections[path] = [];
      }

      if (!connections[path].includes(socket.id)) {
        connections[path].push(socket.id);
      }

      timeOnline[socket.id] = new Date();

      // Notify everyone in room
      connections[path].forEach((id) => {
        io.to(id).emit("user-joined", socket.id, connections[path]);
      });

      // Send old chat messages to newly joined user
      if (messages[path]) {
        messages[path].forEach((msg) => {
          io.to(socket.id).emit(
            "chat-message",
            msg.data,
            msg.sender,
            msg["socket-id-sender"]
          );
        });
      }

      console.log("Room:", path, "Users:", connections[path]);
    });

    socket.on("signal", (toId, message) => {
      io.to(toId).emit("signal", socket.id, message);
    });

    socket.on("chat-message", (data, sender) => {
      const room = socket.data.room;

      if (!room || !connections[room]) return;

      if (!messages[room]) {
        messages[room] = [];
      }

      const messageData = {
        sender,
        data,
        "socket-id-sender": socket.id,
      };

      messages[room].push(messageData);

      connections[room].forEach((id) => {
        io.to(id).emit("chat-message", data, sender, socket.id);
      });

      console.log("message", room, ":", sender, data);
    });

    socket.on("disconnect", () => {
      const room = socket.data.room;

      if (timeOnline[socket.id]) {
        const diffTime = Math.abs(new Date() - timeOnline[socket.id]);
        console.log(`Socket ${socket.id} was online for ${diffTime}ms`);
        delete timeOnline[socket.id];
      }

      if (!room || !connections[room]) return;

      connections[room] = connections[room].filter((id) => id !== socket.id);

      connections[room].forEach((id) => {
        io.to(id).emit("user-left", socket.id);
      });

      if (connections[room].length === 0) {
        delete connections[room];
        delete messages[room];
      }

      console.log("Socket disconnected:", socket.id);
    });
  });

  return io;
};