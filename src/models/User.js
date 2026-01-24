// ============================================
// SYNORA - User Model
// MongoDB Schema mit Email-Verifizierung
// ============================================

var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
  firstname: {
    type: String,
    required: true,
    trim: true
  },
  lastname: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  birthdate: {
    type: Date,
    required: false
  },
  
  // Email Verification
  verified: {
    type: Boolean,
    default: false
  },
  verificationToken: {
    type: String,
    required: false
  },
  verificationExpires: {
    type: Date,
    required: false
  },
  
  // Password Reset
  resetPasswordToken: {
    type: String,
    required: false
  },
  resetPasswordExpires: {
    type: Date,
    required: false
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update updatedAt on save
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('User', userSchema);