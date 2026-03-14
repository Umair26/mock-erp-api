require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const axios = require('axios');

const ERP_URL = process.env.ERP_URL || 'http://localhost:3000';
const TOKEN   = process.env.API_TOKEN || 'erp-secret-token-2024-umair';
const headers = { Authorization: `Bearer ${TOKEN}` };

async function lookupCustomer(idOrEmail) {
  const isEmail = typeof idOrEmail === 'string' && idOrEmail.includes('@');
  const params  = isEmail
    ? { customer_email: idOrEmail }
    : { customer_id: idOrEmail };

  console.log(`🔍 ERP customer lookup:`, params);
  const res = await axios.get(`${ERP_URL}/api/customer`, { headers, params });
  return res.data;
}

async function lookupItem(article_number) {
  const res = await axios.get(`${ERP_URL}/api/item`, { headers, params: { article_number } });
  return res.data;
}

async function createOrder(customer_id, items) {
  const res = await axios.post(`${ERP_URL}/api/order`, { customer_id, items }, { headers });
  return res.data;
}

module.exports = { lookupCustomer, lookupItem, createOrder };