import { Server } from "socket.io";

let connections = {};
let messages = {};
let timeOnline = {};

const parseAllowedOrigins = () => {
  const raw = process.env.FRONTEND_URL;
  const fromEnv = raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const defaults = ["http://localhost:3000"];
  return [...new Set([...fromEnv, ...defaults])];
};

const sanitizeRoomId = (room) => {
  const roomId = String(room || "").trim();
  if (!roomId) return null;
  if (roomId.length > 200) return null;
  return roomId;
};

export const connectToSocket = (server) => {
  const allowedOrigins = parseAllowedOrigins();
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("join-call", (room) => {
      const roomId = sanitizeRoomId(room);
      if (!roomId) return;

      socket.data.room = roomId;

      if (!connections[roomId]) {
        connections[roomId] = [];
      }

      if (connections[roomId].includes(socket.id)) return;

      const existingUsers = connections[roomId].slice();
      connections[roomId].push(socket.id);

      timeOnline[socket.id] = new Date();

      // Tell joining user who is already in the room
      io.to(socket.id).emit("existing-users", existingUsers);

      // Notify existing users about the new user
      existingUsers.forEach((id) => {
        io.to(id).emit("user-joined", socket.id);
      });

      // Send old chat messages to newly joined user
      if (messages[roomId]) {
        messages[roomId].forEach((msg) => {
          io.to(socket.id).emit(
            "chat-message",
            msg.data,
            msg.sender,
            msg["socket-id-sender"]
          );
        });
      }

      console.log("Room:", roomId, "Users:", connections[roomId]);
    });

    socket.on("signal", (toId, message) => {
      const roomId = socket.data.room;
      if (!roomId || !connections[roomId]) return;
      if (!connections[roomId].includes(socket.id)) return;
      if (!connections[roomId].includes(toId)) return;
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
