const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const config = require('../config/config');

let wss;

const setupWebSocket = (server) => {
  wss = new WebSocketServer({ server });

  // Middleware de autenticación para WebSocket
  wss.on('connection', (ws, req) => {
    const token = new URL(req.url, `http://${req.headers.host}`).searchParams.get('token');
    if (!token) {
      ws.close(4000, 'Authentication error');
      return;
    }

    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      ws.user = decoded;
    } catch (err) {
      ws.close(4000, 'Authentication error');
      return;
    }

    console.log('Cliente conectado:', ws._socket.remoteAddress);

    // Set up ping interval
    ws.isAlive = true;
    ws.pingInterval = setInterval(() => {
      if (!ws.isAlive) {
        clearInterval(ws.pingInterval);
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    }, 30000); // Send ping every 30 seconds

    // Handle pong responses
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle custom ping messages
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);

        // Handle ping type messages
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        // Handle other message types...
        const { customer_id, customer_name, profile_picture, content, type } = message;

        // Buscar o crear conversación
        let conversation = await Conversation.findOne({ customer_id });

        if (!conversation) {
          conversation = new Conversation({
            customer_id,
            customer_name,
            profile_picture,
            last_message: content,
            last_message_at: new Date(),
            unread_count: 1
          });
          await conversation.save();
        } else {
          conversation.last_message = content;
          conversation.last_message_at = new Date();
          conversation.unread_count += 1;
          await conversation.save();
        }

        // Crear mensaje
        const newMessage = new Message({
          conversation_id: conversation._id,
          sender_id: customer_id,
          content,
          type: type || 'text'
        });
        await newMessage.save();

        // Emitir a todos los agentes
        broadcastToAgents('new_customer_message', {
          conversation: {
            id: conversation._id,
            customer_id: conversation.customer_id,
            customer_name: conversation.customer_name,
            last_message: conversation.last_message,
            last_message_at: conversation.last_message_at,
            unread_count: conversation.unread_count,
            profile_picture: conversation.profile_picture,
            tags: conversation.tags,
            assigned_to: conversation.assigned_to
          },
          message: {
            id: newMessage._id,
            conversation_id: newMessage.conversation_id,
            sender_id: newMessage.sender_id,
            content: newMessage.content,
            type: newMessage.type,
            created_at: newMessage.created_at
          }
        });
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    // Unirse a sala personal basada en el rol del usuario
    if (ws.user.role === 'agent') {
      ws.room = 'agents';  // Asignamos la sala de agentes
    }

    // Unirse a sala de conversación específica
    ws.on('join_conversation', (conversationId) => {
      ws.room = conversationId;
      console.log(`Cliente unido a la conversación: ${conversationId}`);
    });

    // Dejar sala de conversación
    ws.on('leave_conversation', (conversationId) => {
      if (ws.room === conversationId) {
        ws.room = null;
        console.log(`Cliente dejó la conversación: ${conversationId}`);
      }
    });

    // Manejar desconexión
    ws.on('close', () => {
      clearInterval(ws.pingInterval);
      console.log('Cliente desconectado:', ws._socket.remoteAddress);
    });
  });

  // Set up server-side heartbeat interval
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });
};

// Función para emitir a todos los sockets conectados
const broadcastToAll = (type, conversation, message) => {
  if (!wss) {
    throw new Error('WebSocket no inicializado');
  }
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({ type, conversation, message }));
    }
  });
};

// Función para emitir a todos los sockets conectados
const broadcastPaymentsToAll = (type, payment) => {
  if (!wss) {
    throw new Error('WebSocket no inicializado');
  }
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({ type, payment }));
    }
  });
};

// Función para emitir a todos los sockets conectados
const broadcastTicketsToAll = (type, ticket) => {
  if (!wss) {
    throw new Error('WebSocket no inicializado');
  }
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({ type, ticket }));
    }
  });
};

// Función para emitir solo a los agentes
const broadcastToAgents = (eventName, data) => {
  if (!wss) {
    throw new Error('WebSocket no inicializado');
  }
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN && client.room === 'agents') {
      client.send(JSON.stringify({ event: eventName, data }));
    }
  });
};

module.exports = {
  setupWebSocket,
  broadcastToAll,
  broadcastToAgents,
  broadcastPaymentsToAll,
  broadcastTicketsToAll
};
