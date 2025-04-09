const User = require('../models/user.model');
const Conversation = require('../models/conversation.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config/config.js');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRATION }
    );

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

exports.logout = async (req, res) => {
  // En JWT la sesión se maneja del lado del cliente
  res.json({ message: 'Sesión cerrada exitosamente' });
};

exports.clientLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    const conversation = await Conversation.findOne({ customer_name: username });
    if (!conversation || conversation.customer_password !== password) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { conversation_id: conversation._id, username: conversation.customer_name, customer_id: conversation.customer_id },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRATION }
    );

    res.json({
      token,
      conversation: {
        conversation_id: conversation._id,
        username: conversation.customer_name,
        customer_id: conversation.customer_id,
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
};