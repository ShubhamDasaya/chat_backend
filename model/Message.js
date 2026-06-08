import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    sender:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    chatId:    { type: mongoose.Schema.Types.ObjectId, ref: "ChatRoom", required: true },
    chatType:  { type: String, enum: ["single", "group", "public"], required: true },
    receiver:  { type: mongoose.Schema.Types.ObjectId, refPath: "chatType" },
    content:   { type: String },
    media:     [{ type: String }],
    mediaType: [{ type: String, enum: ["image", "video", "pdf", "other"] }],
    seenBy:    [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    deleted:   { type: Boolean, default: false }
}, { timestamps: true });

export const Message = mongoose.model("Message", messageSchema);