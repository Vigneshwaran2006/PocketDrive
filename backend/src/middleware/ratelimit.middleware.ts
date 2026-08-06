import rateLimit from "express-rate-limit";

// General API rate limit
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: {
    success: false,
    message: "Rate limit hit. Please try again after 1 minute.",
    code: "RATE_LIMIT_EXCEEDED",
    retry_after: 60,
  },
});

// Auth rate limit
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: {
    success: false,
    message: "Too many auth attempts. Please try again after 1 minute.",
    code: "RATE_LIMIT_EXCEEDED",
    retry_after: 60,
  },
});

// Upload rate limit
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  message: {
    success: false,
    message: "Too many uploads. Please try again after 1 minute.",
    code: "RATE_LIMIT_EXCEEDED",
    retry_after: 60,
  },
});