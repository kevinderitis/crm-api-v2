const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Rutas de autenticación
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/client-login', authController.clientLogin);

module.exports = router;