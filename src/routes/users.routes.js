const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users.controller');
const verifyToken = require('../middleware/auth.middleware');
const checkRole = require('../middleware/role.middleware');

// Rutas protegidas para usuarios
router.use(verifyToken);

// Rutas solo para administradores
router.post('/', checkRole(['admin']), usersController.createUser);
router.get('/', checkRole(['admin']), usersController.getUsers);
router.put('/:id', checkRole(['admin']), usersController.updateUser);
router.delete('/:id', checkRole(['admin']), usersController.deleteUser);

// Rutas para todos los usuarios autenticados
router.get('/profile', usersController.getProfile);
router.put('/profile', usersController.updateProfile);

module.exports = router;