const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  // 🔹 Check cookies first
  if (req.cookies.token) {
    token = req.cookies.token;
  }
  // 🔹 Fallback: check Authorization header
  else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};

// Simplified middleware - since all users are superadmin now, this is just for backward compatibility
const allowRoles = (...roles) => {
  return (req, res, next) => {
    // All authenticated users are superadmin, so allow access
    if (req.user) {
      next();
    } else {
      return res.status(403).json({ message: "Forbidden, authentication required" });
    }
  };
};

module.exports = { protect, allowRoles };