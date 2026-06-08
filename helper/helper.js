// Standardized API response helpers

export const sendSuccess = (res, message, data = {}) =>
    res.status(200).json({ success: true, message, data });

export const sendError = (res, message, status = 400) =>
    res.status(status).json({ success: false, message });

export const sendServerError = (res, error) => {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
};