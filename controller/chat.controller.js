import { ChatRoom } from "../model/ChatRoom.js";
import { Message } from "../model/Message.js";
import User from "../model/User.js";
import { sendSuccess, sendError, sendServerError } from "../helper/helper.js";

// ===== Create / Get Single Chat =====
export const accessChat = async (req, res) => {
    try {
        const { userId } = req.body;
        const myId = req.user._id;
        if (!userId) return sendError(res, "UserId required");

        let chat = await ChatRoom.findOne({
            type: "single",
            members: { $all: [myId, userId] }
        }).populate("members", "name email avatar online");

        if (!chat) {
            chat = await ChatRoom.create({ type: "single", members: [myId, userId] });
            chat = await chat.populate("members", "name email avatar online");
        }

        // Auto-add as contacts (both directions)
        await Promise.all([
            User.findByIdAndUpdate(myId, { $addToSet: { contacts: userId } }),
            User.findByIdAndUpdate(userId, { $addToSet: { contacts: myId } })
        ]);

        return sendSuccess(res, "Chat accessed", chat);
    } catch (err) { return sendServerError(res, err); }
};

// ===== Get User Chats =====
export const getMyChats = async (req, res) => {
    try {
        const chats = await ChatRoom.find({
            members: req.user._id,
            type: { $in: ["single", "group"] }
        })
            .populate("members", "name email avatar online")
            .populate("lastMessage")
            .sort({ updatedAt: -1 })
            .lean();

        return sendSuccess(res, "Chats fetched", chats);
    } catch (err) { return sendServerError(res, err); }
};

// ===== Send Message =====
export const sendMessage = async (req, res) => {
    try {
        const { content, chatId, media, mediaType, parentMessageId } = req.body;
        if ((!content && (!media || media.length === 0)) || !chatId) {
            return sendError(res, "Content or media, and chatId are required");
        }

        const chat = await ChatRoom.findById(chatId);
        if (!chat) return sendError(res, "Chat not found");

        const receiver = chat.type === "single"
            ? chat.members.find(m => m.toString() !== req.user._id.toString())
            : chat._id;

        const message = await Message.create({
            sender: req.user._id, chatId, chatType: chat.type,
            receiver, content, seenBy: [req.user._id],
            media, mediaType,
            parentMessage: parentMessageId || null
        });

        const fullMsg = await Message.findById(message._id)
            .populate("sender", "name avatar")
            .populate("reactions.user", "name")
            .populate({
                path: "parentMessage",
                populate: { path: "sender", select: "name" }
            });
        await ChatRoom.findByIdAndUpdate(chatId, { lastMessage: message._id });

        return sendSuccess(res, "Message sent", fullMsg);
    } catch (err) { return sendServerError(res, err); }
};

// ===== Leave Group =====
export const leaveGroup = async (req, res) => {
    try {
        const { chatId } = req.body;
        const group = await ChatRoom.findById(chatId);
        if (!group) return sendError(res, "Group not found");

        // Remove user from members array
        const updatedGroup = await ChatRoom.findByIdAndUpdate(chatId, {
            $pull: { members: req.user._id }
        }, { new: true });

        // If no members left, delete the group
        if (updatedGroup.members.length === 0) {
            await ChatRoom.findByIdAndDelete(chatId);
            return sendSuccess(res, "Group deleted as it has no members");
        }

        // If the admin leaves, assign a new admin
        if (group.admin.toString() === req.user._id.toString()) {
            await ChatRoom.findByIdAndUpdate(chatId, { admin: updatedGroup.members[0] });
        }

        return sendSuccess(res, "Successfully left the group");
    } catch (err) { return sendServerError(res, err); }
};

// ===== Update Message =====
export const updateMessage = async (req, res) => {
    try {
        const { content, chatId } = req.body;
        const { messageId } = req.params;
        if (!content || !messageId) return sendError(res, "Content & messageId required");

        const message = await Message.findById(messageId);
        if (!message) return sendError(res, "Message not found");
        if (message.sender.toString() !== req.user._id.toString()) 
            return sendError(res, "Only sender can edit");

        const updatedMsg = await Message.findByIdAndUpdate(
            messageId, 
            { content }, 
            { new: true }
        ).populate("sender", "name avatar");

        // Update last message in chatroom if needed
        await ChatRoom.findByIdAndUpdate(chatId, { lastMessage: messageId });

        return sendSuccess(res, "Message updated", updatedMsg);
    } catch (err) { return sendServerError(res, err); }
};


// ===== Get Messages =====
export const getMessages = async (req, res) => {
    try {
        const { chatId } = req.params;
        if (!await ChatRoom.findById(chatId)) return sendError(res, "Chat not found");

        const messages = await Message.find({ chatId, deleted: { $ne: true } })
            .populate("sender", "name avatar")
            .populate("reactions.user", "name")
            .populate({
                path: "parentMessage",
                populate: { path: "sender", select: "name" }
            })
            .sort({ createdAt: 1 })
            .lean();

        return sendSuccess(res, "Messages fetched", messages);
    } catch (err) { return sendServerError(res, err); }
};

