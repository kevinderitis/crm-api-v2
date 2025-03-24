const Ticket = require('../models/ticket.model');
const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const { sendMessengerMessage } = require('./meta.controller');

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

    const conversation = await Conversation.findById(ticket.conversation);

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

    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: 'Error cancelando ticket' });
  }
};