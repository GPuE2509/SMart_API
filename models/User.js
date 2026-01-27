const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true
  },
  full_name: {
    type: String,
    maxlength: 255
  },
  email: {
    type: String,
    maxlength: 255,
    unique: true,
    sparse: true
  },
  phone: {
    type: String,
    maxlength: 20,
    unique: true,
    sparse: true
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  password: {
    type: String,
    maxlength: 255
  },
  role: {
    type: String,
    enum: ['admin', 'seller_staff', 'repository_staff', 'customer'],
    default: 'customer'
  },
  status: {
    type: String,
    enum: ['active', 'blocked'],
    default: 'active'
  },
  avatar_url: {
    type: String,
    maxlength: 500000 // Increased to 500KB for base64 images
  },
  loyalty_points: {
    type: Number,
    default: 0
  },
  address: {
    street: {
      type: String,
      maxlength: 500
    },
    ward: {
      type: String,
      maxlength: 255
    },
    district: {
      type: String,
      maxlength: 255
    },
    city: {
      type: String,
      maxlength: 255
    }
  },
  otp: {
    type: String
  },
  otpExpiry: {
    type: Date
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  loginToken: {
    type: String
  },
  loginTokenExpiry: {
    type: Date
  },
  loginSessionId: {
    type: String
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('User', userSchema);
