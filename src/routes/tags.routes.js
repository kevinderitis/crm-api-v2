const express = require('express');
const router = express.Router();
const tagsController = require('../controllers/tags.controller');
const verifyToken = require('../middleware/auth.middleware');
const checkRole = require('../middleware/role.middleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Rutas de etiquetas
router.get('/', tagsController.getTags);

// Rutas solo para administradores
router.post('/', tagsController.createTag);
router.put('/:id', tagsController.updateTag);
router.delete('/:id',  tagsController.deleteTag);

// Rutas para gestionar etiquetas en conversaciones
router.post('/conversations/:conversationId', tagsController.addTagToConversation);
router.delete('/conversations/:conversationId/:tagId', tagsController.removeTagFromConversation);

module.exports = router;