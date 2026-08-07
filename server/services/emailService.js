import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
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

  return transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    text,
    html
  });
};

export const buildNotificationEmail = ({ title, message }) => ({
  subject: title,
  html: `<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;"><h2>${title}</h2><p>${message}</p></div>`,
  text: `${title}\n\n${message}`
});
