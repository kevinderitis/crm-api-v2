const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  customer_id: {
    type: String,
    required: true
  },
  customer_name: {
    type: String,
    required: true
  },
  customer_password: {
    type: String
  },
  last_message: {
    type: String,
    default: ''
  },
  last_message_at: {
    type: Date,
    default: Date.now
  },
  unread_count: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String
  }],
  profile_picture: {
    type: String
  },
  ai_enabled: {
    type: Boolean,
    default: true
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  fanpage_id: {
    type: String,
    required: true
  },
  ai_thread_id: {
    type: String
  },
});

module.exports = mongoose.model('Conversation', conversationSchema);