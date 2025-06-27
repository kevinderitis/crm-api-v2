const cron = require('node-cron');
const Message = require('../models/message.model.js');

cron.schedule('0 * * * *', async () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
        const result = await Message.updateMany(
            {
                type: 'image',
                created_at: { $lt: oneDayAgo },
                content: { $ne: null }
            },
            { $set: { content: null } }
        );

        console.log(`Mensajes de imagen limpiados: ${result.modifiedCount}`);
    } catch (err) {
        console.error('Error limpiando imágenes vencidas:', err);
    }
});