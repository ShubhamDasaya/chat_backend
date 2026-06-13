/**
 * Migration Script: Backfill chatId on existing messages
 *
 * Problem: Messages were previously stored without a chatId field.
 * What it does:
 *   1. Finds messages where chatId is missing
 *   2. Matches each to its ChatRoom (by sender + receiver)
 *   3. Updates the message with the correct chatId
 *
 * Usage: node migrate-messages.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import { Message } from "./model/Message.js";
import { ChatRoom } from "./model/ChatRoom.js";

dotenv.config();

async function migrate() {

    try {
        await mongoose.connect(process.env.MONGO_URL);

        const messages = await Message.find({
            $or: [{ chatId: { $exists: false } }, { chatId: null }]
        });

        if (!messages.length) {
            return;
        }

        let updated = 0, skipped = 0, failed = 0;

        for (const msg of messages) {
            try {
                const chatRoom = await ChatRoom.findOne({
                    type: msg.chatType || "single",
                    members: { $all: [msg.sender, msg.receiver] }
                });

                if (chatRoom) {
                    await Message.findByIdAndUpdate(msg._id, { chatId: chatRoom._id });
                    updated++;
                } else {
                    skipped++;
                }
            } catch (err) {
                console.log(`❌ Error migrating message ${msg._id}:`, err.message);
                failed++;
            }
        }


    } catch (err) {
        console.error("❌ Migration failed:", err);
    } finally {
        await mongoose.disconnect();
        console.log("🔌 Disconnected from MongoDB");
    }
}

migrate();
