const { lookupCustomer, createOrder, lookupItem } = require('./erpService');

const STATES = {
  IDENTIFY: 'IDENTIFY',
  ORDER: 'ORDER',
  QUANTITY: 'QUANTITY',
  ADD_MORE: 'ADD_MORE',
  CONFIRM: 'CONFIRM',
  DONE: 'DONE',
};

function newCallState() {
  return {
    state: STATES.IDENTIFY,
    customer: null,
    cart: [],
    currentItem: null,
  };
}

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

function wordsToNumber(text) {
  const map = {
    'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
    'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
    'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
    'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90, 'hundred': 100,
  };
  const lower = text.toLowerCase();
  for (const [word, val] of Object.entries(map)) {
    if (lower.includes(word)) return val;
  }
  return null;
}

function extractCustomerId(transcript) {
  const converted = wordsToDigits(transcript);
  console.log(`🔄 Converted: "${converted}"`);

  // Only match C + digits — never match other letters like A (article numbers)
  const cMatch = converted.match(/\bc\s*(\d[\s\d]*)/i);
  if (cMatch) {
    const digits = cMatch[1].replace(/\s+/g, '').slice(0, 3).padStart(3, '0');
    return `C${digits}`;
  }

  // Fallback: isolated digits only — NOT preceded by any letter (rules out A007 etc.)
  const numMatch = converted.match(/(?<![a-zA-Z])(\d\s*\d\s*\d|\d\s*\d|\d)(?!\s*\d)/);
  if (numMatch) {
    const digits = numMatch[1].replace(/\s+/g, '').padStart(3, '0').slice(0, 3);
    return `C${digits}`;
  }

  return null;
}

function extractQuantity(transcript) {
  const wordQty = wordsToNumber(transcript);
  if (wordQty) return wordQty;
  const converted = wordsToDigits(transcript);
  const match = converted.match(/(\d+)/);
  return match ? parseInt(match[1]) : 1;
}

// Format price naturally for speech: 19.99 → "19 dollars and 99 cents", 235 → "235 dollars"
function formatPrice(price) {
  const dollars = Math.floor(price);
  const cents = Math.round((price - dollars) * 100);
  if (cents === 0) return `${dollars} dollars`;
  return `${dollars} dollars and ${cents} cents`;
}

// Convert order number digits to spoken words: "14496" → "one four four nine six"
function speakOrderNumber(orderId) {
  const digits = orderId.replace('ORD-', '');
  const digitWords = { '0':'zero','1':'one','2':'two','3':'three','4':'four',
    '5':'five','6':'six','7':'seven','8':'eight','9':'nine' };
  return digits.split('').map(d => digitWords[d] || d).join(' ');
}

