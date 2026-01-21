const mongoose = require('mongoose');

const orderDetailSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true
  },
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  product_unit_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductUnit',
    required: true
  },
  product_batch_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductBatch'
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unit_price: {
    type: Number,
    default: 0
  },
  total_price: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('OrderDetail', orderDetailSchema);
