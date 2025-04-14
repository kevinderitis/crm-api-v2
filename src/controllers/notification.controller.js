const webpush = require('web-push');
const config = require('../config/config');
const Subscription = require('../models/subscription.model');

// Configurar web-push con las VAPID keys
webpush.setVapidDetails(
    'mailto:notifications@vudu8.com',
    config.VAPID_PUBLIC_KEY,
    config.VAPID_PRIVATE_KEY
);

exports.subscribe = async (req, res) => {
    const { subscription, userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'Se requiere ID de usuario' });
    }

    try {
        // Actualizar o crear la suscripción
        await Subscription.findOneAndUpdate(
            { user_id: userId },
            { subscription, created_at: new Date() },
            { upsert: true, new: true }
        );

        console.log(`Usuario ${userId} suscrito a notificaciones`);
        res.status(201).json({ message: 'Suscripción registrada' });
    } catch (error) {
        console.error('Error registrando suscripción:', error);
        res.status(500).json({ error: 'Error guardando suscripción' });
    }
};

exports.sendNotification = async (req, res) => {
    const { title, message, tag = 'default', url = '/', actions = [], userId } = req.body;

    const payload = JSON.stringify({
        title,
        message,
        tag,
        url,
        actions,
        timestamp: new Date().toISOString()
    });

    try {
        if (userId) {
            // Enviar a un usuario específico
            const subscriptionData = await Subscription.findOne({ user_id: userId });
            if (subscriptionData && subscriptionData.subscription) {
                await webpush.sendNotification(subscriptionData.subscription, payload);
            }
        } else {
            // Enviar a todos los usuarios
            const allSubscriptions = await Subscription.find();

            const sendPromises = allSubscriptions.map(async (sub) => {
                try {
                    await webpush.sendNotification(sub.subscription, payload);
                } catch (error) {
                    if (error.statusCode === 410) {
                        await Subscription.deleteOne({ user_id: sub.user_id });
                    }
                    throw error;
                }
            });

            await Promise.all(sendPromises);
        }

        res.json({ message: 'Notificaciones enviadas' });
    } catch (error) {
        console.error('Error enviando notificaciones:', error);
        res.status(500).json({
            error: 'Error enviando notificaciones',
            details: error.message
        });
    }
};