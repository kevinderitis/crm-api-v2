const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  subscription: {
    endpoint: {
      type: String,
      required: true
    },
    keys: {
      auth: {
        type: String,
        required: true
      },
      p256dh: {
        type: String,
        required: true
      }
    }
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Subscription', subscriptionSchema);