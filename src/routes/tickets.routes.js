const express = require('express');
const router = express.Router();
const ticketsController = require('../controllers/tickets.controller');
const verifyToken = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Rutas de tickets
router.get('/', ticketsController.getTickets);
router.post('/', ticketsController.createTicket);
router.put('/:id/complete', ticketsController.completeTicket);
router.put('/:id/cancel', ticketsController.cancelTicket);

module.exports = router;