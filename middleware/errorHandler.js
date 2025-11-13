class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}


const errorHandler = (err, req, res, next) => {
  
  err.statusCode = err.statusCode || 500;
  err.message = err.message || 'Internal Server Error';

  if (process.env.NODE_ENV === 'development') {
    console.error('Error Details:', {
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
      userId: req.user?._id || 'Anonymous',
      stack: err.stack,
    });
  }

  // Log error severity
  if (process.env.NODE_ENV === 'production') {
    if (err.statusCode >= 500) {
      console.error(`[ERROR] ${err.message} - ${req.method} ${req.path}`);
    }
  }


  // MongoDB Validation Error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
    err = new AppError(`Validation Error: ${message}`, 400);
  }

  // MongoDB Cast Error (invalid ObjectId)
  if (err.name === 'CastError') {
    const message = `Invalid ${err.path}: ${err.value}`;
    err = new AppError(message, 400);
  }

  // MongoDB Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern);
    const value = err.keyValue[field];
    const message = `${field} "${value}" is already in use. Please use another value.`;
    err = new AppError(message, 400);
  }

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token. Please login again.';
    err = new AppError(message, 401);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Your token has expired. Please login again.';
    err = new AppError(message, 401);
  }

  // Axios/Network Errors
  if (err.isAxiosError) {
    const statusCode = err.response?.status || 500;
    const message =
      err.response?.data?.message ||
      err.message ||
      'External service error';
    err = new AppError(message, statusCode);
  }

  // Multer File Upload Errors
  if (err.name === 'MulterError') {
    if (err.code === 'FILE_TOO_LARGE') {
      err = new AppError('File size exceeds limit', 400);
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      err = new AppError('Too many files uploaded', 400);
    } else {
      err = new AppError('File upload error', 400);
    }
  }

  // Syntax Errors
  if (err instanceof SyntaxError) {
    err = new AppError('Invalid request format', 400);
  }

  // Build response object
  const response = {
    success: false,
    message: err.message,
    statusCode: err.statusCode,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: {
        path: req.path,
        method: req.method,
      },
    }),
  };

  // Add validation errors details in development
  if (process.env.NODE_ENV === 'development' && err.errors) {
    response.errors = err.errors;
  }

  // Send error response
  res.status(err.statusCode).json(response);
};


const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    if (!(error instanceof AppError)) {
      error = new AppError(error.message || 'Something went wrong', 500);
    }
    next(error);
  });
};


const notFound = (req, res, next) => {
  const message = `Cannot find ${req.originalUrl} on this server!`;
  const error = new AppError(message, 404);
  next(error);
};


const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = `[${new Date().toISOString()}] ${req.method} ${
      req.path
    } - ${res.statusCode} (${duration}ms)`;

    if (process.env.NODE_ENV === 'development') {
      console.log(log);
    }
  });

  next();
};

module.exports = {
  errorHandler,
  asyncHandler,
  notFound,
  requestLogger,
  AppError,
};
