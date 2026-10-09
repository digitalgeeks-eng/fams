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

export class EmailDeliveryError extends Error {
  constructor(provider, category, message, statusCode = null) {
    super(message);
    this.name = 'EmailDeliveryError';
    this.provider = provider;
    this.category = category;
    this.statusCode = statusCode;
  }
}

const createBrevoHttpError = (statusCode) => {
  if (statusCode === 401 || statusCode === 403) {
    return new EmailDeliveryError('brevo', 'authentication', 'Brevo rejected the API credentials or request authorization.', statusCode);
  }
  if (statusCode === 400 || statusCode === 422) {
    return new EmailDeliveryError('brevo', 'request_validation', 'Brevo rejected the request. Verify EMAIL_FROM is a verified sender and the request fields are valid.', statusCode);
  }
  if (statusCode === 429) {
    return new EmailDeliveryError('brevo', 'rate_limit', 'Brevo rate limit reached.', statusCode);
  }
  if (statusCode >= 500) {
    return new EmailDeliveryError('brevo', 'provider', 'Brevo returned a server error.', statusCode);
  }
  return new EmailDeliveryError('brevo', 'http', 'Brevo returned an unsuccessful HTTP response.', statusCode);
};

export const getEmailDeliveryDiagnostics = (error) => {
  if (error instanceof EmailDeliveryError) {
    return {
      provider: error.provider,
      category: error.category,
      statusCode: error.statusCode,
      message: error.message
    };
  }

  return {
    provider: emailProvider,
    category: 'unexpected',
    statusCode: null,
    message: 'Email delivery failed due to an unexpected internal error.'
  };
};

export const sendEmail = async ({ to, subject, text, html }) => {
  if (!to || !subject || (!text && !html)) {
    throw new EmailDeliveryError(emailProvider, 'request_validation', 'Email recipient, subject and body are required.');
  }

  if (emailProvider === 'brevo') {
    if (!process.env.BREVO_API_KEY) {
      throw new EmailDeliveryError('brevo', 'configuration', 'BREVO_API_KEY is not configured.');
    }
    if (!process.env.EMAIL_FROM) {
      throw new EmailDeliveryError('brevo', 'configuration', 'EMAIL_FROM is not configured.');
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
        timeout: 15000,
        validateStatus: () => true
      });
    } catch (error) {
      const isTimeout = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT';
      throw new EmailDeliveryError(
        'brevo',
        isTimeout ? 'timeout' : 'network',
        isTimeout ? 'Brevo API request timed out.' : 'Could not connect to the Brevo API.'
      );
    }

    if (response.status < 200 || response.status >= 300) {
      throw createBrevoHttpError(response.status);
    }
    return response.data;
  }

  if (emailProvider === 'smtp') {
    try {
      return await smtpTransporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject,
        text,
        html
      });
    } catch {
      throw new EmailDeliveryError('smtp', 'transport', 'SMTP email delivery failed.');
    }
  }

  throw new EmailDeliveryError(emailProvider, 'configuration', 'EMAIL_PROVIDER must be either brevo or smtp.');
};

export const buildNotificationEmail = ({ title, message }) => ({
  subject: title,
  html: `<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;"><h2>${title}</h2><p>${message}</p></div>`,
  text: `${title}\n\n${message}`
});
