// ============================================
// SYNORA - Benachrichtigungen
// ============================================
// Eine Stelle fuer alles, was den Nutzer erreicht. Heute E-Mail und
// Browser-Push, spaeter vielleicht mehr - der Aufrufer merkt davon
// nichts.
//
// WARUM ERST E-MAIL, DANN PUSH
//
// E-Mail erreicht jeden und braucht nichts im Frontend. Push
// braucht VAPID-Schluessel, einen Service Worker, die Erlaubnis des
// Nutzers, und ist auf dem iPhone unzuverlaessig. Darum laeuft der
// Preisalarm von Tag 1 mit E-Mail, und Push kommt dazu, sobald das
// Frontend so weit ist. Beide Wege sind hier schon vorgesehen.
//
// KEIN ANBIETER FEST EINGEBAUT
//
// Welcher Maildienst benutzt wird, steht in der .env. Ohne Angabe
// wird nichts verschickt, sondern ins Log geschrieben - so kannst
// du den ganzen Preisalarm testen, ohne einen Dienst anzumelden und
// ohne jemandem eine Mail zu schicken.
//
// EINSTELLUNGEN (.env)
//
//   MAIL_ANBIETER=aus        aus | smtp | resend | brevo
//   MAIL_ABSENDER=SYNORA <hallo@synora.li>
//
//   fuer smtp (nutzt die Zeilen, die schon in deiner .env stehen):
//   SMTP_HOST=...  SMTP_PORT=587  SMTP_USER=...  SMTP_PASS=...
//
//   fuer resend oder brevo:
//   MAIL_API_KEY=...
//
//   PUSH_AKTIV=false         true, sobald das Frontend so weit ist
//   VAPID_PUBLIC=...
//   VAPID_PRIVATE=...
//   VAPID_KONTAKT=mailto:hallo@synora.li
//
//   FRONTEND_URL=...         fuer den Abmelde-Link in der Mail
// ============================================

'use strict';

const axios = require('axios');

const MAIL_ANBIETER = String(process.env.MAIL_ANBIETER || 'aus').trim().toLowerCase();
const MAIL_API_KEY = process.env.MAIL_API_KEY || '';
const MAIL_ABSENDER = process.env.MAIL_ABSENDER || 'SYNORA <hallo@synora.li>';

const PUSH_AKTIV = String(process.env.PUSH_AKTIV || '').trim().toLowerCase() === 'true';

// Wohin der Abmelde-Link am Mailende zeigt. Ohne FRONTEND_URL die
// Live-Adresse - eine Mail mit localhost-Link waere peinlicher als
// eine mit einem Link, der beim Nutzer eben funktioniert.
const FRONTEND_URL = String(process.env.FRONTEND_URL || 'https://synora.li').replace(/\/+$/, '');

const SMTP = {
  host: process.env.SMTP_HOST || '',
  port: Number(process.env.SMTP_PORT) || 587,
  user: process.env.SMTP_USER || '',
  pass: process.env.SMTP_PASS || ''
};

const SMTP_VOLLSTAENDIG = !!(SMTP.host && SMTP.user && SMTP.pass);

if (MAIL_ANBIETER === 'aus') {
  console.log('[mail] MAIL_ANBIETER=aus - Mails werden nur ins Log geschrieben, nicht verschickt.');
} else if (MAIL_ANBIETER === 'smtp' && !SMTP_VOLLSTAENDIG) {
  console.warn('[mail] MAIL_ANBIETER=smtp, aber SMTP_HOST/USER/PASS sind unvollstaendig - es wird nichts verschickt.');
} else if (MAIL_ANBIETER !== 'smtp' && !MAIL_API_KEY) {
  console.warn(`[mail] MAIL_ANBIETER=${MAIL_ANBIETER}, aber MAIL_API_KEY fehlt - es wird nichts verschickt.`);
}

// ============================================
// SMTP ueber nodemailer
// ============================================
// Optional geladen, genau wie web-push: fehlt das Paket, bleibt
// nur der Mailversand stumm statt dass der Server nicht startet.

