import mongoose from "mongoose";

const GroupSchema = new mongoose.Schema({
    name:       { type: String, required: true },
    members:    [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    admins:     [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    groupImage: { type: String },
    createdBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

export default mongoose.model("Group", GroupSchema);
