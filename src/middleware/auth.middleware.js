const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/config.js');

const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        message: 'No token provided',
        code: 'AUTH_NO_TOKEN'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        message: 'Invalid token format',
        code: 'AUTH_INVALID_FORMAT'
      });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          message: 'Token expired',
          code: 'AUTH_TOKEN_EXPIRED'
        });
      }
      
      return res.status(401).json({
        message: 'Invalid token',
        code: 'AUTH_INVALID_TOKEN'
      });
    }
  } catch (error) {
    return res.status(500).json({ 
      message: 'Internal server error',
      code: 'AUTH_SERVER_ERROR'
    });
  }
};

module.exports = verifyToken;