function cleanProductQuery(transcript) {
  return transcript
    .replace(/\b(i want|i need|get me|order|item|number|article|please|yeah|it's|its|add|also|and)\b/gi, ' ')
    .replace(/\b(pcs?|pieces?|boxes?|units?)\b/gi, ' ')
    .replace(/\d+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extract product intent from a mixed utterance like "yes please add gearbox lubricant"
function extractProductFromMixed(transcript) {
  return transcript
    .replace(/\b(yes|ja|sure|ok|okay|please|add|also|and|i want|i need|get me)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function spokenToEmail(text) {
  
  const cleaned = text
    .toLowerCase()
    .replace(/.*\b(is|address is|email is)\s*/i, '')
    .replace(/\bit'?s\s*/i, '')
    .replace(/\byeah\.?\s*/i, '')
    .replace(/\s+dot\s+/g, '.')
    .replace(/\s+at the rate\s+/g, '@')
    .replace(/\s+direct\s+/g, '@')   // ← "direct" → @
    .replace(/\s+at\s+/g, '@')
    .replace(/\s+/g, '');
  return cleaned.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/)?.[0] || null;
}

async function updateState(state, transcript) {
  const text = transcript.toLowerCase().trim();
  console.log(`📊 State: ${state.state} | Input: "${transcript}"`);

  // ── IDENTIFY ──
  if (state.state === STATES.IDENTIFY) {
    // Check for email — typed or spoken ("d dot wilson at gmail dot com")
    // In IDENTIFY, before lookupParam:
const emailAddress = 
  transcript.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] 
  || spokenToEmail(transcript);

// Skip if transcript has no useful info
if (!emailAddress && !extractCustomerId(transcript)) {
  return null; // stay silent, wait for more input
}
    const lookupParam = emailAddress
      ? { customer_email: emailAddress }
      : { customer_id: extractCustomerId(transcript) };

    console.log(`🔍 Lookup: ${JSON.stringify(lookupParam)}`);

    if (lookupParam.customer_id || lookupParam.customer_email) {
      try {
        const customer = await lookupCustomer(lookupParam.customer_id || lookupParam.customer_email);
        if (customer && customer.found) {
          state.customer = customer;
          state.state = STATES.ORDER;
          const de = customer.language === 'DE';
          return de
            ? `Guten Tag ${customer.customer_name}. Was möchten Sie bestellen?`
            : `Hello ${customer.customer_name}, welcome. What would you like to order today?`;
        }
      } catch (e) {
        console.error('Customer lookup error:', e.message);
      }
    }
    return "I could not find your account. Please say your customer ID, for Starts from C, or your email address.";
  }

  // ── ORDER ──
  if (state.state === STATES.ORDER) {
    const de = state.customer?.language === 'DE';

    // Check if customer says nothing/done/no more
    const nothingIntent = /\b(nothing|no more|that'?s all|done|finished|no|nein|nichts)\b/i.test(text);
    if (nothingIntent) {
      if (state.cart.length > 0) {
        state.state = STATES.CONFIRM;
        const totalAmount = state.cart.reduce((sum, i) => sum + i.total_price, 0);
        const summary = state.cart.map(i => `${i.quantity} ${i.item.item_title}`).join(', ');
        return de
          ? `Sie haben folgendes im Warenkorb: ${summary}. Gesamt: ${formatPrice(totalAmount)}. Soll ich bestellen?`
          : `You have ${summary} in your cart. Total is ${formatPrice(totalAmount)}. Shall I place the order?`;
      } else {
        return de
          ? 'Was möchten Sie bestellen? Bitte nennen Sie die Artikelnummer oder den Produktnamen.'
          : 'What would you like to order? Please provide the article number or product name.';
      }
    }

    // Try article number
    const articleMatch = transcript.toUpperCase().match(/A\s*(\d{3})/);
    let item = null;
    if (articleMatch) {
      try {
        const result = await lookupItem(`A${articleMatch[1]}`);
        if (result && result.found) item = result;
      } catch (e) {
        console.error('Item lookup error:', e.message);
      }
    }

    // Semantic search fallback
    if (!item) {
      const { searchProduct } = require('./semanticSearch');
      item = await searchProduct(transcript);
    }

    if (item && item.found) {
      if (item.availability_status === 'Out of stock') {
        return de
          ? `${item.item_title} ist leider nicht auf Lager. Möchten Sie etwas anderes?`
          : `${item.item_title} is out of stock. Would you like something else?`;
      }
      state.currentItem = item;
      state.state = STATES.QUANTITY;
      return de
        ? `Ich habe ${item.item_title} gefunden. Wie viele möchten Sie?`
        : `I found ${item.item_title}. How many would you like?`;
    }

    return de
      ? 'Produkt nicht gefunden. Bitte nennen Sie die Artikelnummer oder den Produktnamen.'
      : 'I could not find that product. Please provide the article number or product name.';
  }

  // ── QUANTITY ──
  if (state.state === STATES.QUANTITY) {
    const de = state.customer?.language === 'DE';
    const qty = extractQuantity(transcript);

    if (qty > 0 && state.currentItem) {
      const totalPrice = qty * parseFloat(state.currentItem.item_price || 0);
      state.cart.push({
        article_number: state.currentItem.article_number,
        quantity: qty,
        item: state.currentItem,
        total_price: totalPrice,
      });
      state.currentItem = null;
      state.state = STATES.ADD_MORE;
      const lastItem = state.cart[state.cart.length - 1];
      return de
        ? `${qty} ${lastItem.item.item_title} wurde hinzugefügt. Möchten Sie noch etwas bestellen?`
        : `Got it, ${qty} ${lastItem.item.item_title} added. Would you like to add another item?`;
    }

    return de
      ? 'Menge nicht verstanden. Bitte sagen Sie eine Zahl.'
      : 'I did not understand the quantity. Please say a number.';
  }

  // ── ADD MORE ──
  if (state.state === STATES.ADD_MORE) {
    const de = state.customer?.language === 'DE';
    const yes = /\b(yes|ja|more|add|another|other|want|sure|also)\b/i.test(text);
    const no  = /\b(no|nein|done|finished|that'?s|nothing|complete|confirm|place|order)\b/i.test(text);

    if (no) {
      state.state = STATES.CONFIRM;
      const totalAmount = state.cart.reduce((sum, i) => sum + i.total_price, 0);
      const summary = state.cart.map(i => `${i.quantity} ${i.item.item_title}`).join(', ');
      return de
        ? `Zusammenfassung: ${summary}. Gesamt: ${formatPrice(totalAmount)}. Soll ich bestellen?`
        : `Your order has ${summary}. Total is ${formatPrice(totalAmount)}. Shall I place the order?`;
    }

    // If they say yes AND mention a product in the same utterance, go straight to ORDER
    if (yes) {
      // Check if they also mentioned a product name in the same sentence
      const productHint = extractProductFromMixed(transcript);
      const hasProduct = productHint.length > 3 &&
        !/^(yes|ja|sure|ok|okay|please|add|more|another)$/i.test(productHint.trim());

      state.state = STATES.ORDER;

      if (hasProduct) {
        // Process it immediately as an order query
        return await updateState(state, productHint);
      }

      return de ? 'Was möchten Sie noch bestellen?' : 'What else would you like to order?';
    }

    return de ? 'Bitte sagen Sie Ja oder Nein.' : 'Please say yes or no.';
  }

  // ── CONFIRM ──
  if (state.state === STATES.CONFIRM) {
    const de = state.customer?.language === 'DE';
    const yes = /\b(yes|ja|correct|confirm|proceed|go|ok|okay|place|sure)\b/i.test(text);
    const no  = /\b(no|nein|cancel|back|change|modify)\b/i.test(text);

    if (yes) {
      try {
        const order = await createOrder(
          state.customer.customer_id,
          state.cart.map(i => ({ article_number: i.article_number, quantity: i.quantity }))
        );
        state.state = STATES.DONE;
        if (order.order_created) {
          const totalAmount = state.cart.reduce((sum, i) => sum + i.total_price, 0);
          const spokenId = speakOrderNumber(order.order_id);
          return de
            ? `Ihre Bestellung Nummer ${spokenId} wurde aufgegeben. Gesamt: ${formatPrice(totalAmount)}. Auf Wiedersehen!`
            : `Your order number ${spokenId} has been placed. Total is ${formatPrice(totalAmount)}. Thank you, goodbye!`;
        }
      } catch (e) {
        console.error('Order error:', e.message);
      }
      return 'Sorry, there was an error placing your order. Goodbye.';
    }

    if (no) {
      state.state = STATES.ORDER;
      state.cart = [];
      return de ? 'Kein Problem. Was möchten Sie bestellen?' : 'No problem. What would you like to order?';
    }

    return de ? 'Bitte sagen Sie Ja oder Nein.' : 'Please say yes or no.';
  }

  if (state.state === STATES.DONE) {
    return 'Your session has ended. Goodbye.';
  }

  return null;
}

module.exports = { newCallState, updateState };