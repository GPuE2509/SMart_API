const { PayOS } = require("@payos/node");

// Payment Gateway Configuration
const paymentConfig = {
  // MoMo Configuration
  momo: {
    partnerCode: process.env.MOMO_PARTNER_CODE,
    accessKey: process.env.MOMO_ACCESS_KEY,
    secretKey: process.env.MOMO_SECRET_KEY,
    payUrl: process.env.MOMO_PAY_URL,
    returnUrl: process.env.MOMO_RETURN_URL,
    ipnUrl: process.env.MOMO_IPN_URL,
  },

  // PayOS Configuration
  payos: {
    clientId: process.env.PAYOS_CLIENT_ID,
    apiKey: process.env.PAYOS_API_KEY,
    checksumKey: process.env.PAYOS_CHECKSUM_KEY,
    returnUrl: process.env.PAYOS_RETURN_URL,
    cancelUrl: process.env.PAYOS_CANCEL_URL,
  },
};

// Initialize PayOS instance
const payos = new PayOS(
  paymentConfig.payos.clientId,
  paymentConfig.payos.apiKey,
  paymentConfig.payos.checksumKey,
);

module.exports = { paymentConfig, payos };
