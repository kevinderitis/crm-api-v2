const express = require('express');
const router = express.Router();
const metaController = require('../controllers/meta.controller');
const verifyToken = require('../middleware/auth.middleware');
const checkRole = require('../middleware/role.middleware');

// Todas las rutas requieren autenticación
// router.use(verifyToken);

// Rutas de configuración de Meta
router.get('/config', metaController.getConfig);
router.post('/config', checkRole(['admin']), metaController.updateConfig);

// Webhook para Meta
router.post('/webhook', metaController.handleWebhook);
router.get('/webhook', metaController.verifyWebhook);

module.exports = router;