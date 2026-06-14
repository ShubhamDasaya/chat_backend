import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import compression from "compression";

import authRoutes from "./router/auth.routes.js";
import chatRoutes from "./router/chat.routes.js";
import connectDb from "./db/db.config.js";
import User from "./model/User.js";
import mongoose from "mongoose";

dotenv.config();

const app = express();
const server = http.createServer(app);

/* ================= DATABASE ================= */
connectDb().then(async () => {
    await User.updateMany({}, { online: false }).catch(console.error);
});

/* ================= CORS (FINAL FIX) ================= */
app.use(cors({
    origin: [
        "http://localhost:3000",
        "http://localhost:5173",
        "https://chat-frontend-mbkx0aojz-shubham-dasayas-projects.vercel.app"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

/* ================= IMPORTANT PRE-FLIGHT HANDLER ================= */
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }

    next();
});

/* ================= MIDDLEWARE ================= */
app.use(compression());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

/* ================= ROUTES ================= */
app.use("/auth", authRoutes);
app.use("/chat", chatRoutes);

/* ================= HEALTH CHECK ================= */
app.get("/health", (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? "connected" : "disconnected";

    res.status(200).json({
        status: "healthy",
        uptime: process.uptime(),
        timestamp: new Date(),
        database: dbStatus,
    });
});

/* ================= SOCKET.IO ================= */
const io = new Server(server, {
    cors: {
        origin: "*", // socket is more relaxed (important for chat apps)
        credentials: true
    },
    pingTimeout: 60000
});

const userSocketMap = new Map();

io.on("connection", (socket) => {

    socket.on("setup", async (userData) => {
        const userId = typeof userData === "string"
            ? userData
            : userData?._id;

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
        if (chatId && message) {
            socket.to(chatId).emit("receiveMessage", message);
        }
    });

    socket.on("typing", (chatId) => {
        if (chatId) socket.to(chatId).emit("typing", chatId);
    });

    socket.on("stopTyping", (chatId) => {
        if (chatId) socket.to(chatId).emit("stopTyping", chatId);
    });

    socket.on("messageSeen", ({ chatId, userId }) => {
        if (chatId && userId) {
            socket.to(chatId).emit("messageSeenUpdate", { chatId, userId });
        }
    });

    socket.on("messageDeleted", ({ chatId, messageId }) => {
        if (chatId && messageId) {
            socket.to(chatId).emit("broadcastDelete", { chatId, messageId });
        }
    });

    socket.on("disconnect", async () => {
        const userId = userSocketMap.get(socket.id);

        if (userId) {
            await User.findByIdAndUpdate(userId, { online: false });
            socket.broadcast.emit("userOffline", userId);
            userSocketMap.delete(socket.id);
        }
    });
});

/* ================= START SERVER ================= */
server.listen(8000, "0.0.0.0", () => {
    console.log("Server running on port 8000");
});