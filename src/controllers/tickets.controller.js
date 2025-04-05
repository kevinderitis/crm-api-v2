const Ticket = require('../models/ticket.model');
const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const { sendMessengerMessage, generateUsername, generateEasyPassword } = require('./meta.controller');
const { sendMessage } = require('./openai.controller');
const { broadcastTicketsToAll } = require('../websocket/socket');


const cancelSubjectActions = {
  "Crear usuario": async (ticket) => {
    const conversation = await Conversation.findById(ticket.conversation);
    if (!conversation) return;

    conversation.customer_name = await generateUsername();
    conversation.customer_password = await generateEasyPassword();
    await conversation.save();

    const newTicket = new Ticket({
      subject: "Crear usuario",
      description: `${conversation.customer_name} - ${conversation.customer_password}`,
      conversation: conversation._id,
      date: new Date(),
      status: "open"
    });

    await newTicket.save();
    broadcastTicketsToAll("new_ticket", newTicket);
  },
  "Retiro": async (ticket) => {
    console.log("Retiro cancelado");
  }
};

const completeSubjectActions = {
  "Crear usuario": async (ticket, req) => {
    const conversation = await Conversation.findById(ticket.conversation);
    if (!conversation) return;

    const [user, password] = ticket.description.split(" - ");

    const message = `
Ya tenés creada tu cuenta. Estas son tus credenciales de acceso:

👤 Usuario: ${user}
🔑 Contraseña: ${password}

📌 Guarda bien estos datos y no los compartas con nadie.

💰 ¡Te deseamos muchísima suerte! Que la fortuna esté de tu lado. 🍀🔥
`;

    await sendMessengerMessage(conversation.customer_id, message, conversation.fanpage_id);

    const newMessage = new Message({
      conversation_id: conversation._id,
      sender_id: req.user.id,
      content: message,
      type: 'text'
    });

    await newMessage.save();

    if (conversation.ai_thread_id) {
      let msg = { event: 'usercreated', params: { user, password } };
      await sendMessage(JSON.stringify(msg), conversation.ai_thread_id);
    }
  },
  "Retiro": async (ticket, req) => {
    console.log("Retiro en proceso.");
  }
};

exports.getTickets = async (req, res) => {
  try {
    const tickets = await Ticket.find().sort({ created_at: -1 });
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo tickets' });
  }
};

exports.createTicket = async (req, res) => {
  try {
    const { subject, description, date, time } = req.body;

    const ticket = new Ticket({
      subject,
      description,
      date,
      time,
      created_by: req.user.id,
      status: 'open'
    });

    await ticket.save();
    res.status(201).json(ticket);
  } catch (error) {
    res.status(500).json({ message: 'Error creando ticket' });
  }
};

exports.completeTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await Ticket.findById(id);

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket no encontrado' });
    }

    ticket.status = 'completed';
    await ticket.save();

    if (completeSubjectActions[ticket.subject]) {
      await completeSubjectActions[ticket.subject](ticket, req);
    }

    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: 'Error completando ticket' });
  }
};


exports.cancelTicket = async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await Ticket.findById(id);

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket no encontrado' });
    }

    ticket.status = 'cancelled';
    await ticket.save();

    if (cancelSubjectActions[ticket.subject]) {
      await cancelSubjectActions[ticket.subject](ticket);
    }

    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: 'Error cancelando ticket' });
  }
};