const MetaConfig = require('../models/meta.model');
const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const Payment = require('../models/payment.model');
const Ticket = require('../models/ticket.model');
const config = require('../config/config');
const axios = require('axios');
const { broadcastPaymentsToAll, broadcastToAll, broadcastTicketsToAll } = require('../websocket/socket');
const { sendMessage } = require('./openai.controller');

// Estructuras para manejar las colas de mensajes
const customerBatches = new Map();
const processingQueues = new Map();

exports.getConfig = async (req, res) => {
  try {
    const config = await MetaConfig.findOne();
    res.json(config || {});
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo configuración de Meta' });
  }
};

exports.updateConfig = async (req, res) => {
  try {
    const { accessToken, fanpageId } = req.body;

    let config = await MetaConfig.findOne();
    if (config) {
      config.accessToken = accessToken;
      config.fanpageId = fanpageId;
      config.updated_at = new Date();
    } else {
      config = new MetaConfig({
        accessToken,
        fanpageId,
        webhookUrl: `${process.env.API_URL}/api/meta/webhook`
      });
    }

    await config.save();
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: 'Error actualizando configuración de Meta' });
  }
};

exports.handleWebhook = async (req, res) => {
  try {
    const { body } = req;

    if (body.hub?.challenge) {
      return res.send(body.hub.challenge);
    }

    if (body.object === 'page') {
      for (const entry of body.entry) {
        const fanpageId = entry.id;
        for (const messaging of entry.messaging) {
          if (messaging.message) {
            await processMessengerMessage(messaging, fanpageId);
          }
        }
      }
    }

    res.status(200).send('EVENT_RECEIVED');
  } catch (error) {
    console.error('Error en webhook:', error);
    res.sendStatus(500);
  }
};

exports.verifyWebhook = (req, res) => {
  const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
};

exports.sendMessengerMessage = async (recipientId, msg, pageId) => {
  const PAGE_ACCESS_TOKEN = config.FACEBOOK_ACCESS_TOKEN;

  if (!PAGE_ACCESS_TOKEN) {
    console.error(`No se encontró el token de acceso para la página ${pageId}`);
    return;
  }
  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: recipientId },
        message: { text: msg },
      }
    );
  } catch (error) {
    console.error('Error enviando mensaje:', error);
  }
};

async function processMessengerMessage(messaging, fanpageId) {
  const customerId = messaging.sender.id;

  let batch = customerBatches.get(customerId);
  if (batch) {
    batch.messages.push({ messaging, fanpageId });
    clearTimeout(batch.timeoutId);
    batch.timeoutId = setTimeout(() => finalizeBatch(customerId), 5000);
    customerBatches.set(customerId, batch);
  } else {
    batch = {
      messages: [{ messaging, fanpageId }],
      timeoutId: setTimeout(() => finalizeBatch(customerId), 5000)
    };
    customerBatches.set(customerId, batch);
  }
}

function finalizeBatch(customerId) {
  const batch = customerBatches.get(customerId);
  if (!batch) return;

  customerBatches.delete(customerId);

  if (!processingQueues.has(customerId)) {
    processingQueues.set(customerId, []);
  }
  const queue = processingQueues.get(customerId);
  queue.push(batch.messages);
  processCustomerQueue(customerId);
}

async function processCustomerQueue(customerId) {
  const queue = processingQueues.get(customerId);
  if (!queue || queue.processing) return;

  queue.processing = true;

  while (queue.length > 0) {
    const batchMessages = queue.shift();
    for (const messageData of batchMessages) {
      await processSingleMessage(messageData.messaging, messageData.fanpageId);
    }
  }

  queue.processing = false;
  processingQueues.delete(customerId);
}

