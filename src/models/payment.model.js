const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: true
  },
  amount: {
    type: Number
  },
  date: {
    type: Date,
    required: true
  },
  image: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Payment', paymentSchema);