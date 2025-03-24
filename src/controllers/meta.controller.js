const MetaConfig = require('../models/meta.model');
const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const Payment = require('../models/payment.model');
const Ticket = require('../models/ticket.model');
const config = require('../config/config');
const { broadcastPaymentsToAll, broadcastToAll, broadcastTicketsToAll } = require('../websocket/socket');
const { sendMessage } = require('./openai.controller');

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

    // Verificar si es un desafío de verificación
    if (body.hub?.challenge) {
      return res.send(body.hub.challenge);
    }

    // Procesar eventos de mensajes de Messenger
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

function generateUsername(name) {
  if (!name || name.trim() === "") {
    const randomWords = [
      "victory",    // Victoria
      "fortuna",    // Fortuna
      "jackpot",    // Jackpot
      "luck",       // Suerte
      "winner",     // Ganador
      "prosper",    // Prosperar
      "treasure",   // Tesoro
      "glory",      // Gloria
      "chance",     // Oportunidad
      "champion",   // Campeón
      "blessed",    // Bendecido
      "golden",     // Dorado
      "destiny",    // Destino
      "success",    // Éxito
      "luckiest",   // Más afortunado
      "star",       // Estrella
      "miracle",    // Milagro
      "thrill",     // Emoción
      "power",      // Poder
      "dream",      // Sueño
      "afortunado", // Afortunado
      "milagro",    // Milagro
      "sueño",      // Sueño
      "campeón",    // Campeón
      "bendecido",  // Bendecido
      "emoción",    // Emoción
      "estrella",   // Estrella
      "poder",      // Poder
      "premio",     // Premio
      "exito",      // Éxito
      "prosperar",  // Prosperar
      "oportunidad",// Oportunidad
      "dorado",     // Dorado
      "tesoro",     // Tesoro
      "victoria",   // Victoria
    ];
    name = randomWords[Math.floor(Math.random() * randomWords.length)];
  }

  // Normalizar el nombre: quitar acentos, convertir a minúsculas y eliminar espacios
  let baseUsername = name.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

  // Generar un sufijo aleatorio (número entre 1000 y 9999)
  let randomSuffix = Math.floor(1000 + Math.random() * 9000);

  return `${baseUsername}${randomSuffix}`;
}

function generateEasyPassword() {
  const words = ["luna", "sol", "mar", "rio", "nube", "viento", "flor", "roca", "fuego", "estrella"];
  const word1 = words[Math.floor(Math.random() * words.length)];
  const word2 = words[Math.floor(Math.random() * words.length)];
  const number = Math.floor(10 + Math.random() * 90);

  return `${word1}${word2}${number}`;
}

async function processMessengerMessage(messaging, fanpageId) {
  const { sender, message } = messaging;
  const timestamp = new Date();
  try {
    // 1. Buscar o crear conversación
    let conversation = await Conversation.findOne({ customer_id: sender.id });
    let imageUrl;

    if (!conversation) {
      // Obtener información del perfil desde la API de Meta
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

      const newTicket ={
        subject: "Crear usuario",
        description: `${userName} - ${userPassword}`,
        conversation: conversation._id,
        date: new Date(),
        status: "open"
      };

      const ticket = new Ticket(newTicket);

      await ticket.save();

      broadcastTicketsToAll("new_ticket", ticket);

    } else {
      conversation.last_message = message.text;
      conversation.last_message_at = timestamp;
      conversation.unread_count += 1;

      // process image

      if (message.attachments) {
        for (const attachment of message.attachments) {
          if (attachment.type === 'image') {
            imageUrl = attachment.payload.url;
            console.log('Imagen recibida:', imageUrl);

            const newPayment = {
              customerName: conversation.customer_name,
              date: timestamp,
              image: imageUrl,
              status: 'pending'
            };

            const payment = new Payment(newPayment);

            await payment.save();
            broadcastPaymentsToAll("new_payment", newPayment);
          }
        }
      }
    }

    await conversation.save();

    // 2. Crear mensaje
    const newMessage = new Message({
      conversation_id: conversation._id,
      sender_id: sender.id,
      content: message.text || imageUrl,
      type: message.attachments && message.attachments.length > 0 ? 'image' : 'text',
      created_at: new Date(timestamp)
    });

    await newMessage.save();

    let conv = {
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

    let msg = {
      id: newMessage._id,
      conversation_id: newMessage.conversation_id,
      sender_id: newMessage.sender_id,
      content: newMessage.content,
      type: newMessage.type,
      created_at: newMessage.created_at
    };

    if (!conversation.ai_enabled) {
      console.log('Enviar mensaje a AI');
      let response = await sendMessage(conversation.ai_thread_id, message.text);

      if(response.newThread){
        conversation.ai_thread_id = response.newThread;
        await conversation.save();
      }

      const newMessage = new Message({
        conversation_id: conversation._id,
        sender_id: 'AI',
        content: response.text,
        type: 'text',
        created_at: new Date(timestamp)
      });
  
      await newMessage.save();
      
    } 

    broadcastToAll('new_customer_message', conv, msg);

  } catch (error) {
    console.error('Error procesando mensaje de Messenger:', error);
    throw error;
  }
}

async function getMessengerProfile(userId) {
  // const config = await MetaConfig.findOne();
  // if (!config) throw new Error('Meta configuration not found');

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${userId}?fields=name,profile_pic&access_token=${config.FACEBOOK_ACCESS_TOKEN}`
  );

  if (!response.ok) {
    // throw new Error('Error fetching Messenger profile');
    return;
  }

  return response.json();
}


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


exports.sendMessengerMessage = async (recipientId, message, pageId) => {
  const PAGE_ACCESS_TOKEN = config.FACEBOOK_ACCESS_TOKEN;

  if (!PAGE_ACCESS_TOKEN) {
    console.error(`No se encontró el token de acceso para la página ${pageId}`);
    return;
  }
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v20.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
      {
        recipient: { id: recipientId },
        message,
      }
    );
    console.log('Mensaje enviado:', response);
  } catch (error) {
    console.error('Error enviando mensaje:', error);
  }
};