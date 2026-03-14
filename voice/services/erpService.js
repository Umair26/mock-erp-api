require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const axios = require('axios');

const ERP_URL = process.env.ERP_URL || 'http://localhost:3000';
const TOKEN   = process.env.API_TOKEN || 'erp-secret-token-2024-umair';
const headers = { Authorization: `Bearer ${TOKEN}` };

console.log(`🌐 ERP_URL: ${ERP_URL}`);
console.log(`🔑 API_TOKEN: ${TOKEN ? TOKEN.slice(0,15)+'...' : 'MISSING'}`);

async function lookupCustomer(idOrEmail) {
  const isEmail = typeof idOrEmail === 'string' && idOrEmail.includes('@');
  const params  = isEmail
    ? { customer_email: idOrEmail }
    : { customer_id: idOrEmail };

  console.log(`🔍 ERP customer lookup:`, params);
  try {
    const res = await axios.get(`${ERP_URL}/api/customer`, { headers, params });
    return res.data;
  } catch (e) {
    console.error(`❌ Customer lookup failed: ${e.response?.status} — ${JSON.stringify(e.response?.data) || e.message}`);
    throw e;
  }
}

async function lookupItem(article_number) {
  try {
    const res = await axios.get(`${ERP_URL}/api/item`, { headers, params: { article_number } });
    return res.data;
  } catch (e) {
    console.error(`❌ Item lookup failed: ${e.response?.status} — ${JSON.stringify(e.response?.data) || e.message}`);
    throw e;
  }
}

async function createOrder(customer_id, items) {
  try {
    const res = await axios.post(`${ERP_URL}/api/order`, { customer_id, items }, { headers });
    return res.data;
  } catch (e) {
    console.error(`❌ Order creation failed: ${e.response?.status} — ${JSON.stringify(e.response?.data) || e.message}`);
    throw e;
  }
}

module.exports = { lookupCustomer, lookupItem, createOrder };