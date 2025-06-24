const express = require('express');
const router = express.Router();
const clientController = require('../controllers/client.controller');
const verifyToken = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
// router.use(verifyToken);

// Rutas de clientes
router.post('/message', clientController.sendClientMessage);

module.exports = router;