// server/middleware/verifyJWT.js
const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

const verifyJWT = async (req, res, next) => {
  try {
    // Get token from cookie
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Verify token
    const decoded = verifyToken(token);

    // Get user from database
    const user = await User.findById(decoded.userId).select('-__v');

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Attach user to request
    req.user = user;
    next();

  } catch (error) {
    console.error('JWT verification error:', error);
    res.status(401).json({ message: 'Token is invalid or expired' });
  }
};

module.exports = verifyJWT;
