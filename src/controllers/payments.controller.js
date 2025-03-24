const Payment = require('../models/payment.model');

exports.getPayments = async (req, res) => {
  try {
    const payments = await Payment.find().sort({ created_at: -1 });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo pagos' });
  }
};

exports.getPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({ message: 'Pago no encontrado' });
    }

    res.json(payment);
  } catch (error) {
    res.status(500).json({ message: 'Error obteniendo pago' });
  }
};

exports.createPayment = async (req, res) => {
  try {
    const { customerName, amount, date, image } = req.body;

    const payment = new Payment({
      customerName,
      amount,
      date,
      image,
      status: 'pending'
    });

    await payment.save();
    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ message: 'Error creando pago' });
  }
};

exports.approvePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({ message: 'Pago no encontrado' });
    }

    payment.status = 'approved';
    await payment.save();

    res.json(payment);
  } catch (error) {
    res.status(500).json({ message: 'Error aprobando pago' });
  }
};

exports.rejectPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id);

    if (!payment) {
      return res.status(404).json({ message: 'Pago no encontrado' });
    }

    payment.status = 'rejected';
    await payment.save();

    res.json(payment);
  } catch (error) {
    res.status(500).json({ message: 'Error rechazando pago' });
  }
};

exports.uploadReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const { receiptImage } = req.body;

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({ message: 'Pago no encontrado' });
    }

    payment.image = receiptImage;
    await payment.save();

    res.json(payment);
  } catch (error) {
    res.status(500).json({ message: 'Error subiendo comprobante' });
  }
};