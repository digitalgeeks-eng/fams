import axios from 'axios';
import PAYSTACK_BASE from '../config/paystack.js';
import dotenv from 'dotenv';

dotenv.config();

const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
const paystackTestUrl = process.env.PAYSTACK_TEST_URL || 'https://paystack.shop/pay/78ffdd1u7e';
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const paystackCallbackUrl = `${clientUrl}/student/bookings`;

const paystackClient = axios.create({
  baseURL: PAYSTACK_BASE,
  headers: {
    Authorization: `Bearer ${paystackSecretKey}`,
    'Content-Type': 'application/json'
  }
});

const formatPaystackError = (error) => {
  if (error.response?.data) {
    const apiMessage = error.response.data.message || JSON.stringify(error.response.data);
    return { status: false, message: `Paystack error: ${apiMessage}` };
  }

  if (error.request) {
    return { status: false, message: 'No response from Paystack. Check your network and API secret key.' };
  }

  return { status: false, message: error.message || 'Unknown Paystack error' };
};

const validatePaystackConfig = () => {
  if (!paystackSecretKey || paystackSecretKey.includes('your_paystack')) {
    return {
      status: false,
      message: 'PAYSTACK_SECRET_KEY is not configured correctly in the server .env file.'
    };
  }
  return { status: true };
};

export const initializePayment = async (amount, email, metadata = {}) => {
  const configCheck = validatePaystackConfig();
  if (!configCheck.status) {
    return {
      status: true,
      isTestMode: true,
      data: {
        authorization_url: paystackTestUrl,
        reference: `test-${Date.now()}`,
        amount: Math.round(amount * 100),
        email,
        metadata
      },
      message: configCheck.message
    };
  }

  try {
    const response = await paystackClient.post('/transaction/initialize', {
      email,
      amount: Math.round(amount * 100),
      metadata,
      callback_url: paystackCallbackUrl
    });
    return response.data;
  } catch (error) {
    return formatPaystackError(error);
  }
};

export const verifyPayment = async (reference) => {
  const configCheck = validatePaystackConfig();
  if (!configCheck.status) {
    return { status: true, data: { status: 'success', reference } };
  }

  try {
    const response = await paystackClient.get(`/transaction/verify/${reference}`);
    return response.data;
  } catch (error) {
    return formatPaystackError(error);
  }
};
