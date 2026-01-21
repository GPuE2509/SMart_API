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
  }
};

module.exports = paymentConfig;
