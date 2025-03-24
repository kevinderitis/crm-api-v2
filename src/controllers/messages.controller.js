const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const { sendMessengerMessage } = require('./meta.controller');

exports.getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find()
      .sort({ last_message_at: -1 });

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo conversaciones' });
  }
};

exports.getConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation) {
      return res.status(404).json({ message: 'Conversación no encontrada' });
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo conversación' });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversación no encontrada' });
    }

    // Actualizar el contador de mensajes no leídos a 0
    conversation.unread_count = 0;
    await conversation.save();

    // Emitir evento de actualización a través de WebSocket
    const { broadcastToAgents } = require('../websocket/socket');
    broadcastToAgents('conversation_update', { conversation });

    res.json(conversation);
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    res.status(500).json({ message: 'Error marcando conversación como leída' });
  }
};

exports.updateConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const conversation = await Conversation.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ message: 'Conversación no encontrada' });
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: 'Error actualizando conversación' });
  }
};

exports.toggleAI = async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await Conversation.findById(id);

    if (!conversation) {
      return res.status(404).json({ message: 'Conversación no encontrada' });
    }

    conversation.ai_enabled = !conversation.ai_enabled;
    await conversation.save();

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: 'Error actualizando estado de IA' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const messages = await Message.find({ conversation_id: conversationId })
      .sort({ created_at: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo mensajes' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversación no encontrada' });
    }

    const message = new Message({
      conversation_id: conversationId,
      sender_id: req.user.id,
      content,
      type: 'text'
    });

    await message.save();

    // Actualizar última actividad de la conversación
    conversation.last_message = content;
    conversation.last_message_at = new Date();
    await conversation.save();

    await sendMessengerMessage(conversation.customer_id, content, conversation.fanpage_id);

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: 'Error enviando mensaje' });
  }
};

exports.sendImage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { imageUrl } = req.body;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversación no encontrada' });
    }

    const message = new Message({
      conversation_id: conversationId,
      sender_id: req.user.id,
      content: imageUrl,
      type: 'image'
    });

    await message.save();

    // Actualizar última actividad de la conversación
    conversation.last_message = '📷 Imagen';
    conversation.last_message_at = new Date();
    await conversation.save();

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: 'Error enviando imagen' });
  }
};

exports.updateCustomerName = async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_name } = req.body;

    if (!customer_name || customer_name.trim() === '') {
      return res.status(400).json({ message: 'El nombre del cliente es requerido' });
    }

    const conversation = await Conversation.findByIdAndUpdate(
      id,
      { customer_name: customer_name.trim() },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ message: 'Conversación no encontrada' });
    }

    // Emitir evento de actualización a través de WebSocket
    const { broadcastToAgents } = require('../websocket/socket');
    broadcastToAgents('conversation_update', conversation);

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: 'Error actualizando nombre del cliente' });
  }
};