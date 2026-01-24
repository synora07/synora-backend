// ============================================
// SYNORA - Auth Routes
// Registration, Login, Email Verification
// ============================================

var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
var crypto = require('crypto');
var User = require('../models/User');
var emailService = require('../services/emailService');

// ============================================
// REGISTER - POST /api/auth/register
// ============================================

router.post('/register', async function(req, res) {
  try {
    var firstname = req.body.firstname;
    var lastname = req.body.lastname;
    var email = req.body.email;
    var password = req.body.password;
    var birthdate = req.body.birthdate;

    console.log('📝 Registration attempt for:', email);

    // Check if user already exists
    var existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.log('❌ User already exists:', email);
      return res.status(400).json({ error: 'Diese E-Mail ist bereits registriert' });
    }

    // Hash password
    var salt = await bcrypt.genSalt(10);
    var hashedPassword = await bcrypt.hash(password, salt);

    // Create verification token
    var verificationToken = crypto.randomBytes(32).toString('hex');
    var verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create new user
    var newUser = new User({
      firstname: firstname,
      lastname: lastname,
      email: email.toLowerCase(),
      password: hashedPassword,
      birthdate: birthdate,
      verified: false,
      verificationToken: verificationToken,
      verificationExpires: verificationExpires,
      createdAt: new Date()
    });

    await newUser.save();
    console.log('✅ User created:', email);

    // Send verification email
    try {
      await emailService.sendVerificationEmail(
        email,
        firstname,
        verificationToken
      );
      console.log('✅ Verification email sent to:', email);
    } catch (emailError) {
      console.error('⚠️ Could not send verification email:', emailError.message);
      // Continue anyway - user can request new verification email later
    }

    res.status(201).json({
      success: true,
      message: 'Registrierung erfolgreich! Bitte prüfe deine E-Mails um dein Konto zu bestätigen.',
      requiresVerification: true
    });

  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
  }
});

// ============================================
// VERIFY EMAIL - GET /api/auth/verify/:token
// ============================================

router.get('/verify/:token', async function(req, res) {
  try {
    var token = req.params.token;
    console.log('🔍 Verification attempt with token:', token.substring(0, 10) + '...');

    // Find user with this token
    var user = await User.findOne({
      verificationToken: token,
      verificationExpires: { $gt: new Date() }
    });

    if (!user) {
      console.log('❌ Invalid or expired verification token');
      return res.status(400).json({ error: 'Ungültiger oder abgelaufener Bestätigungslink' });
    }

    // Verify user
    user.verified = true;
    user.verificationToken = undefined;
    user.verificationExpires = undefined;
    await user.save();

    console.log('✅ User verified:', user.email);

    res.json({
      success: true,
      message: 'E-Mail erfolgreich bestätigt! Du kannst dich jetzt einloggen.'
    });

  } catch (error) {
    console.error('❌ Verification error:', error);
    res.status(500).json({ error: 'Bestätigung fehlgeschlagen' });
  }
});

// ============================================
// RESEND VERIFICATION - POST /api/auth/resend-verification
// ============================================

router.post('/resend-verification', async function(req, res) {
  try {
    var email = req.body.email;

    var user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal if user exists
      return res.json({ success: true, message: 'Falls ein Konto existiert, wurde eine neue E-Mail gesendet.' });
    }

    if (user.verified) {
      return res.status(400).json({ error: 'Dieses Konto ist bereits bestätigt' });
    }

    // Create new verification token
    var verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = verificationToken;
    user.verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    // Send new verification email
    await emailService.sendVerificationEmail(
      user.email,
      user.firstname,
      verificationToken
    );

    res.json({ success: true, message: 'Neue Bestätigungs-E-Mail wurde gesendet.' });

  } catch (error) {
    console.error('❌ Resend verification error:', error);
    res.status(500).json({ error: 'Fehler beim Senden der E-Mail' });
  }
});

// ============================================
// LOGIN - POST /api/auth/login
// ============================================

router.post('/login', async function(req, res) {
  try {
    var email = req.body.email;
    var password = req.body.password;

    console.log('🔐 Login attempt for:', email);

    // Find user
    var user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ error: 'E-Mail oder Passwort falsch' });
    }

    // Check if verified
    if (!user.verified) {
      console.log('⚠️ User not verified:', email);
      return res.status(403).json({ 
        error: 'Bitte bestätige zuerst deine E-Mail-Adresse',
        requiresVerification: true,
        email: email
      });
    }

    // Check password
    var isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log('❌ Wrong password for:', email);
      return res.status(401).json({ error: 'E-Mail oder Passwort falsch' });
    }

    // Create JWT token
    var token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log('✅ Login successful:', email);

    res.json({
      success: true,
      token: token,
      user: {
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login fehlgeschlagen' });
  }
});

// ============================================
// FORGOT PASSWORD - POST /api/auth/forgot-password
// ============================================

router.post('/forgot-password', async function(req, res) {
  try {
    var email = req.body.email;
    console.log('🔑 Password reset request for:', email);

    var user = await User.findOne({ email: email.toLowerCase() });

    // Always return success (security - don't reveal if user exists)
    if (!user) {
      return res.json({ success: true, message: 'Falls ein Konto existiert, wurde eine E-Mail gesendet.' });
    }

    // Create reset token
    var resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    // Send reset email
    await emailService.sendPasswordResetEmail(
      user.email,
      user.firstname,
      resetToken
    );

    console.log('✅ Password reset email sent to:', email);

    res.json({ success: true, message: 'E-Mail zum Zurücksetzen wurde gesendet.' });

  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({ error: 'Fehler beim Senden der E-Mail' });
  }
});

// ============================================
// RESET PASSWORD - POST /api/auth/reset-password
// ============================================

router.post('/reset-password', async function(req, res) {
  try {
    var token = req.body.token;
    var newPassword = req.body.password;

    var user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Ungültiger oder abgelaufener Reset-Link' });
    }

    // Hash new password
    var salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    console.log('✅ Password reset successful for:', user.email);

    res.json({ success: true, message: 'Passwort erfolgreich geändert!' });

  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({ error: 'Passwort ändern fehlgeschlagen' });
  }
});

module.exports = router;