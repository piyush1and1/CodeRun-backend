const { verifyToken } = require("../utils/jwt");
const User = require("../models/User");


const checkAuth = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (token) {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId).select("-__v");
      
      if (user) {
        req.user = user; 
      }
    }
  } catch (error) {
    req.user = null;
  }
  
  next();
};

module.exports = checkAuth;