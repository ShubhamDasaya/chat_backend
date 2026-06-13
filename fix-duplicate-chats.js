import mongoose from "mongoose";
import dotenv from "dotenv";
import { ChatRoom } from "./model/ChatRoom.js";
import { Message } from "./model/Message.js";

dotenv.config();

async function fix() {

    try {
        await mongoose.connect(process.env.MONGO_URL);

        const allChats = await ChatRoom.find({ type: "single" });

        // Group chats by sorted member pair
        const pairMap = new Map();
        for (const chat of allChats) {
            const key = chat.members.map(m => m.toString()).sort().join("_");
            if (!pairMap.has(key)) pairMap.set(key, []);
            pairMap.get(key).push(chat);
        }

        let duplicatesRemoved = 0, messagesReassigned = 0;

        for (const [key, chats] of pairMap.entries()) {
            if (chats.length <= 1) continue;

            // Count messages per chat, keep the one with most (or oldest)
            const withCounts = await Promise.all(
                chats.map(async (chat) => ({
                    chat,
                    count: await Message.countDocuments({ chatId: chat._id })
                }))
            );

            withCounts.sort((a, b) => b.count - a.count || a.chat.createdAt - b.chat.createdAt);
            const keeper = withCounts[0].chat;

            for (const { chat: dup, count } of withCounts.slice(1)) {
                if (count > 0) {
                    const result = await Message.updateMany({ chatId: dup._id }, { chatId: keeper._id });
                    messagesReassigned += result.modifiedCount;
                }
                await ChatRoom.findByIdAndDelete(dup._id);
                duplicatesRemoved++;
            }
        }

    } catch (err) {
        console.error("❌ Fix failed:", err);
    } finally {
        await mongoose.disconnect();
        console.log("🔌 Disconnected from MongoDB");
    }
}

fix();
