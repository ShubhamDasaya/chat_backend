import express from "express";
import {
    accessChat, getMyChats, sendMessage, getMessages,
    markSeen, deleteMessage, createGroup, getPublicChat, removeContact,
    updateMessage, updateGroup, leaveGroup, uploadMedia, reactToMessage
} from "../controller/chat.controller.js";
import { authenticateToken } from "../helper/jwt.js";
import { uploadAvatarMiddleware, uploadMediaMiddleware } from "../helper/multer.js";

const router = express.Router();

router.post("/access", authenticateToken, accessChat);
router.get("/", authenticateToken, getMyChats);
router.post("/message", authenticateToken, sendMessage);
router.get("/messages/:chatId", authenticateToken, getMessages);
router.put("/message/:messageId", authenticateToken, updateMessage);
router.put("/seen/:chatId", authenticateToken, markSeen);
router.delete("/message/:messageId", authenticateToken, deleteMessage);
router.post("/group", authenticateToken, createGroup);
router.put("/group", authenticateToken, uploadAvatarMiddleware, updateGroup);
router.post("/leave", authenticateToken, leaveGroup);
router.get("/public", authenticateToken, getPublicChat);
router.delete("/contact/:contactId", authenticateToken, removeContact);
router.post("/upload", authenticateToken, uploadMediaMiddleware, uploadMedia);
router.post("/react/:messageId", authenticateToken, reactToMessage);

export default router;