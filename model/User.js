import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    avatar:   { type: String },
    bio:      { type: String, default: "" },
    online:   { type: Boolean, default: false },
    groups:   [{ type: mongoose.Schema.Types.ObjectId, ref: "Group" }],
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
}, { timestamps: true });

export default mongoose.model("User", UserSchema);