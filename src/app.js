const express = require('express');
const cors = require('cors');
const http = require('http');
const connectDB = require('./config/db');
const { setupWebSocket } = require('./websocket/socket');
const config = require('./config/config');

// Importar rutas
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const messagesRoutes = require('./routes/messages.routes');
const tagsRoutes = require('./routes/tags.routes');
const metaRoutes = require('./routes/meta.routes');
const paymentsRoutes = require('./routes/payments.routes');
const ticketsRoutes = require('./routes/tickets.routes');
const clientRoutes = require('./routes/client.routes');
const notificationRoutes = require('./routes/notification.routes');
const reportsRoutes = require('./routes/reports.routes');

// Crear app Express
const app = express();

// Conectar a MongoDB
connectDB();

// const allowedOrigins = [
//     'http://localhost:5173',
//     'http://127.0.0.1:5500',
//     'http://localhost:3000'
// ];

const allowedOrigins = '*';

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
app.use('/api/clients', clientRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportsRoutes);


// Crear servidor HTTP
const server = http.createServer(app);

// Configurar WebSocket
setupWebSocket(server);

const PORT = config.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
// Exportar para usar en tests
module.exports = { app, server };