let nodemailer = null;
let versender = null;

function smtpVorbereiten() {
  if (versender) return versender;
  if (!SMTP_VOLLSTAENDIG) return null;

  try {
    nodemailer = require('nodemailer');
  } catch (_) {
    console.warn('[mail] Paket "nodemailer" ist nicht installiert: npm i nodemailer');
    return null;
  }

  versender = nodemailer.createTransport({
    host: SMTP.host,
    port: SMTP.port,
    // Port 465 spricht von Anfang an verschluesselt, 587 schaltet
    // erst waehrend der Verbindung um (STARTTLS).
    secure: SMTP.port === 465,
    auth: { user: SMTP.user, pass: SMTP.pass }
  });

  console.log(`[mail] SMTP bereit (${SMTP.host}:${SMTP.port})`);
  return versender;
}

// ============================================
// Absender zerlegen
// ============================================
// "SYNORA <hallo@synora.li>" -> { name, adresse }

function absender() {
  const m = String(MAIL_ABSENDER).match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1] || 'SYNORA', adresse: m[2] };
  return { name: 'SYNORA', adresse: String(MAIL_ABSENDER).trim() };
}

// ============================================
// E-MAIL
// ============================================

async function mailSenden({ an, betreff, text, html }) {
  if (!an || !betreff || !(text || html)) {
    return { ok: false, grund: 'Empfaenger, Betreff oder Inhalt fehlt' };
  }

  // Ohne Anbieter: nur zeigen, was verschickt WUERDE.
  const bereit = MAIL_ANBIETER === 'smtp' ? SMTP_VOLLSTAENDIG : !!MAIL_API_KEY;
  if (MAIL_ANBIETER === 'aus' || !bereit) {
    console.log(`[mail] (nicht verschickt) an ${an}: ${betreff}`);
    return { ok: true, versendet: false, nurLog: true };
  }

  const von = absender();

  try {
    if (MAIL_ANBIETER === 'smtp') {
      const v = smtpVorbereiten();
      if (!v) return { ok: false, grund: 'SMTP nicht eingerichtet' };

      await v.sendMail({
        from: `"${von.name}" <${von.adresse}>`,
        to: an,
        subject: betreff,
        text: text || undefined,
        html: html || undefined
      });
      return { ok: true, versendet: true };
    }

    if (MAIL_ANBIETER === 'resend') {
      await axios.post(
        'https://api.resend.com/emails',
        {
          from: `${von.name} <${von.adresse}>`,
          to: [an],
          subject: betreff,
          text: text || undefined,
          html: html || undefined
        },
        {
          headers: { Authorization: `Bearer ${MAIL_API_KEY}`, 'Content-Type': 'application/json' },
          timeout: 15000
        }
      );
      return { ok: true, versendet: true };
    }

    if (MAIL_ANBIETER === 'brevo') {
      await axios.post(
        'https://api.brevo.com/v3/smtp/email',
        {
          sender: { name: von.name, email: von.adresse },
          to: [{ email: an }],
          subject: betreff,
          textContent: text || undefined,
          htmlContent: html || undefined
        },
        {
          headers: { 'api-key': MAIL_API_KEY, 'Content-Type': 'application/json' },
          timeout: 15000
        }
      );
      return { ok: true, versendet: true };
    }

    console.warn(`[mail] Unbekannter Anbieter "${MAIL_ANBIETER}" - nichts verschickt.`);
    return { ok: false, grund: 'unbekannter Anbieter' };

  } catch (e) {
    const status = e.response && e.response.status;
    const grund = (e.response && e.response.data && (e.response.data.message || e.response.data.error)) || e.message;
    console.error(`[mail] an ${an} fehlgeschlagen: ${status || ''} ${String(grund).slice(0, 140)}`);
    return { ok: false, grund: String(grund).slice(0, 140) };
  }
}

