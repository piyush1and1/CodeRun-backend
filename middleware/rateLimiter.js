const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const redis = require("redis");

let redisClient;
let store;
let redisConnected = false;

const initializeRedis = async () => {
  try {
    if (!process.env.REDIS_URL) {
      console.log("Redis not configured, using memory store");
      return;
    }

    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        tls: true,
        reconnectStrategy: (retries) => Math.min(retries * 50, 500),
      },
    });

    redisClient.on("error", (err) => {
      console.warn("Redis error:", err.message);
      redisConnected = false;
      store = undefined;
    });

    redisClient.on("connect", () => {
      console.log("Connected to Redis");
      redisConnected = true;
    });

    await redisClient.connect();

    store = new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
    });

    redisConnected = true;
    console.log("Rate limiter using Redis store");
  } catch (error) {
    console.warn("Redis connection failed, using memory store:", error.message);
    store = undefined;
    redisConnected = false;
  }
};

initializeRedis();

const keyGenerator = (req) =>
  req.user && req.user._id ? `user:${req.user._id}` : req.ip;

const logLimitReached = (endpoint, req) => {
  console.warn(
    `Rate limit reached on ${endpoint} for ${keyGenerator(req)} at ${new Date().toISOString()}`
  );
};

const rateLimitHandler = (req, res) => {
  res.status(429).json({
    success: false,
    message: "Too many requests, please try again later.",
    retryAfter: req.rateLimit?.resetTime
      ? Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
      : "unknown",
  });
};

/* OTP Request */
const otpLimiter = rateLimit({
  store,
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many OTP requests. Try again after 15 minutes.",
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.email?.toLowerCase() || req.ip,
  skip: (req) => req.path === "/api/health",
  handler: (req, res) => {
    logLimitReached("/auth/request-otp", req);
    rateLimitHandler(req, res);
  },
});

/* OTP Verify */
const otpVerifyLimiter = rateLimit({
  store,
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many OTP verification attempts.",
  keyGenerator: (req) => req.body?.email?.toLowerCase() || req.ip,
  handler: (req, res) => {
    logLimitReached("/auth/verify-otp", req);
    rateLimitHandler(req, res);
  },
});

/* Code Compile */
const compileLimiter = rateLimit({
  store,
  windowMs: 60 * 1000,
  max: (req) => (req.user ? 15 : 5),
  message: "Too many compilation requests.",
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logLimitReached("/api/compile", req);
    res.status(429).json({
      success: false,
      message: `Too many compilation requests for ${req.user ? "user" : "guest"}.`,
      retryAfter: req.rateLimit?.resetTime
        ? Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
        : "unknown",
    });
  },
});

/* General API */
const apiLimiter = rateLimit({
  store,
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests. Slow down.",
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    ["/api/health", "/api/docs", "/api/status"].some((path) =>
      req.path.startsWith(path)
    ),
  handler: rateLimitHandler,
});

/* Sensitive Operations */
const strictLimiter = rateLimit({
  store,
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: "Too many requests. Try again after an hour.",
  keyGenerator: (req) =>
    req.user ? `sensitive:${req.user._id}` : `sensitive:${req.ip}`,
  skip: (req) => !req.path.includes("/sensitive"),
  handler: (req, res) => {
    logLimitReached(req.path, req);
    rateLimitHandler(req, res);
  },
});

/* Snippet Operations */
const snippetLimiter = rateLimit({
  store,
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: "Too many snippet actions.",
  keyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    !req.user || !["POST", "PUT", "DELETE"].includes(req.method),
  handler: (req, res) => {
    logLimitReached("/api/user/snippets", req);
    res.status(429).json({
      success: false,
      message: "Too many snippet operations.",
      retryAfter: req.rateLimit?.resetTime
        ? Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
        : "unknown",
    });
  },
});

/* Login Attempts */
const loginLimiter = rateLimit({
  store,
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many login attempts.",
  keyGenerator: (req) => req.body?.email?.toLowerCase() || req.ip,
  skip: (req) => req.method === "GET",
  handler: (req, res) => {
    logLimitReached("/auth/login", req);
    res.status(429).json({
      success: false,
      message: "Too many login attempts. Try later.",
    });
  },
});

/* Export / Import */
const exportImportLimiter = rateLimit({
  store,
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  message: "Daily export/import limit reached.",
  keyGenerator,
  skip: (req) => !req.user,
  handler: (req, res) => {
    logLimitReached(req.path, req);
    res.status(429).json({
      success: false,
      message: "Export/Import limit exceeded.",
      retryAfter: req.rateLimit?.resetTime
        ? Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
        : "unknown",
    });
  },
});

const closeRateLimiters = async () => {
  if (redisClient && redisConnected) {
    try {
      await redisClient.quit();
      console.log("Rate limiter Redis connection closed");
      redisConnected = false;
    } catch (error) {
      console.error("Error closing Redis connection:", error.message);
    }
  }
};

const getStatus = () => ({
  redis: redisConnected,
  store: store ? "redis" : "memory",
});

module.exports = {
  otpLimiter,
  otpVerifyLimiter,
  compileLimiter,
  apiLimiter,
  strictLimiter,
  loginLimiter,
  snippetLimiter,
  exportImportLimiter,
  closeRateLimiters,
  keyGenerator,
  getStatus,
  initializeRedis,
};
