require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/mydatabase',
  JWT_SECRET: process.env.JWT_SECRET || 'supersecreto',
  JWT_EXPIRATION: process.env.JWT_EXPIRATION || '1h',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  SOCKET_PORT: process.env.SOCKET_PORT || 3001,
  META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  FACEBOOK_ACCESS_TOKEN: process.env.FACEBOOK_ACCESS_TOKEN,
  OPEN_AI_API_KEY: process.env.OPEN_AI_API_KEY,
};