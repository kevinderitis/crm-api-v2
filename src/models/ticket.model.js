const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['open', 'completed', 'cancelled', 'edited'],
    default: 'open'
  },
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation'
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  amount: {
    type: Number,
    default: 0
  },
  real_amount: {
    type: Number,
    default: 0
  },
  completed_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
});

module.exports = mongoose.model('Ticket', ticketSchema);