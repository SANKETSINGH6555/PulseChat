import { Server } from "socket.io";
import http from "http";
import express from "express";
import { ENV } from "./env.js";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";
import User from "../models/User.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [ENV.CLIENT_URL],
    credentials: true,
  },
});

io.use(socketAuthMiddleware);

// map: userId -> socketId
const userSocketMap = {};

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

io.on("connection", async (socket) => {
  console.log("A user connected:", socket.id, socket.user.fullName);

  const userId = socket.userId;
  userSocketMap[userId] = socket.id;

  // ✅ USER IS ONLINE → clear lastSeen
  await User.findByIdAndUpdate(userId, {
    lastSeen: null,
  });

  // ✅ Send online users to everyone
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // ✅ Also send to newly connected user
  socket.emit("getOnlineUsers", Object.keys(userSocketMap));

  // ---------- TYPING INDICATOR ----------
  socket.on("typing", (receiverUserId) => {
    const receiverSocketId = getReceiverSocketId(receiverUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userTyping", true);
    }
  });

  socket.on("stopTyping", (receiverUserId) => {
    const receiverSocketId = getReceiverSocketId(receiverUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userTyping", false);
    }
  });
  // -------------------------------------

  socket.on("disconnect", async () => {
    console.log("A user disconnected:", socket.user.fullName);

    delete userSocketMap[userId];

    // ✅ USER WENT OFFLINE → set lastSeen
    await User.findByIdAndUpdate(userId, {
      lastSeen: new Date(),
    });

    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
