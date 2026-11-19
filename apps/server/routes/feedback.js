const express = require('express');
const nodemailer = require('nodemailer');

const router = express.Router();
const FEEDBACK_EMAILS = {
  'Bag Count': 'support@gloverlabsstudio.com',
};
const DEFAULT_FEEDBACK_EMAIL = 'brannonglover@gmail.com';

// Create transporter - uses Gmail SMTP when credentials are set
function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    return null;
  }
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

router.post('/', async (req, res) => {
  try {
    const { type, message } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const transporter = getTransporter();
    if (!transporter) {
      console.warn('Feedback received but email not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env');
      return res.status(503).json({
        error: 'Feedback service is not configured. Please try again later.',
      });
    }

    const appName = typeof req.body.app === 'string' && req.body.app.trim() ? req.body.app.trim() : 'Cavaro';
    const appVersion = typeof req.body.appVersion === 'string' ? req.body.appVersion.trim() : '';
    const typeLabel = type || 'General';
    const feedbackEmail = FEEDBACK_EMAILS[appName] || DEFAULT_FEEDBACK_EMAIL;
    const subject = `[${appName} Feedback] ${typeLabel}: ${message.slice(0, 50)}${message.length > 50 ? '...' : ''}`;
    const html = `
      <p><strong>App:</strong> ${appName}${appVersion ? ` (${appVersion})` : ''}</p>
      <p><strong>Type:</strong> ${typeLabel}</p>
      <p><strong>Message:</strong></p>
      <p>${message.trim().replace(/\n/g, '<br>')}</p>
      <hr>
      <p style="color:#888;font-size:12px;">Sent from ${appName} app</p>
    `;

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: feedbackEmail,
      subject,
      html,
      text: `App: ${appName}${appVersion ? ` (${appVersion})` : ''}\nType: ${typeLabel}\n\nMessage:\n${message.trim()}`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Feedback send error:', err);
    res.status(500).json({ error: 'Failed to send feedback. Please try again.' });
  }
});

module.exports = router;
