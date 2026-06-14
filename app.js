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

/* ================= CORS CONFIG ================= */
const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://chat-frontend-mbkx0aojz-shubham-dasayas-projects.vercel.app",
    "https://*.vercel.app"
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        const isAllowed =
            allowedOrigins.includes(origin) ||
            origin.endsWith(".vercel.app") ||
            origin.includes("ngrok");

        if (isAllowed) {
            return callback(null, true);
        }

        return callback(new Error("CORS blocked: " + origin), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With"
    ]
}));
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
        origin: allowedOrigins,
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
const PORT = process.env.PORT || 8000;

server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});