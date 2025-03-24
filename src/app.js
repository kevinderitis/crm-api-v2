const express = require('express');
const cors = require('cors');
const http = require('http');
const connectDB = require('./config/db');
const { setupWebSocket, broadcastToAll, broadcastPaymentsToAll, broadcastTicketsToAll } = require('./websocket/socket');
const config = require('./config/config');

// Importar rutas
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const messagesRoutes = require('./routes/messages.routes');
const tagsRoutes = require('./routes/tags.routes');
const metaRoutes = require('./routes/meta.routes');
const paymentsRoutes = require('./routes/payments.routes');
const ticketsRoutes = require('./routes/tickets.routes');

// Crear app Express
const app = express();

// Conectar a MongoDB
connectDB();

// const allowedOrigins = [
//     'http://localhost:5173',
//     'http://127.0.0.1:5500',
//     'http://localhost:3000'
// ];

const allowedOrigins = [
    '*'
];

// Middleware
app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));
app.use(express.json());

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/tickets', ticketsRoutes);

// Crear servidor HTTP
const server = http.createServer(app);

// Configurar WebSocket
setupWebSocket(server);

// Ruta POST para emitir el mensaje
app.post('/broadcast', (req, res) => {
    const { type, conversation, message, payment, ticket } = req.body;

    if (!type) {
        return res.status(400).json({ error: 'Faltan datos en el body' });
    }

    if(type === 'new_payment') {
        broadcastPaymentsToAll(type, payment);
        return res.status(200).json({ success: true, message: 'Mensaje de pago enviado a todos los clientes' });
    }

    if(type === 'new_ticket') {
        broadcastTicketsToAll(type, ticket);
        return res.status(200).json({ success: true, message: 'Ticket enviado a todos los clientes' });
    }


    try {
        broadcastToAll(type, conversation, message);
        res.status(200).json({ success: true, message: 'Mensaje enviado a todos los clientes' });
    } catch (error) {
        console.error('Error al emitir mensaje:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

const PORT = config.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
// Exportar para usar en tests
module.exports = { app, server };