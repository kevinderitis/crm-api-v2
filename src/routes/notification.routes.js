const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');

router.post('/subscribe', notificationController.subscribe);
router.post('/send-notification', notificationController.sendNotification);

module.exports = router;