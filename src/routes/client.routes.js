const express = require('express');
const router = express.Router();
const clientController = require('../controllers/client.controller');
const verifyToken = require('../middleware/auth.middleware');
const multer = require('multer');

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// Todas las rutas requieren autenticación
// router.use(verifyToken);

// Rutas de clientes
router.post('/message', clientController.sendClientMessage);
router.post('/message/image', upload.single('image'), clientController.sendClientImage);

module.exports = router;