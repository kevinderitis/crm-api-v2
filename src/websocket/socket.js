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

    // Unirse a sala personal basada en el rol del usuario
    if (ws.user.role === 'agent') {
      ws.room = 'agents';  // Asignamos la sala de agentes
    }

    // Manejar nuevo mensaje del cliente
    ws.on('message', async (data) => {
      try {
        const messageData = JSON.parse(data);
        const { customer_id, customer_name, profile_picture, content, type } = messageData;

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
        const message = new Message({
          conversation_id: conversation._id,
          sender_id: customer_id,
          content,
          type: type || 'text'
        });
        await message.save();

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
            id: message._id,
            conversation_id: message.conversation_id,
            sender_id: message.sender_id,
            content: message.content,
            type: message.type,
            created_at: message.created_at
          }
        });
      } catch (error) {
        console.error('Error processing customer message:', error);
      }
    });

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
      console.log('Cliente desconectado:', ws._socket.remoteAddress);
    });
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