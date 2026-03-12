const { lookupCustomer, createOrder } = require('./erpService');

const STATES = {
  IDENTIFY: 'IDENTIFY',
  ORDER: 'ORDER',
  CONFIRM: 'CONFIRM',
  PLACE: 'PLACE',
  DONE: 'DONE',
};

function newCallState() {
  return { state: STATES.IDENTIFY, customer: null, cart: [] };
}

// Convert spoken numbers to digits: "zero zero one" → "001"
function wordsToDigits(text) {
  return text
    .toLowerCase()
    .replace(/\bzero\b/g, '0')
    .replace(/\bone\b/g, '1')
    .replace(/\btwo\b/g, '2')
    .replace(/\bthree\b/g, '3')
    .replace(/\bfour\b/g, '4')
    .replace(/\bfive\b/g, '5')
    .replace(/\bsix\b/g, '6')
    .replace(/\bseven\b/g, '7')
    .replace(/\beight\b/g, '8')
    .replace(/\bnine\b/g, '9')
    .replace(/\s+/g, '');
}

async function updateState(state, transcript) {
  const text = transcript.toLowerCase().trim();
  console.log(`📊 State: ${state.state} | Input: "${transcript}"`);

  if (state.state === STATES.IDENTIFY) {
    // Convert "C zero zero one" → "C001"
    const converted = wordsToDigits(transcript);
    console.log(`🔄 Converted: "${converted}"`);
    const match = converted.match(/[Cc]?(\d{1,3})/);
    if (match) {
      const customerId = match[0];
      console.log(`🔍 Looking up customer: ${customerId}`);
      try {
        const customer = await lookupCustomer(customerId);
        if (customer && customer.found) {
          state.customer = customer;
          state.state = STATES.ORDER;
          const de = customer.language === 'DE';
          return de
            ? `Guten Tag ${customer.customer_name}. Was möchten Sie bestellen?`
            : `Hello ${customer.customer_name}. What would you like to order?`;
        }
      } catch (e) {
        console.error('Lookup error:', e.message);
      }
    }
    return 'I could not find that customer ID. Please say your customer ID again.';
  }

  if (state.state === STATES.ORDER) {
    const qtyMatch = transcript.match(/(\d+)/);
    const qty = qtyMatch ? parseInt(qtyMatch[1]) : 1;
    const { searchProduct } = require('./semanticSearch');
    const item = await searchProduct(transcript);
    if (item && item.found) {
      state.cart = [{ article_number: item.article_number, quantity: qty, item }];
      state.state = STATES.CONFIRM;
      const de = state.customer?.language === 'DE';
      return de
        ? `Ich habe gefunden: ${item.item_title}, Artikel ${item.article_number}, Preis ${item.item_price} Euro. Menge: ${qty}. Soll ich bestellen?`
        : `I found: ${item.item_title}, Article ${item.article_number}, Price $${item.item_price}. Quantity: ${qty}. Shall I place the order?`;
    }
    return state.customer?.language === 'DE'
      ? 'Ich habe das Produkt nicht gefunden. Bitte wiederholen Sie.'
      : 'I could not find that product. Please try again.';
  }

  if (state.state === STATES.CONFIRM) {
    const yes = /yes|ja|correct|richtig|order|bestell|confirm/i.test(text);
    const no  = /no|nein|cancel|abbruch/i.test(text);

    if (yes) {
      try {
        const order = await createOrder(
          state.customer.customer_id,
          state.cart.map(i => ({ article_number: i.article_number, quantity: i.quantity }))
        );
        state.state = STATES.DONE;
        if (order.order_created) {
          return state.customer?.language === 'DE'
            ? `Ihre Bestellung ${order.order_id} wurde aufgegeben. Gesamtpreis: ${order.total_price} Euro. Auf Wiedersehen!`
            : `Your order ${order.order_id} has been placed. Total: $${order.total_price}. Goodbye!`;
        }
      } catch (e) {
        console.error('Order error:', e.message);
      }
      return 'Sorry, there was an error placing your order. Goodbye.';
    }

    if (no) {
      state.state = STATES.ORDER;
      return state.customer?.language === 'DE'
        ? 'Kein Problem. Was möchten Sie stattdessen bestellen?'
        : 'No problem. What would you like to order instead?';
    }

    return state.customer?.language === 'DE'
      ? 'Bitte sagen Sie Ja oder Nein.'
      : 'Please say yes or no.';
  }

  if (state.state === STATES.DONE) {
    return 'Your session has ended. Goodbye.';
  }

  return null;
}

module.exports = { newCallState, updateState };
