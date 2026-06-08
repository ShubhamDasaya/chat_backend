import jwt from 'jsonwebtoken';
import { sendError } from './helper.js';
import User from '../model/User.js';

// Generate a compact JWT with only essential user fields
export const generateToken = (user) => {
    const payload = { _id: user._id, email: user.email, name: user.name };
    return jwt.sign({ data: payload }, process.env.JWT_SECRET, { expiresIn: "10d" });
};

// Middleware: verify JWT and attach user to req
export const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return sendError(res, "Authorization header required", 401);

        const token = authHeader.split(" ")[1];
        if (!token) return sendError(res, "Access token required", 401);

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.data._id).select("-password");

        if (!user) return sendError(res, "User not found", 401);
        if (user.status && user.status !== "active") return sendError(res, "User account is inactive", 401);

        req.user = user;
        next();
    } catch (error) {
        if (error.name === "JsonWebTokenError") return sendError(res, "Invalid token", 401);
        if (error.name === "TokenExpiredError") return sendError(res, "Token expired", 401);
        return sendError(res, "Authentication failed", 500);
    }
};

// Keep old name as alias so existing imports still work
export const authenticateToke = authenticateToken;