// ============================================
// BROWSER-PUSH
// ============================================
// web-push ist absichtlich KEINE feste Abhaengigkeit. Fehlt das
// Paket, laeuft alles andere weiter und nur Push bleibt stumm -
// statt dass der Server gar nicht startet.

let webpush = null;
let pushBereit = false;

function pushVorbereiten() {
  if (pushBereit || !PUSH_AKTIV) return pushBereit;

  if (!process.env.VAPID_PUBLIC || !process.env.VAPID_PRIVATE) {
    console.warn('[push] PUSH_AKTIV=true, aber VAPID_PUBLIC/VAPID_PRIVATE fehlen.');
    return false;
  }

  try {
    webpush = require('web-push');
  } catch (_) {
    console.warn('[push] Paket "web-push" ist nicht installiert: npm i web-push');
    return false;
  }

  webpush.setVapidDetails(
    process.env.VAPID_KONTAKT || 'mailto:hallo@synora.li',
    process.env.VAPID_PUBLIC,
    process.env.VAPID_PRIVATE
  );
  pushBereit = true;
  console.log('[push] bereit');
  return true;
}

/**
 * abo = das Objekt, das der Browser beim Anmelden liefert
 *       ({ endpoint, keys: { p256dh, auth } }).
 * Rueckgabe .abgelaufen = true bedeutet: der Nutzer hat die
 * Erlaubnis entzogen oder den Browser gewechselt. Dann gehoert das
 * Abo geloescht, sonst wird es ewig weiter versucht.
 */
async function pushSenden({ abo, titel, text, url }) {
  if (!PUSH_AKTIV) return { ok: true, versendet: false, grund: 'Push ist aus' };
  if (!pushVorbereiten()) return { ok: false, grund: 'Push nicht eingerichtet' };
  if (!abo || !abo.endpoint) return { ok: false, grund: 'kein Abo' };

  try {
    await webpush.sendNotification(abo, JSON.stringify({ titel, text, url }));
    return { ok: true, versendet: true };
  } catch (e) {
    const weg = e.statusCode === 404 || e.statusCode === 410;
    if (!weg) console.error('[push] fehlgeschlagen:', e.message);
    return { ok: false, abgelaufen: weg, grund: e.message };
  }
}

// ============================================
// Der Preisalarm-Text
// ============================================
// Echte Umlaute. "fuer" sieht nach kaputter Software aus, und der
// Pruefkatalog schlaegt zu Recht Alarm.

function franken(wert) {
  return 'CHF ' + Number(wert).toFixed(2);
}

// ============================================
// SICHERHEIT: alles, was in die Mail kommt, kommt von draussen
// ============================================
// produktName und shop stammen aus SerpAPI, nicht von uns. Ein
// Produktname wie  Lampe "E27" <40W>  wuerde das HTML zerlegen -
// im besten Fall sieht die Mail kaputt aus, im schlechtesten
// bekommt der Nutzer fremdes Markup in sein Postfach.
//
// Darum laeuft JEDER Fremdtext durch htmlSicher und JEDE fremde
// Adresse durch linkSicher. Kein "das kommt ja von Google, das ist
// schon sauber" - genau so entstehen Luecken.

