// ============================================
// SYNORA V2.0 - USER MODEL
// ============================================
//
// Aenderungen gegenueber V1:
// 1. Passwort wird NUR hier gehasht, nie zusaetzlich in der Route
// 2. Doppelter Index auf email entfernt (Warnung beim Start)
// 3. firstname/lastname sind echte Felder (wurden vorher verworfen)
// 4. suchen_heute und datum fuer das Tageslimit
// ============================================

'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

// ==========================================
// LIMITS
// ==========================================
const LIMIT_ANGEMELDET = 15;   // Suchen pro Tag mit Konto
const BCRYPT_RUNDEN = 12;

/** Datum als YYYY-MM-DD in Schweizer Zeit */
function heutigesDatum() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
}

// ==========================================
// SCHEMA
// ==========================================

const userSchema = new mongoose.Schema({

  email: {
    type: String,
    required: [true, 'Email ist erforderlich'],
    unique: true,        // erzeugt bereits einen Index
    lowercase: true,
    trim: true,
    validate: {
      validator: (v) => validator.isEmail(v),
      message: 'Ungueltige Email-Adresse'
    }
    // KEIN index: true hier - sonst legt Mongoose den Index doppelt an
  },

  password: {
    type: String,
    required: [true, 'Passwort ist erforderlich'],
    minlength: [8, 'Passwort muss mindestens 8 Zeichen haben'],
    select: false // muss mit .select('+password') geladen werden
  },

  firstname: { type: String, trim: true, maxlength: 80, default: '' },
  lastname: { type: String, trim: true, maxlength: 80, default: '' },

  // ==========================================
  // ACCOUNT
  // ==========================================

  role: {
    type: String,
    enum: ['user', 'premium', 'admin'],
    default: 'user'
  },

  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },

  // ==========================================
  // TAGESLIMIT
  // ==========================================

  suchen_heute: { type: Number, default: 0, min: 0 },
  datum: { type: String, default: null }, // YYYY-MM-DD, Schweizer Zeit

  // ==========================================
  // PERSONALISIERUNG
  // ==========================================

  personalisierungAktiv: { type: Boolean, default: false },
  bestaetigteBestellungen: { type: Number, default: 0, min: 0 },

  // ==========================================
  // TOKENS
  // ==========================================

  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
  emailVerificationToken: { type: String, select: false },

  lastLogin: { type: Date, default: null },
  loginCount: { type: Number, default: 0 },

  // ==========================================
  // EINSTELLUNGEN
  // ==========================================

  settings: {
    language: { type: String, enum: ['de', 'en', 'fr', 'it'], default: 'de' },
    currency: { type: String, enum: ['CHF', 'EUR'], default: 'CHF' },
    country: { type: String, enum: ['CH', 'DE', 'AT'], default: 'CH' },
    emailNotifications: { type: Boolean, default: true },
    marketingEmails: { type: Boolean, default: false }
  },

  createdAt: { type: Date, default: Date.now, immutable: true },
  updatedAt: { type: Date, default: Date.now }

}, {
  timestamps: false,
  toJSON: {
    virtuals: true,
    transform: function (doc, ret) {
      delete ret.password;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      delete ret.emailVerificationToken;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// ==========================================
// INDEXES
// email steht nicht dabei - unique: true oben reicht
// ==========================================

userSchema.index({ createdAt: -1 });
userSchema.index({ isActive: 1, role: 1 });

// ==========================================
// VIRTUALS
// ==========================================

userSchema.virtual('name').get(function () {
  return [this.firstname, this.lastname].filter(Boolean).join(' ');
});

userSchema.virtual('displayName').get(function () {
  const n = [this.firstname, this.lastname].filter(Boolean).join(' ');
  if (n) return n;
  return this.email ? this.email.split('@')[0] : '';
});

userSchema.virtual('premium').get(function () {
  return this.role === 'premium' || this.role === 'admin';
});

userSchema.virtual('kannPersonalisieren').get(function () {
  return this.bestaetigteBestellungen >= 7;
});

// ==========================================
// PRE-SAVE
// Die EINZIGE Stelle, an der gehasht wird.
// Routen speichern das Klartext-Passwort, nie einen Hash.
// ==========================================

userSchema.pre('save', async function (next) {
  try {
    this.updatedAt = new Date();

    if (!this.isModified('password')) return next();

    // Sicherheitsnetz: bereits gehashte Werte nicht nochmal hashen
    if (/^\$2[aby]\$\d{2}\$/.test(this.password)) {
      console.warn('[User] Passwort war bereits gehasht - zweites Hashen uebersprungen');
      return next();
    }

    const salt = await bcrypt.genSalt(BCRYPT_RUNDEN);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// ==========================================
// METHODEN
// ==========================================

/** Passwort pruefen. Laedt das Feld nach, falls es nicht geladen war. */
userSchema.methods.comparePassword = async function (kandidat) {
  try {
    if (!kandidat) return false;

    let hash = this.password;
    if (!hash) {
      const mitPasswort = await this.constructor.findById(this._id).select('+password');
      if (!mitPasswort || !mitPasswort.password) return false;
      hash = mitPasswort.password;
    }

    return await bcrypt.compare(kandidat, hash);
  } catch (error) {
    console.error('[User] comparePassword Fehler:', error.message);
    return false;
  }
};

/** Tageslimit dieses Nutzers */
userSchema.methods.tagesLimit = function () {
  return this.premium ? Infinity : LIMIT_ANGEMELDET;
};

/**
 * Prueft das Tageslimit, ohne zu zaehlen.
 * @returns {{erlaubt:boolean, verbleibend:number, limit:number}}
 */
userSchema.methods.limitStatus = function () {
  const limit = this.tagesLimit();
  if (limit === Infinity) return { erlaubt: true, verbleibend: Infinity, limit: Infinity };

  const heute = heutigesDatum();
  const verbraucht = this.datum === heute ? (this.suchen_heute || 0) : 0;

  return {
    erlaubt: verbraucht < limit,
    verbleibend: Math.max(0, limit - verbraucht),
    limit
  };
};

/**
 * Eine Suche verbuchen. Setzt bei Datumswechsel zurueck.
 * Schreibt direkt in die Datenbank, damit keine Validierung
 * ueber nicht geladene Felder laeuft.
 */
userSchema.methods.sucheVerbuchen = async function () {
  const limit = this.tagesLimit();
  if (limit === Infinity) {
    return { erlaubt: true, verbleibend: Infinity, limit: Infinity };
  }

  const heute = heutigesDatum();
  if (this.datum !== heute) {
    this.datum = heute;
    this.suchen_heute = 0;
  }

  if (this.suchen_heute >= limit) {
    return { erlaubt: false, verbleibend: 0, limit };
  }

  this.suchen_heute += 1;

  await this.constructor.updateOne(
    { _id: this._id },
    { $set: { datum: this.datum, suchen_heute: this.suchen_heute, updatedAt: new Date() } }
  );

  return { erlaubt: true, verbleibend: limit - this.suchen_heute, limit };
};

userSchema.methods.registerLogin = async function () {
  try {
    await this.constructor.updateOne(
      { _id: this._id },
      { $set: { lastLogin: new Date() }, $inc: { loginCount: 1 } }
    );
  } catch (error) {
    console.error('[User] registerLogin Fehler:', error.message);
  }
};

userSchema.methods.createPasswordResetToken = async function () {
  const crypto = require('crypto');
  const resetToken = crypto.randomBytes(32).toString('hex');

  const hash = crypto.createHash('sha256').update(resetToken).digest('hex');

  await this.constructor.updateOne(
    { _id: this._id },
    { $set: { passwordResetToken: hash, passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000) } }
  );

  return resetToken;
};

userSchema.methods.toSafeObject = function () {
  const status = this.limitStatus();
  return {
    id: this._id,
    email: this.email,
    firstname: this.firstname,
    lastname: this.lastname,
    displayName: this.displayName,
    role: this.role,
    premium: this.premium,
    isEmailVerified: this.isEmailVerified,
    suchenVerbleibendHeute: status.verbleibend === Infinity ? null : status.verbleibend,
    tagesLimit: status.limit === Infinity ? null : status.limit,
    settings: this.settings,
    createdAt: this.createdAt
  };
};

// ==========================================
// STATICS
// ==========================================

userSchema.statics.findByEmail = async function (email, mitPasswort = false) {
  if (!email) return null;
  const query = this.findOne({ email: String(email).toLowerCase().trim() });
  if (mitPasswort) query.select('+password');
  return await query;
};

userSchema.statics.emailExists = async function (email) {
  if (!email) return false;
  const anzahl = await this.countDocuments({ email: String(email).toLowerCase().trim() });
  return anzahl > 0;
};

userSchema.statics.findByResetToken = async function (token) {
  if (!token) return null;
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(token).digest('hex');

  return await this.findOne({
    passwordResetToken: hash,
    passwordResetExpires: { $gt: new Date() }
  }).select('+passwordResetToken +passwordResetExpires');
};

userSchema.statics.LIMIT_ANGEMELDET = LIMIT_ANGEMELDET;
userSchema.statics.heutigesDatum = heutigesDatum;

module.exports = mongoose.models.User || mongoose.model('User', userSchema);