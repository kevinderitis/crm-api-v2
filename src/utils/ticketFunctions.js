const Ticket = require("../models/ticket.model");
const Conversation = require("../models/conversation.model");
const { broadcastTicketsToAll } = require("../websocket/socket");

const getConversationByThreadId = async threadId => {
    try {
        const conversation = await Conversation.findOne({ ai_thread_id: threadId });

        if (!conversation) {
            console.log('Conversation not found.')
        }

        return conversation;
    } catch (error) {
        res.status(500).json({ message: 'Error obteniendo conversación' });
    }
};

exports.createAndSendTicket = async (threadId, type, descrip) => {
    try {

        const conv = await getConversationByThreadId(threadId);

        const amount = type === 'Retiro' ? descrip : 0;

        const newTicket = new Ticket({
            subject: type,
            description: `${conv.customer_name} - ${descrip}`,
            conversation: conv._id,
            date: new Date(),
            status: "open",
            amount
        });

        await newTicket.save();
        broadcastTicketsToAll("new_ticket", newTicket);

        return newTicket;
    } catch (error) {
        console.error("Error al crear y enviar el ticket:", error);
        throw new Error("No se pudo crear el ticket");
    }
};