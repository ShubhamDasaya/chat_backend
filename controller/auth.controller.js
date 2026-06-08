import User from '../model/User.js';
import bcrypt from 'bcryptjs';
import { sendError, sendServerError, sendSuccess } from '../helper/helper.js';
import { generateToken } from '../helper/jwt.js';

// ===== Register =====
export const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (await User.findOne({ email })) return sendError(res, "User already exists");

        const user = await User.create({
            name,
            email,
            password: await bcrypt.hash(password, 10)
        });

        const token = generateToken(user);
        return sendSuccess(res, "User registered successfully", {
            user: { _id: user._id, name: user.name, email: user.email, avatar: user.avatar },
            token
        });
    } catch (error) {
        sendServerError(res, error);
    }
};

// ===== Login =====
export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return sendError(res, "Email and password required");

        const user = await User.findOne({ email });
        if (!user) return sendError(res, "User not found");

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return sendError(res, "Invalid credentials");

        const token = generateToken(user);
        return sendSuccess(res, "Login successful", { user, token });
    } catch (error) {
        return sendServerError(res, error);
    }
};

// ===== Upload Avatar =====
export const uploadAvatar = async (req, res) => {
    try {
        const avatar = req.file
            ? `/uploads/${req.file.filename}`
            : req.body.avatarLink || "";

        if (!avatar) return sendError(res, "No avatar provided");

        const user = await User.findByIdAndUpdate(
            req.user._id, { avatar }, { new: true }
        ).select("-password");

        return sendSuccess(res, "Avatar updated successfully", user);
    } catch (error) {
        return sendServerError(res, error);
    }
};

// ===== Get Profile =====
export const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select("-password")
            .populate("contacts", "name email avatar");

        if (!user) return sendError(res, "User not found", 400);
        return sendSuccess(res, "User profile fetched successfully", { user });
    } catch (error) {
        return sendServerError(res, error);
    }
};

// ===== Update Profile =====
export const updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return sendError(res, "User not found", 400);

        // Determine new avatar: uploaded file > link > keep existing
        const avatar = req.file
            ? `/uploads/${req.file.filename}`
            : req.body.avatarLink || user.avatar;

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { name: req.body.name || user.name, bio: req.body.bio || user.bio || "", avatar },
            { new: true }
        ).select("-password");

        return sendSuccess(res, "Profile updated successfully", updatedUser);
    } catch (error) {
        return sendServerError(res, error);
    }
};

// ===== Search Users =====
export const searchUsers = async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) return sendError(res, "Search query is required");

        const users = await User.find({
            $and: [
                { $or: [
                    { name: { $regex: query, $options: "i" } },
                    { email: { $regex: query, $options: "i" } }
                ]},
                { _id: { $ne: req.user._id } }
            ]
        }).select("-password").limit(10);

        return sendSuccess(res, "Users fetched successfully", users);
    } catch (error) {
        return sendServerError(res, error);
    }
};

// ===== Add Contact =====
export const addContact = async (req, res) => {
    try {
        const { contactId } = req.body;
        if (!contactId) return sendError(res, "ContactId is required");

        await User.findByIdAndUpdate(req.user._id, { $addToSet: { contacts: contactId } });
        const updatedUser = await User.findById(req.user._id).populate("contacts", "name email avatar");

        return sendSuccess(res, "Contact added successfully", updatedUser.contacts);
    } catch (error) {
        return sendServerError(res, error);
    }
};
