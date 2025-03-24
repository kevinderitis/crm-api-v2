const Tag = require('../models/tag.model');
const Conversation = require('../models/conversation.model');

exports.getTags = async (req, res) => {
  try {
    const tags = await Tag.find();
    res.json(tags);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo etiquetas' });
  }
};

exports.createTag = async (req, res) => {
  try {
    const { name, color } = req.body;

    const tagExists = await Tag.findOne({ name });
    if (tagExists) {
      return res.status(400).json({ message: 'Ya existe una etiqueta con ese nombre' });
    }

    const tag = new Tag({ name, color });
    await tag.save();

    res.status(201).json(tag);
  } catch (error) {
    res.status(500).json({ message: 'Error creando etiqueta' });
  }
};

exports.updateTag = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;

    const tag = await Tag.findByIdAndUpdate(
      id,
      { name, color },
      { new: true }
    );

    if (!tag) {
      return res.status(404).json({ message: 'Etiqueta no encontrada' });
    }

    res.json(tag);
  } catch (error) {
    res.status(500).json({ message: 'Error actualizando etiqueta' });
  }
};

exports.deleteTag = async (req, res) => {
  try {
    const { id } = req.params;
    await Tag.findByIdAndDelete(id);

    // Eliminar la etiqueta de todas las conversaciones
    await Conversation.updateMany(
      { tags: id },
      { $pull: { tags: id } }
    );

    res.json({ message: 'Etiqueta eliminada exitosamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error eliminando etiqueta' });
  }
};

exports.addTagToConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { tagId } = req.body;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversación no encontrada' });
    }

    if (!conversation.tags.includes(tagId)) {
      conversation.tags.push(tagId);
      await conversation.save();
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: 'Error agregando etiqueta a la conversación' });
  }
};

exports.removeTagFromConversation = async (req, res) => {
  try {
    const { conversationId, tagId } = req.params;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversación no encontrada' });
    }

    conversation.tags = conversation.tags.filter(tag => tag !== tagId);
    await conversation.save();

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ message: 'Error removiendo etiqueta de la conversación' });
  }
};