const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model.js');
const config = require('../config/config.js');

async function createAdminUser() {
  try {
    await mongoose.connect(config.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    const adminData = {
      email: 'admin@example.com',
      password: await bcrypt.hash('admin123', 10),
      full_name: 'Admin User',
      role: 'admin',
      created_at: new Date()
    };

    const adminUser = new User(adminData);
    await adminUser.save();

    console.log('Usuario admin creado exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('Error creando usuario admin:', error);
    process.exit(1);
  }
}

createAdminUser();