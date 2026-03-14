require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const axios = require('axios');

const ERP_URL = process.env.ERP_URL || 'http://localhost:3000';
const API_TOKEN = process.env.API_TOKEN;
const headers = { Authorization: `Bearer ${API_TOKEN}` };

function wordsToDigits(text) {
  return text
    .replace(/\btwenty\s*one\b/gi, '21')
    .replace(/\btwenty\b/gi, '20')
    .replace(/\bnineteen\b/gi, '19')
    .replace(/\beighteen\b/gi, '18')
    .replace(/\bseventeen\b/gi, '17')
    .replace(/\bsixteen\b/gi, '16')
    .replace(/\bfifteen\b/gi, '15')
    .replace(/\bfourteen\b/gi, '14')
    .replace(/\bthirteen\b/gi, '13')
    .replace(/\btwelve\b/gi, '12')
    .replace(/\beleven\b/gi, '11')
    .replace(/\bten\b/gi, '10')
    .replace(/\bzero\b/gi, '0').replace(/\bone\b/gi, '1')
    .replace(/\btwo\b/gi, '2').replace(/\bthree\b/gi, '3')
    .replace(/\bfour\b/gi, '4').replace(/\bfive\b/gi, '5')
    .replace(/\bsix\b/gi, '6').replace(/\bseven\b/gi, '7')
    .replace(/\beight\b/gi, '8').replace(/\bnine\b/gi, '9');
}

function extractArticleNumber(text) {
  let converted = wordsToDigits(text);

  // "eight" misheard as letter A
  converted = converted.replace(
    /\beight\s*(\d{1,2})\s*(\d{1,2})?\b/gi,
    (_, a, b) => `A${a}${b || ''}`
  );

  console.log(`🔄 Article search in: "${converted}"`);

  // Match letter + digits — handle "A 0 10" → A010
  const match = converted.match(/\b([A-Za-z])\s*([\d\s]{1,6})\b/);
  if (match) {
    const digits = match[2].replace(/\s+/g, '');
    const num = parseInt(digits, 10);
    if (!isNaN(num) && num >= 1 && num <= 999) {
      return `${match[1].toUpperCase()}${String(num).padStart(3, '0')}`;
    }
  }

  return null;
}

async function searchProduct(query) {
  console.log(`🔍 searchProduct: "${query}"`);

  const articleNumber = extractArticleNumber(query);
  if (articleNumber) {
    console.log(`🎯 Trying article number: ${articleNumber}`);
    try {
      const res = await axios.get(`${ERP_URL}/api/item`, {
        headers, params: { article_number: articleNumber }
      });
      if (res.data && res.data.found !== false) {
        console.log(`✅ Found by article: ${res.data.item_title}`);
        return { ...res.data, found: true };
      }
    } catch (e) {
      console.error(`❌ Article lookup failed:`, e.response?.data || e.message);
    }
  }

  const cleaned = wordsToDigits(query)
    .toLowerCase()
    .replace(/\b(yeah|i want|i need|get me|order|item|number|article|please|it's|its)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  console.log(`🔤 Keyword search: "${cleaned}"`);
  if (cleaned.length > 2) {
    try {
      const res = await axios.get(`${ERP_URL}/api/item`, {
        headers, params: { search: cleaned }
      });
      if (res.data && res.data.found !== false) {
        console.log(`✅ Found by search: ${res.data.item_title}`);
        return { ...res.data, found: true };
      }
    } catch (e) {
      console.error(`❌ Search failed:`, e.response?.data || e.message);
    }
  }

  return { found: false };
}

module.exports = { searchProduct };