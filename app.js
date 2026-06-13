import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from 'dotenv';
import compression from "compression";

import authRoutes from "./router/auth.routes.js";
import chatRoutes from "./router/chat.routes.js";
import connectDb from "./db/db.config.js";
import User from "./model/User.js";
import mongoose from "mongoose";

dotenv.config();

const app = express();
app.use(compression());
const server = http.createServer(app);

// Connect DB & reset all users to offline
connectDb().then(async () => {
    await User.updateMany({}, { online: false }).catch(console.error);
});

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.use("/auth", authRoutes);
app.use("/chat", chatRoutes);

// Health Check Router
app.get("/health", (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    res.status(200).json({
        status: "healthy",
        uptime: process.uptime(),
        timestamp: new Date(),
        database: dbStatus,
    });
});

// ================= SOCKET =================
const io = new Server(server, {
    cors: { origin: "*" },
    pingTimeout: 60000,
});

const userSocketMap = new Map(); // socket.id → userId

io.on("connection", (socket) => {

    socket.on("setup", async (userData) => {
        const userId = typeof userData === 'string' ? userData : userData?._id;
        if (!userId) return;

        socket.join(userId);
        userSocketMap.set(socket.id, userId);
        await User.findByIdAndUpdate(userId, { online: true });
        socket.broadcast.emit("userOnline", userId);
    });

    socket.on("joinChat", (chatId) => {
        if (chatId) socket.join(chatId);
    });

    socket.on("sendMessage", ({ chatId, message }) => {
        if (chatId && message) socket.to(chatId).emit("receiveMessage", message);
    });

    // Typing indicators
    socket.on("typing", (chatId) => chatId && socket.to(chatId).emit("typing", chatId));
    socket.on("stopTyping", (chatId) => chatId && socket.to(chatId).emit("stopTyping", chatId));

    socket.on("updateMessage", ({ chatId, message }) => {
        if (chatId && message) socket.to(chatId).emit("messageUpdated", message);
    });

    socket.on("messageUpdated", ({ chatId, message }) => {
        if (chatId && message) socket.to(chatId).emit("messageUpdated", message);
    });

    socket.on("messageSeen", ({ chatId, userId }) => {
        if (chatId && userId) socket.to(chatId).emit("messageSeenUpdate", { chatId, userId });
    });

    socket.on("messageDeleted", ({ chatId, messageId }) => {
        if (chatId && messageId) socket.to(chatId).emit("broadcastDelete", { chatId, messageId });
    });

    socket.on("messageReaction", ({ chatId, messageId, reactions }) => {
        if (chatId && messageId && reactions) socket.to(chatId).emit("receiveReaction", { messageId, reactions });
    });

    socket.on("newGroupCreated", (data) => {
        if (!data?.members) return;
        data.members.forEach((member) => {
            const memberId = typeof member === 'object' ? member._id : member;
            socket.to(memberId.toString()).emit("groupAdded", data);
        });
    });

    socket.on("updateGroup", (data) => {
        if (data?._id) socket.to(data._id).emit("groupUpdated", data);
    });

    socket.on("disconnect", async () => {
        const userId = userSocketMap.get(socket.id);
        if (!userId) return;
        await User.findByIdAndUpdate(userId, { online: false });
        socket.broadcast.emit("userOffline", userId);
        userSocketMap.delete(socket.id);
    });
});

// ================= SERVER =================
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));