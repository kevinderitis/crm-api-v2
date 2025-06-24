const { sendMessage } = require("./openai.controller");
const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");
const { broadcastToAll } = require("../websocket/socket");

function formatConversation(conversation) {
    return {
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
}

function formatMessage(message) {
    return {
        id: message._id,
        conversation_id: message.conversation_id,
        sender_id: message.sender_id,
        content: message.content,
        type: message.type,
        created_at: message.created_at
    };
}

// Funciones auxiliares
async function newConversation(userId) {
    const newConversation = new Conversation({
        customer_id: userId,
        fanpage_id: 'landing',
        last_message: '',
        last_message_at: new Date(),
        unread_count: 0
    });
    return newConversation.save();
}

exports.sendClientMessage = async (req, res) => {
    try {
        const { user_id, message } = req.body;

        console.log("Received message from client:", { user_id, message });

        if (!user_id) {
            return res.status(401).json({ message: 'Not authenticated - user_id' });
        }

        const conversation = await Conversation.findOne({ customer_id: user_id }) || await newConversation(user_id);

        if (!conversation) {
            return res.status(404).json({ message: 'Conversación no encontrada' });
        }

        const newMessage = new Message({
            conversation_id: conversation._id,
            sender_id: conversation.customer_id,
            content: message,
            type: 'text'
        });

        await newMessage.save();

        // Actualizar última actividad de la conversación
        conversation.last_message = message;
        conversation.last_message_at = new Date();
        conversation.source = 'web';

        let response;

        if (conversation.ai_enabled) {
            response = await sendMessage(message, conversation.ai_thread_id);

            if (response.newThread) {
                conversation.ai_thread_id = response.newThread;
            }

            const aiMessage = new Message({
                conversation_id: conversation._id,
                sender_id: 'AI',
                content: response.text,
                type: 'text',
                created_at: new Date()
            });

            await aiMessage.save();
        }

        await conversation.save();

        // broadcastToAll('new_customer_message', formatConversation(conversation), formatMessage(message));

        res.status(201).json(response);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error enviando mensaje' });
    }
};

// exports.sendClientMessage = async (req, res) => {
//     try {
//         const { content } = req.body;
//         const conversationId = req.user.conversation_id;
//         const conversation = await Conversation.findById(conversationId);
//         if (!conversation) {
//             return res.status(404).json({ message: 'Conversación no encontrada' });
//         }

//         const message = new Message({
//             conversation_id: conversationId,
//             sender_id: conversation.customer_id,
//             content,
//             type: 'text'
//         });

//         await message.save();

//         // Actualizar última actividad de la conversación
//         conversation.last_message = content;
//         conversation.last_message_at = new Date();
//         conversation.source = 'web';

//         let response;

//         if (conversation.ai_enabled) {
//             response = await sendMessage(content, conversation.ai_thread_id);

//             if (response.newThread) {
//                 conversation.ai_thread_id = response.newThread;
//             }

//             const aiMessage = new Message({
//                 conversation_id: conversation._id,
//                 sender_id: 'AI',
//                 content: response.text,
//                 type: 'text',
//                 created_at: new Date()
//             });

//             await aiMessage.save();
//         }

//         await conversation.save();

//         // broadcastToAll('new_customer_message', formatConversation(conversation), formatMessage(message));

//         res.status(201).json(response);
//     } catch (error) {
//         console.log(error);
//         res.status(500).json({ message: 'Error enviando mensaje' });
//     }
// };