function htmlSicher(wert) {
  return String(wert == null ? '' : wert)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Nur http und https kommen in ein href. Alles andere wird verworfen. */
function linkSicher(adresse) {
  const s = String(adresse || '').trim();
  if (!/^https?:\/\//i.test(s)) return '';
  return htmlSicher(s);
}

// ============================================
// DAS AUSSEHEN - SYNORA-Farben
// ============================================
// Dieselben Werte wie in App.css. Steht hier noch einmal fest
// drin, weil eine Mail keine CSS-Variablen kennt: Gmail, Outlook
// und Apple Mail werfen externes CSS und :root raus. Jede Farbe
// muss direkt im style-Attribut stehen.
//
// Aenderst du die Marke, aenderst du diesen Block - und der Rest
// zieht nach, weil ihn sonst niemand mehr liest.

const F = {
  hintergrund: '#050807',   // --bg-dark
  karte: '#0a0d0b',         // --bg-card-solid
  rand: '#1c201e',          // --border, als Vollton (rgba haelt kein Outlook)
  gruen: '#2E8B57',         // --primary
  gruenHell: '#3da86d',     // --primary-light
  gruenDunkel: '#236B43',   // --primary-dark
  text: '#ffffff',          // --text
  gedaempft: '#a8a8a8',     // --text-muted
  blass: '#666666'          // --text-dim
};

const SCHRIFT = "'Outfit',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SCHRIFT_ZAHL = "'Space Grotesk','Outfit',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// ============================================
// alarmText - Betreff, Nurtext und HTML
// ============================================
// Kurz halten. Der Nutzer will eine Zahl und einen Link, keinen
// Aufsatz. Alles Erklaerende ist entweder weg oder steht klein
// unter dem Knopf.
//
// Rueckgabe: { betreff, text, html }
//   text  = Nurtext-Fassung, geht immer mit raus. Manche Nutzer
//           stellen HTML ab, und Spamfilter mogen Mails mit beidem.
//   html  = die gestaltete Fassung.
//
// Alle Felder ausser produktName/alt/neu sind freiwillig. Fehlt
// das Bild, faellt die Bildzeile weg - kein leerer Rahmen. Fehlt
// der Link, faellt der Knopf weg statt ins Nichts zu zeigen.

function alarmText({
  produktName,
  alt,
  neu,
  shop,
  link,
  bildUrl,
  zielPreis = null,
  abmeldenUrl = null
} = {}) {
  const neuZahl = Number(neu);
  const altZahl = Number(alt);

  // ============================================
  // OHNE LESBAREN PREIS KEINE MAIL
  // ============================================
  // Gefunden beim Pruefen am 04.10.2026: ohne Preis stand
  // "CHF NaN" im Betreff - und waere so verschickt worden.
  //
  // Dasselbe Prinzip wie Regel 1 und wie die Budgetwand: lieber
  // gar nichts als eine Zahl, die nicht stimmt. Eine Mail mit
  // "CHF NaN" kostet mehr Vertrauen als eine Mail, die ausbleibt.
  //
  // Der Aufrufer prueft .ok, bevor er verschickt.
  if (!Number.isFinite(neuZahl) || neuZahl <= 0) {
    return { ok: false, grund: 'Preis nicht lesbar', betreff: '', text: '', html: '' };
  }

  const gespart = Number.isFinite(altZahl) && altZahl > neuZahl ? altZahl - neuZahl : 0;
  const prozent = gespart > 0 ? Math.round((gespart / altZahl) * 100) : 0;
  const zeigeAlt = gespart > 0;

  const name = String(produktName || 'Dein beobachtetes Produkt');
  const abmelden = abmeldenUrl || `${FRONTEND_URL}/konto/preisalarme`;

  // ---------- Betreff ----------
  // Produkt, Preis, Ersparnis - in dieser Reihenfolge, weil die
  // Vorschau im Postfach nach rund 45 Zeichen abgeschnitten wird.
  const betreff = prozent > 0
    ? `${name} jetzt ${franken(neuZahl)} (-${prozent}%)`
    : `${name} jetzt ${franken(neuZahl)}`;

  // ---------- Nurtext ----------
  const text =
    `${name}\n` +
    `Jetzt ${franken(neuZahl)}` + (shop ? ` bei ${shop}` : '') + `.\n` +
    (zeigeAlt ? `Vorher ${franken(altZahl)} - ${franken(gespart)} weniger (${prozent}%).\n` : '') +
    (Number.isFinite(Number(zielPreis)) && Number(zielPreis) > 0
      ? `Dein Zielpreis: ${franken(zielPreis)}\n` : '') +
    (link ? `\nZum Angebot: ${link}\n` : '') +
    `\nDer Preis ist der Stand von eben. Pruefe ihn beim Haendler, bevor du kaufst.\n` +
    `Alarme verwalten: ${abmelden}\n`;

  // ---------- HTML ----------
  const nameH = htmlSicher(name);
  const shopH = htmlSicher(shop || '');
  const linkH = linkSicher(link);
  const bildH = linkSicher(bildUrl);
  const abmeldenH = linkSicher(abmelden) || htmlSicher(abmelden);

  // Die Vorschauzeile im Postfach. Ohne sie zeigt Gmail den ersten
  // sichtbaren Text - also das Wort "SYNORA", was nichts sagt.
  const vorschau = zeigeAlt
    ? `${franken(neuZahl)} statt ${franken(altZahl)}` + (shop ? ` bei ${shop}` : '')
    : franken(neuZahl) + (shop ? ` bei ${shop}` : '');

  const bildBlock = bildH ? `
          <tr>
            <td align="center" style="padding:0 0 20px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td bgcolor="#ffffff" style="background:#ffffff;border-radius:12px;padding:10px;">
                    <!-- Outlook und manche Gmail-Konten laden Bilder erst auf
                         Klick. Dann steht hier der alt-Text - der soll nach
                         Absicht aussehen und nicht nach kaputt, darum Schrift
                         und Farbe auch am img. -->
                    <img src="${bildH}" width="140" alt="${nameH}" border="0"
                         style="display:block;width:140px;max-width:140px;height:auto;border:0;border-radius:6px;font-family:${SCHRIFT};font-size:12px;line-height:1.4;color:#555555;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : '';

  const altPreisBlock = zeigeAlt ? `
                  <tr>
                    <td align="center" style="padding:6px 0 0 0;font-family:${SCHRIFT};font-size:14px;color:${F.gedaempft};">
                      <span style="text-decoration:line-through;color:${F.blass};">${franken(altZahl)}</span>
                      &nbsp;&nbsp;<span style="color:${F.gruenHell};">${franken(gespart)} weniger (-${prozent}%)</span>
                    </td>
                  </tr>` : '';

  const zielBlock = Number.isFinite(Number(zielPreis)) && Number(zielPreis) > 0 ? `
                  <tr>
                    <td align="center" style="padding:10px 0 0 0;font-family:${SCHRIFT};font-size:13px;color:${F.blass};">
                      Dein Zielpreis war ${franken(zielPreis)}.
                    </td>
                  </tr>` : '';

  // Der Knopf. Gerundete Ecken ignoriert Outlook - dort wird es
  // ein eckiger gruener Knopf. Das ist in Ordnung; ein Knopf, den
  // Outlook gar nicht anzeigt, waere es nicht.
  const knopfBlock = linkH ? `
          <tr>
            <td align="center" style="padding:24px 0 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="${F.gruen}" style="background:${F.gruen};border-radius:10px;">
                    <a href="${linkH}" target="_blank"
                       style="display:inline-block;padding:14px 32px;font-family:${SCHRIFT};font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                      ${shopH ? `Zum Angebot bei ${shopH}` : 'Zum Angebot'}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : `
          <tr>
            <td align="center" style="padding:20px 0 0 0;font-family:${SCHRIFT};font-size:14px;color:${F.gedaempft};">
              Den Link findest du in deinem Konto unter &bdquo;Preisalarme&ldquo;.
            </td>
          </tr>`;

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="dark light" />
<meta name="supported-color-schemes" content="dark light" />
<title>${htmlSicher(betreff)}</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&amp;family=Space+Grotesk:wght@500;700&amp;display=swap" rel="stylesheet" />
<style type="text/css">
  /* Gmail wirft das meiste davon weg - darum steht jede wichtige
     Angabe zusaetzlich im style-Attribut. Hier stehen nur die
     Dinge, die inline nicht gehen. */
  body { margin:0 !important; padding:0 !important; width:100% !important; background:${F.hintergrund}; }
  a { color:${F.gruenHell}; }
  @media screen and (max-width:620px) {
    .huelle { width:100% !important; }
    .polster { padding:24px 20px !important; }
    .preis { font-size:34px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${F.hintergrund};">

<!-- Vorschauzeile im Postfach. Sichtbar nur dort, nicht in der Mail. -->
<div style="display:none;font-size:1px;color:${F.hintergrund};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  ${htmlSicher(vorschau)}
</div>

<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${F.hintergrund}" style="background:${F.hintergrund};">
  <tr>
    <td align="center" style="padding:32px 12px;">

      <table role="presentation" class="huelle" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;">

        <!-- Wortmarke -->
        <tr>
          <td align="center" style="padding:0 0 22px 0;font-family:${SCHRIFT_ZAHL};font-size:22px;font-weight:700;letter-spacing:3px;color:${F.text};">
            SYN<span style="color:${F.gruen};">O</span>RA
          </td>
        </tr>

        <!-- Karte -->
        <tr>
          <td bgcolor="${F.karte}" style="background:${F.karte};border:1px solid ${F.rand};border-radius:16px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td class="polster" style="padding:32px 28px;">

                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">

                    <!-- Grund der Mail, in einer Zeile -->
                    <tr>
                      <td align="center" style="padding:0 0 20px 0;font-family:${SCHRIFT};font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${F.gruenHell};">
                        Preisalarm
                      </td>
                    </tr>
${bildBlock}
                    <!-- Produktname -->
                    <tr>
                      <td align="center" style="padding:0 0 16px 0;font-family:${SCHRIFT};font-size:17px;font-weight:500;line-height:1.4;color:${F.text};">
                        ${nameH}
                      </td>
                    </tr>

                    <!-- Preis -->
                    <tr>
                      <td align="center" class="preis" style="font-family:${SCHRIFT_ZAHL};font-size:40px;font-weight:700;line-height:1.1;color:${F.gruenHell};">
                        ${franken(neuZahl)}
                      </td>
                    </tr>
${shopH ? `
                    <tr>
                      <td align="center" style="padding:8px 0 0 0;font-family:${SCHRIFT};font-size:14px;color:${F.gedaempft};">
                        bei ${shopH}
                      </td>
                    </tr>` : ''}
${altPreisBlock}
${zielBlock}
${knopfBlock}

                    <!-- Ehrlichkeit. Kurz, aber nicht weglassbar. -->
                    <tr>
                      <td style="padding:26px 0 0 0;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                          <tr><td style="height:1px;background:${F.rand};line-height:1px;font-size:1px;">&nbsp;</td></tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding:16px 0 0 0;font-family:${SCHRIFT};font-size:12px;line-height:1.6;color:${F.blass};">
                        Preis vom Zeitpunkt der Pr&uuml;fung. Pr&uuml;fe ihn beim H&auml;ndler, bevor du kaufst.
                      </td>
                    </tr>

                  </table>

                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Fuss -->
        <tr>
          <td align="center" style="padding:22px 12px 0 12px;font-family:${SCHRIFT};font-size:12px;line-height:1.7;color:${F.blass};">
            Du bekommst diese Mail, weil du f&uuml;r dieses Produkt einen Preisalarm gesetzt hast.<br />
            <a href="${abmeldenH}" target="_blank" style="color:${F.gruenHell};text-decoration:underline;">Alarme verwalten oder abschalten</a>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:14px 0 0 0;font-family:${SCHRIFT};font-size:11px;color:#3a3f3c;">
            SYNORA &middot; synora.li
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>`;

  return { ok: true, betreff, text, html };
}

module.exports = {
  mailSenden,
  pushSenden,
  alarmText,
  franken,
  htmlSicher,
  linkSicher,
  FARBEN: F,
  EINGERICHTET: {
    mail: MAIL_ANBIETER !== 'aus' && (MAIL_ANBIETER === 'smtp' ? SMTP_VOLLSTAENDIG : !!MAIL_API_KEY),
    anbieter: MAIL_ANBIETER,
    push: PUSH_AKTIV
  }
};