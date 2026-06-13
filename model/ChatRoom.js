import mongoose from "mongoose";

const chatRoomSchema = new mongoose.Schema({
    type:        { type: String, enum: ["single", "group", "public"], required: true },
    name:        { type: String },                                      // Group/public chat name
    image:       { type: String },                                      // Group profile picture
    admin:       { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Group creator
    members:     [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: "Message" }
}, { timestamps: true });

chatRoomSchema.index({ members: 1 });

export const ChatRoom = mongoose.model("ChatRoom", chatRoomSchema);