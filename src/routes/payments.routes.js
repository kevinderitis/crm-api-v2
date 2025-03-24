const express = require('express');
const router = express.Router();
const paymentsController = require('../controllers/payments.controller');
const verifyToken = require('../middleware/auth.middleware');
const checkRole = require('../middleware/role.middleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Rutas de pagos
router.get('/', paymentsController.getPayments);
router.get('/:id', paymentsController.getPayment);
router.post('/', paymentsController.createPayment);

// Rutas para aprobar/rechazar pagos (solo admin y agentes)
router.put('/:id/approve', checkRole(['admin', 'agent']), paymentsController.approvePayment);
router.put('/:id/reject', checkRole(['admin', 'agent']), paymentsController.rejectPayment);

// Rutas para subir comprobantes
router.post('/:id/receipt', paymentsController.uploadReceipt);

module.exports = router;