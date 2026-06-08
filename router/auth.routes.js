import express from 'express';
import { addContact, getProfile, loginUser, registerUser, searchUsers, updateProfile, uploadAvatar } from '../controller/auth.controller.js';
import { uploadAvatarMiddleware } from '../helper/multer.js';
import { authenticateToken } from '../helper/jwt.js';

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/avatar", authenticateToken, uploadAvatarMiddleware, uploadAvatar);
router.get("/profile", authenticateToken, getProfile);
router.post("/profile", authenticateToken, uploadAvatarMiddleware, updateProfile);
router.post("/contact", authenticateToken, addContact);
router.get("/search", authenticateToken, searchUsers);

export default router;