// ===== Mark Messages As Seen =====
export const markSeen = async (req, res) => {
    try {
        const { chatId } = req.params;
        const myId = req.user._id;

        await Message.updateMany(
            { chatId, sender: { $ne: myId }, seenBy: { $nin: [myId] } },
            { $addToSet: { seenBy: myId } }
        );

        return sendSuccess(res, "Messages marked as seen");
    } catch (err) { return sendServerError(res, err); }
};

// ===== Delete Message (soft) =====
export const deleteMessage = async (req, res) => {
    try {
        const msg = await Message.findById(req.params.messageId);
        if (!msg) return sendError(res, "Message not found");
        if (msg.sender.toString() !== req.user._id.toString())
            return sendError(res, "Only sender can delete");

        msg.deleted = true;
        msg.content = "This message was deleted";
        await msg.save();

        return sendSuccess(res, "Message deleted", { messageId: req.params.messageId });
    } catch (err) { return sendServerError(res, err); }
};

// ===== Create Group =====
export const createGroup = async (req, res) => {
    try {
        const { name, members } = req.body;
        if (!name || !members?.length) return sendError(res, "Name and at least 1 member required");

        // Deduplicate members and include the creator
        const uniqueMembers = [...new Set([req.user._id.toString(), ...members.map(String)])];

        const group = await ChatRoom.create({
            type: "group", name,
            admin: req.user._id,
            members: uniqueMembers
        });

        const populated = await ChatRoom.findById(group._id)
            .populate("members", "name email avatar online")
            .populate("admin", "name avatar");

        return sendSuccess(res, "Group created", populated);
    } catch (err) { return sendServerError(res, err); }
};

// ===== Get / Create Public Chat =====
export const getPublicChat = async (req, res) => {
    try {
        let chat = await ChatRoom.findOne({ type: "public" })
            .populate("members", "name email avatar online")
            .populate("lastMessage");

        if (!chat) {
            chat = await ChatRoom.create({ type: "public", name: "Public Chat", members: [] });
        }

        // Add current user if not already a member
        const isMember = chat.members.some(m =>
            (m._id?.toString() || m.toString()) === req.user._id.toString()
        );

        if (!isMember) {
            await ChatRoom.findByIdAndUpdate(chat._id, { $addToSet: { members: req.user._id } });
            chat = await ChatRoom.findById(chat._id)
                .populate("members", "name email avatar online")
                .populate("lastMessage");
        }

        return sendSuccess(res, "Public chat accessed", chat);
    } catch (err) { return sendServerError(res, err); }
};

// ===== Update Group Details =====
export const updateGroup = async (req, res) => {
    try {
        const { chatId, name } = req.body;
        const group = await ChatRoom.findById(chatId);
        
        if (!group) return sendError(res, "Group not found");
        if (group.type !== "group") return sendError(res, "Only groups can be updated here");
        if (group.admin.toString() !== req.user._id.toString())
            return sendError(res, "Only the group admin can update details");

        const updateData = {};
        if (name) updateData.name = name;
        if (req.file) updateData.image = `/uploads/${req.file.filename}`;
        else if (req.body.imageLink) updateData.image = req.body.imageLink;

        const updated = await ChatRoom.findByIdAndUpdate(chatId, updateData, { new: true })
            .populate("members", "name email avatar online")
            .populate("admin", "name avatar");

        return sendSuccess(res, "Group updated successfully", updated);
    } catch (err) { return sendServerError(res, err); }
};

// ===== Remove Contact =====
export const removeContact = async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, { $pull: { contacts: req.params.contactId } });
        return sendSuccess(res, "Contact removed");
    } catch (err) { return sendServerError(res, err); }
};

// ===== Upload Media File =====
export const uploadMedia = async (req, res) => {
    try {
        if (!req.file) return sendError(res, "No file uploaded");

        const fileUrl = `/uploads/${req.file.filename}`;
        let mediaType = "other";
        const mime = req.file.mimetype;
        if (mime.startsWith("image/")) mediaType = "image";
        else if (mime.startsWith("video/")) mediaType = "video";
        else if (mime === "application/pdf") mediaType = "pdf";

        return sendSuccess(res, "File uploaded", {
            fileUrl,
            mediaType,
            fileName: req.file.originalname
        });
    } catch (err) { return sendServerError(res, err); }
};

// ===== React to Message =====
export const reactToMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { emoji } = req.body;
        const myId = req.user._id;
        if (!emoji) return sendError(res, "Emoji required");

        const msg = await Message.findById(messageId);
        if (!msg) return sendError(res, "Message not found");

        const existingReactionIndex = msg.reactions.findIndex(
            r => r.user.toString() === myId.toString()
        );

        if (existingReactionIndex > -1) {
            if (msg.reactions[existingReactionIndex].emoji === emoji) {
                msg.reactions.splice(existingReactionIndex, 1);
            } else {
                msg.reactions[existingReactionIndex].emoji = emoji;
            }
        } else {
            msg.reactions.push({ user: myId, emoji });
        }

        await msg.save();
        const updatedMsg = await Message.findById(messageId)
            .populate("sender", "name avatar")
            .populate("reactions.user", "name");

        return sendSuccess(res, "Reaction updated", updatedMsg);
    } catch (err) { return sendServerError(res, err); }
};