async function processSingleMessage(messaging, fanpageId) {
  const { sender, message } = messaging;
  const timestamp = new Date();

  try {
    let conversation = await Conversation.findOne({ customer_id: sender.id });
    let imageUrl;

    if (!conversation) {
      const profileInfo = await getMessengerProfile(sender.id);
      let userName = generateUsername(profileInfo?.name || "");
      let userPassword = generateEasyPassword();

      conversation = new Conversation({
        customer_id: sender.id,
        customer_name: userName,
        customer_password: userPassword,
        fanpage_id: fanpageId,
        profile_picture: profileInfo ? profileInfo.profile_pic : '',
        last_message: message.text,
        last_message_at: timestamp,
        unread_count: 1
      });

      const newTicket = new Ticket({
        subject: "Crear usuario",
        description: `${userName} - ${userPassword}`,
        conversation: conversation._id,
        date: new Date(),
        status: "open"
      });

      await newTicket.save();
      broadcastTicketsToAll("new_ticket", newTicket);
    } else {
      conversation.last_message = message.text;
      conversation.last_message_at = timestamp;
      conversation.unread_count += 1;

      if (message.attachments) {
        for (const attachment of message.attachments) {
          if (attachment.type === 'image') {
            imageUrl = attachment.payload.url;
            const newPayment = new Payment({
              customerName: conversation.customer_name,
              date: timestamp,
              image: imageUrl,
              status: 'pending'
            });
            await newPayment.save();
            broadcastPaymentsToAll("new_payment", newPayment);
          }
        }
      }
    }

    await conversation.save();

    const newMessage = new Message({
      conversation_id: conversation._id,
      sender_id: sender.id,
      content: message.text || imageUrl,
      type: message.attachments?.length > 0 ? 'image' : 'text',
      created_at: timestamp
    });

    await newMessage.save();

    const convData = {
      id: conversation._id,
      customer_id: conversation.customer_id,
      customer_name: conversation.customer_name,
      last_message: conversation.last_message,
      last_message_at: conversation.last_message_at,
      unread_count: conversation.unread_count,
      profile_picture: conversation.profile_picture,
      tags: conversation.tags,
      assigned_to: conversation.assigned_to
    };

    const msgData = {
      id: newMessage._id,
      conversation_id: newMessage.conversation_id,
      sender_id: newMessage.sender_id,
      content: newMessage.content,
      type: newMessage.type,
      created_at: newMessage.created_at
    };

    broadcastToAll('new_customer_message', convData, msgData);

    if (conversation.ai_enabled && !message.attachments) {
      const response = await sendMessage(message.text, conversation.ai_thread_id);

      if (response.newThread) {
        conversation.ai_thread_id = response.newThread;
        await conversation.save();
      }

      const aiMessage = new Message({
        conversation_id: conversation._id,
        sender_id: 'AI',
        content: response.text,
        type: 'text',
        created_at: new Date()
      });

      await aiMessage.save();
      await sendMessenger(conversation.customer_id, response.text, conversation.fanpage_id);
    }

  } catch (error) {
    console.error('Error procesando mensaje:', error);
  }
}

function generateUsername(name) {
  const randomWords = [
    "victory", "fortuna", "jackpot", "luck", "winner", "prosper",
    "treasure", "glory", "chance", "champion", "blessed", "golden",
    "destiny", "success", "luckiest", "star", "miracle", "thrill",
    "power", "dream", "afortunado", "milagro", "sueño", "campeón",
    "bendecido", "emoción", "estrella", "poder", "premio", "exito",
    "prosperar", "oportunidad", "dorado", "tesoro", "victoria"
  ];

  if (!name || name.trim() === "") {
    name = randomWords[Math.floor(Math.random() * randomWords.length)];
  }

  let baseUsername = name.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

  let randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${baseUsername}${randomSuffix}`;
}

function generateEasyPassword() {
  const words = ["luna", "sol", "mar", "rio", "nube", "viento",
    "flor", "roca", "fuego", "estrella"];
  const word1 = words[Math.floor(Math.random() * words.length)];
  const word2 = words[Math.floor(Math.random() * words.length)];
  const number = Math.floor(10 + Math.random() * 90);
  return `${word1}${word2}${number}`;
}

async function sendMessenger(recipientId, msg, pageId) {
  const PAGE_ACCESS_TOKEN = config.FACEBOOK_ACCESS_TOKEN;
  if (!PAGE_ACCESS_TOKEN) {
    console.error(`No se encontró el token de acceso para la página ${pageId}`);
    return;
  }
  try {
    await axios.post(
      `https://graph.facebook.com/v20.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: recipientId },
        message: { text: msg },
      }
    );
  } catch (error) {
    console.error('Error enviando mensaje:', error);
  }
}

async function getMessengerProfile(userId) {
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${userId}?fields=name,profile_pic&access_token=${config.FACEBOOK_ACCESS_TOKEN}`
    );
    return response.data;
  } catch (error) {
    console.error('Error obteniendo perfil de Messenger:', error);
    return null;
  }
}