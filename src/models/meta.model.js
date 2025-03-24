const mongoose = require('mongoose');

const metaConfigSchema = new mongoose.Schema({
  accessToken: {
    type: String,
    required: true
  },
  fanpageId: {
    type: String,
    required: true
  },
  webhookUrl: {
    type: String,
    required: true
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

// Aseguramos que solo exista una configuración
metaConfigSchema.pre('save', async function(next) {
  const count = await this.constructor.countDocuments();
  if (count > 0 && !this.isUpdate) {
    const err = new Error('Solo puede existir una configuración de Meta');
    next(err);
  }
  next();
});

module.exports = mongoose.model('MetaConfig', metaConfigSchema);