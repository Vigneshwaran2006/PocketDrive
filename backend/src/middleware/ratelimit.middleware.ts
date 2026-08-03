import rateLimit from "express-rate-limit";

// General API rate limit
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: "Too many requests. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth rate limit (stricter)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 100000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: "Too many auth attempts. Please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Upload rate limit
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: {
    success: false,
    message: "Too many uploads. Please wait a moment.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});