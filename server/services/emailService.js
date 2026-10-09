import axios from 'axios';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const emailProvider = (process.env.EMAIL_PROVIDER || 'brevo').trim().toLowerCase();
const brevoApiUrl = 'https://api.brevo.com/v3/smtp/email';
const smtpTransporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export const sendEmail = async ({ to, subject, text, html }) => {
  if (!to || !subject || (!text && !html)) {
    throw new Error('Email recipient, subject and body are required');
  }

  if (emailProvider === 'brevo') {
    if (!process.env.BREVO_API_KEY) {
      throw new Error('BREVO_API_KEY is required when EMAIL_PROVIDER is brevo');
    }
    if (!process.env.EMAIL_FROM) {
      throw new Error('EMAIL_FROM is required when EMAIL_PROVIDER is brevo');
    }

    let response;
    try {
      response = await axios.post(brevoApiUrl, {
        sender: { email: process.env.EMAIL_FROM },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html
      }, {
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'content-type': 'application/json',
          accept: 'application/json'
        },
        timeout: 15000
      });
    } catch (error) {
      const status = error.response?.status;
      throw new Error(status
        ? `Brevo email API request failed with status ${status}.`
        : 'Brevo email API request failed.');
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Brevo email API request failed with status ${response.status}.`);
    }
    return response.data;
  }

  if (emailProvider === 'smtp') {
    return smtpTransporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      text,
      html
    });
  }

  throw new Error('EMAIL_PROVIDER must be either brevo or smtp');
};

export const buildNotificationEmail = ({ title, message }) => ({
  subject: title,
  html: `<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;"><h2>${title}</h2><p>${message}</p></div>`,
  text: `${title}\n\n${message}`
});
