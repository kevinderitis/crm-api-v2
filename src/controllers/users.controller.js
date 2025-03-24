const User = require('../models/user.model');
const bcrypt = require('bcryptjs');

exports.createUser = async (req, res) => {
  try {
    const { email, password, full_name, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'El email ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      email,
      password: hashedPassword,
      full_name,
      role
    });

    await user.save();

    res.status(201).json({
      id: user._id,
      email: user.email,
      full_name: user.full_name,
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creando usuario' });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo usuarios' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, full_name, role } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    if (email) user.email = email;
    if (full_name) user.full_name = full_name;
    if (role) user.role = role;

    await user.save();

    res.json({
      id: user._id,
      email: user.email,
      full_name: user.full_name,
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ message: 'Error actualizando usuario' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    res.json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error eliminando usuario' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo perfil' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { full_name, current_password, new_password } = req.body;
    const user = await User.findById(req.user.id);

    if (full_name) user.full_name = full_name;

    if (current_password && new_password) {
      const isValidPassword = await bcrypt.compare(current_password, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ message: 'Contraseña actual incorrecta' });
      }
      user.password = await bcrypt.hash(new_password, 10);
    }

    await user.save();

    res.json({
      id: user._id,
      email: user.email,
      full_name: user.full_name,
      role: user.role
    });
  } catch (error) {
    res.status(500).json({ message: 'Error actualizando perfil' });
  }
};