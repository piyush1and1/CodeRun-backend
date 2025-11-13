require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');

// Import middleware and utils
const { errorHandler, asyncHandler, notFound, requestLogger } = require('./middleware/errorHandler');
const {
  apiLimiter,
  otpLimiter,
  compileLimiter,
  closeRateLimiters,
} = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/auth');
const compilerRoutes = require('./routes/compiler');
const userRoutes = require('./routes/user');

const app = express();

// Connect to database
connectDB();

// Middleware
app.use(requestLogger);
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Apply general rate limiter
app.use('/api/', apiLimiter);

// Routes
app.use('/api/auth', otpLimiter, authRoutes);
app.use('/api/compiler', compileLimiter, compilerRoutes);
app.use('/api/user', userRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// 404 handler (before error handler)
app.use(notFound);

// Error handling middleware (last)
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await closeRateLimiters();
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
