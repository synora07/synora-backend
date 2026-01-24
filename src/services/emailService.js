// ============================================
// SYNORA - Email Service
// Resend API für Verifizierungs-Emails
// ============================================

// ============================================
// SEND EMAIL VIA RESEND API
// ============================================

async function sendEmail(to, subject, html) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'SYNORA <noreply@synora.li>',
        to: to,
        subject: subject,
        html: html
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Resend API Error:', data);
      throw new Error(data.message || 'Email sending failed');
    }

    console.log('✅ Email sent via Resend:', data.id);
    return { success: true, messageId: data.id };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw error;
  }
}

// ============================================
// SEND VERIFICATION EMAIL
// ============================================

async function sendVerificationEmail(userEmail, userName, verificationToken) {
  var verificationUrl = process.env.FRONTEND_URL + '/landing.html?verify=' + verificationToken;
  
  var html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; padding: 40px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2E8B57; font-size: 32px; margin: 0;">SYNORA</h1>
        <p style="color: #888; margin-top: 5px;">AI Shopping Assistant</p>
      </div>
      
      <div style="background: #1a1a1a; padding: 30px; border-radius: 8px; border: 1px solid #2E8B57;">
        <h2 style="color: #ffffff; margin-top: 0;">Hallo ${userName}! 👋</h2>
        
        <p style="color: #cccccc; line-height: 1.6;">
          Vielen Dank für deine Registrierung bei SYNORA!
        </p>
        
        <p style="color: #cccccc; line-height: 1.6;">
          Bitte klicke auf den Button unten, um deine E-Mail-Adresse zu bestätigen:
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background: #2E8B57; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">E-Mail bestätigen</a>
        </div>
        
        <p style="color: #888; font-size: 14px;">
          Oder kopiere diesen Link in deinen Browser:<br>
          <a href="${verificationUrl}" style="color: #2E8B57; word-break: break-all;">${verificationUrl}</a>
        </p>
        
        <p style="color: #888; font-size: 14px; margin-top: 30px;">
          Dieser Link ist 24 Stunden gültig.
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 30px; color: #666; font-size: 12px;">
        <p>© 2024 SYNORA - Intelligent Shopping Assistant</p>
        <p>Du erhältst diese E-Mail, weil du dich bei SYNORA registriert hast.</p>
      </div>
    </div>
  `;

  return await sendEmail(userEmail, '✅ Bestätige deine SYNORA Registrierung', html);
}

// ============================================
// SEND PASSWORD RESET EMAIL
// ============================================

async function sendPasswordResetEmail(userEmail, userName, resetToken) {
  var resetUrl = process.env.FRONTEND_URL + '/landing.html?reset=' + resetToken;
  
  var html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; padding: 40px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2E8B57; font-size: 32px; margin: 0;">SYNORA</h1>
        <p style="color: #888; margin-top: 5px;">AI Shopping Assistant</p>
      </div>
      
      <div style="background: #1a1a1a; padding: 30px; border-radius: 8px; border: 1px solid #2E8B57;">
        <h2 style="color: #ffffff; margin-top: 0;">Passwort zurücksetzen 🔑</h2>
        
        <p style="color: #cccccc; line-height: 1.6;">
          Hallo ${userName},
        </p>
        
        <p style="color: #cccccc; line-height: 1.6;">
          Du hast angefordert, dein Passwort zurückzusetzen. Klicke auf den Button unten:
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: #2E8B57; color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Neues Passwort setzen</a>
        </div>
        
        <p style="color: #888; font-size: 14px;">
          Oder kopiere diesen Link:<br>
          <a href="${resetUrl}" style="color: #2E8B57; word-break: break-all;">${resetUrl}</a>
        </p>
        
        <p style="color: #ff6b6b; font-size: 14px; margin-top: 30px;">
          ⚠️ Dieser Link ist nur 1 Stunde gültig.<br>
          Falls du das nicht warst, ignoriere diese E-Mail.
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 30px; color: #666; font-size: 12px;">
        <p>© 2024 SYNORA - Intelligent Shopping Assistant</p>
      </div>
    </div>
  `;

  return await sendEmail(userEmail, '🔐 Passwort zurücksetzen - SYNORA', html);
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  sendVerificationEmail: sendVerificationEmail,
  sendPasswordResetEmail: sendPasswordResetEmail
};

console.log('✅ Email Service Ready - Resend API');
