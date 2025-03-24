const express = require('express');
const router = express.Router();
const messagesController = require('../controllers/messages.controller');
const verifyToken = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Rutas de conversaciones
router.get('/conversations', messagesController.getConversations);
router.get('/conversations/:id', messagesController.getConversation);
router.put('/conversations/:id', messagesController.updateConversation);
router.put('/conversations/:id/customer-name', messagesController.updateCustomerName);
router.put('/conversations/:id/read', messagesController.markAsRead);
router.put('/conversations/:id/ai-toggle', messagesController.toggleAI);

// Rutas de mensajes
router.get('/conversations/:conversationId/messages', messagesController.getMessages);
router.post('/conversations/:conversationId/messages', messagesController.sendMessage);
router.post('/conversations/:conversationId/messages/image', messagesController.sendImage);

module.exports = router;