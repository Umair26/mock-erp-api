const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────
const API_TOKEN = process.env.API_TOKEN || "erp-secret-token-2024-umair";

function authenticate(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7) : null;
  if (!token)
    return res.status(401).json({ error: "Unauthorized. Provide: Authorization: Bearer <token>" });
  if (token !== API_TOKEN)
    return res.status(403).json({ error: "Forbidden. Invalid API token." });
  next();
}

// ─────────────────────────────────────────────
// DATABASE
// ─────────────────────────────────────────────
const customers = [
  { customer_id: "C001", customer_name: "Max Mustermann",  customer_email: "max.mustermann@email.de",  article_numbers: ["A001","A003","A007"], language: "DE", order_ids: ["ORD-001","ORD-002"] },
  { customer_id: "C002", customer_name: "Anna Schmidt",    customer_email: "anna.schmidt@email.de",    article_numbers: ["A002","A005"],         language: "DE", order_ids: ["ORD-003"] },
  { customer_id: "C003", customer_name: "Peter Müller",    customer_email: "peter.mueller@email.de",   article_numbers: ["A001","A010"],         language: "DE", order_ids: ["ORD-004"] },
  { customer_id: "C004", customer_name: "Laura Fischer",   customer_email: "laura.fischer@email.de",   article_numbers: ["A004","A006","A009"],  language: "DE", order_ids: [] },
  { customer_id: "C005", customer_name: "John Smith",      customer_email: "john.smith@email.com",     article_numbers: ["A002","A008"],         language: "EN", order_ids: [] },
  { customer_id: "C006", customer_name: "Sarah Johnson",   customer_email: "sarah.j@email.com",        article_numbers: ["A011","A013"],         language: "EN", order_ids: [] },
  { customer_id: "C007", customer_name: "Michael Brown",   customer_email: "m.brown@email.com",        article_numbers: ["A003","A012"],         language: "EN", order_ids: [] },
  { customer_id: "C008", customer_name: "Emily Davis",     customer_email: "emily.d@email.com",        article_numbers: ["A014","A015"],         language: "EN", order_ids: [] },
  { customer_id: "C009", customer_name: "Hans Weber",      customer_email: "hans.weber@email.de",      article_numbers: ["A001","A016"],         language: "DE", order_ids: [] },
  { customer_id: "C010", customer_name: "Klaus Becker",    customer_email: "k.becker@email.de",        article_numbers: ["A017","A018"],         language: "DE", order_ids: [] },
  { customer_id: "C011", customer_name: "Sophie Martin",   customer_email: "sophie.m@email.com",       article_numbers: ["A005","A019"],         language: "EN", order_ids: [] },
  { customer_id: "C012", customer_name: "Thomas Schulz",   customer_email: "t.schulz@email.de",        article_numbers: ["A002","A020"],         language: "DE", order_ids: [] },
  { customer_id: "C013", customer_name: "Julia Wagner",    customer_email: "julia.w@email.de",         article_numbers: ["A021"],                language: "DE", order_ids: [] },
  { customer_id: "C014", customer_name: "David Wilson",    customer_email: "d.wilson@email.com",       article_numbers: ["A007","A008"],         language: "EN", order_ids: [] },
  { customer_id: "C015", customer_name: "Maria Garcia",    customer_email: "m.garcia@email.com",       article_numbers: ["A009","A010"],         language: "EN", order_ids: [] },
  { customer_id: "C016", customer_name: "Franz Hoffmann",  customer_email: "f.hoffmann@email.de",      article_numbers: ["A011","A012"],         language: "DE", order_ids: [] },
  { customer_id: "C017", customer_name: "Lisa Schneider",  customer_email: "l.schneider@email.de",     article_numbers: ["A013","A014"],         language: "DE", order_ids: [] },
  { customer_id: "C018", customer_name: "James Anderson",  customer_email: "j.anderson@email.com",     article_numbers: ["A015","A016"],         language: "EN", order_ids: [] },
  { customer_id: "C019", customer_name: "Emma Thompson",   customer_email: "e.thompson@email.com",     article_numbers: ["A017","A018"],         language: "EN", order_ids: [] },
];

const items = [
  { article_number: "A001", item_title: "Industrial Pressure Valve 12mm",    item_title_DE: "Industriedruckventil 12mm",          availability_status: "Available",    item_price: 45.99  },
  { article_number: "A002", item_title: "Steel Pipe Connector 1 inch",       item_title_DE: "Stahlrohrverbinder 1 Zoll",          availability_status: "Available",    item_price: 12.50  },
  { article_number: "A003", item_title: "Heavy Duty Bolt Set M10 (50 pcs)",  item_title_DE: "Schwerlastschraubenset M10",         availability_status: "Available",    item_price: 28.00  },
  { article_number: "A004", item_title: "Rubber Seal Ring 15mm",             item_title_DE: "Gummidichtungsring 15mm",            availability_status: "Out of stock", item_price: 3.75   },
  { article_number: "A005", item_title: "Hydraulic Pump Filter",             item_title_DE: "Hydraulikpumpenfilter",              availability_status: "Available",    item_price: 89.00  },
  { article_number: "A006", item_title: "Aluminum Bracket 200x50mm",        item_title_DE: "Aluminiumhalterung 200x50mm",        availability_status: "Available",    item_price: 19.99  },
  { article_number: "A007", item_title: "Electric Motor 0.5kW 230V",        item_title_DE: "Elektromotor 0,5kW 230V",            availability_status: "Available",    item_price: 235.00 },
  { article_number: "A008", item_title: "Control Panel Switch 16A",         item_title_DE: "Schalttafelschalter 16A",            availability_status: "Out of stock", item_price: 15.20  },
  { article_number: "A009", item_title: "Conveyor Belt Segment 500mm",      item_title_DE: "Förderbandsegment 500mm",            availability_status: "Available",    item_price: 67.50  },
  { article_number: "A010", item_title: "Gear Box Lubricant 5L",            item_title_DE: "Getriebeöl 5L",                     availability_status: "Available",    item_price: 34.00  },
  { article_number: "A011", item_title: "Safety Pressure Relief Valve",     item_title_DE: "Sicherheitsdruckentlastungsventil",  availability_status: "Available",    item_price: 112.00 },
  { article_number: "A012", item_title: "Stainless Steel Flange DN50",      item_title_DE: "Edelstahlflansch DN50",              availability_status: "Available",    item_price: 55.80  },
  { article_number: "A013", item_title: "Digital Flow Meter",               item_title_DE: "Digitaler Durchflussmesser",         availability_status: "Out of stock", item_price: 189.99 },
  { article_number: "A014", item_title: "Insulation Mat 1m x 2m",          item_title_DE: "Isoliermatte 1m x 2m",              availability_status: "Available",    item_price: 22.40  },
  { article_number: "A015", item_title: "Cable Conduit 25mm 10m Roll",      item_title_DE: "Kabelrohr 25mm 10m Rolle",          availability_status: "Available",    item_price: 18.60  },
  { article_number: "A016", item_title: "Terminal Block 12-way",            item_title_DE: "Klemmleiste 12-polig",               availability_status: "Available",    item_price: 9.90   },
  { article_number: "A017", item_title: "Pneumatic Cylinder 80mm Stroke",   item_title_DE: "Pneumatikzylinder 80mm Hub",         availability_status: "Available",    item_price: 148.00 },
  { article_number: "A018", item_title: "Air Filter Regulator 1/4 inch",    item_title_DE: "Luftfilterregler 1/4 Zoll",         availability_status: "Out of stock", item_price: 42.30  },
  { article_number: "A019", item_title: "Proximity Sensor NPN 10-30V",      item_title_DE: "Näherungssensor NPN 10-30V",         availability_status: "Available",    item_price: 31.00  },
  { article_number: "A020", item_title: "PLC Communication Module",         item_title_DE: "SPS-Kommunikationsmodul",            availability_status: "Available",    item_price: 310.00 },
  { article_number: "A021", item_title: "Vibration Damper Pad Set (4 pcs)", item_title_DE: "Schwingungsdämpferpad-Set",          availability_status: "Available",    item_price: 14.80  },
];

const orders = [
  { order_id: "ORD-001", order_status: "Confirmed", total_price: 319.97, created_via: "AI",         order_date: "2024-01-15", customer_id: "C001", order_summary: "1x A001, 2x A003, 1x A007. Dispatched." },
  { order_id: "ORD-002", order_status: "Pending",   total_price: 45.99,  created_via: "AI",         order_date: "2024-01-22", customer_id: "C001", order_summary: "1x A001. Awaiting confirmation." },
  { order_id: "ORD-003", order_status: "Confirmed", total_price: 101.50, created_via: "Website",    order_date: "2024-01-18", customer_id: "C002", order_summary: "1x A005, 2x A002. In transit." },
  { order_id: "ORD-004", order_status: "Cancelled", total_price: 0.00,   created_via: "Mobile App", order_date: "2024-01-20", customer_id: "C003", order_summary: "Cancelled before processing." },
];

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function generateOrderId() {
  return "ORD-" + Date.now();
}

// Normalize customer ID — accepts "1", "01", "001", "C001" → always "C001"
function normalizeCustomerId(id) {
  if (!id) return null;
  id = String(id).trim();
  if (id.toLowerCase() === "null" || id.toLowerCase() === "undefined") return null;
  if (!id.toUpperCase().startsWith("C")) id = "C" + id;
  // Zero-pad to C + 3 digits: C1 → C001, C01 → C001
  const prefix = id.slice(0, 1).toUpperCase(); // "C"
  const digits = id.slice(1).replace(/\D/g, '');
  return prefix + digits.padStart(3, '0');
}

// Normalize article number — accepts "1", "01", "001", "A001" → always "A001"
function normalizeArticleNumber(num) {
  if (!num) return null;
  num = String(num).trim();
  if (!num.toUpperCase().startsWith("A")) num = "A" + num;
  const prefix = num.slice(0, 1).toUpperCase();
  const digits = num.slice(1).replace(/\D/g, '');
  return prefix + digits.padStart(3, '0');
}

// Find customer by ID or email — used by all lookup routes
function findCustomer(customer_id, customer_email) {
  // Email takes priority
  if (customer_email && customer_email.includes("@")) {
    return customers.find(c =>
      c.customer_email.toLowerCase() === customer_email.trim().toLowerCase()
    );
  }
  // ID lookup with normalization
  const normalized = normalizeCustomerId(customer_id);
  if (!normalized) return null;
  return customers.find(c => c.customer_id === normalized);
}

// Build clean customer response — only essential fields, no bloat
function buildCustomerResponse(customer) {
  return {
    found: true,
    customer_id:    customer.customer_id,
    customer_name:  customer.customer_name,
    customer_email: customer.customer_email,
    language:       customer.language,
  };
}

// ─────────────────────────────────────────────
// HOMEPAGE
// ─────────────────────────────────────────────
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'database_visual.html'));
});

app.get("/status", (req, res) => {
  res.json({
    status: "Mock ERP API is running!",
    version: "3.0.0",
    tables: { customers: customers.length, items: items.length, orders: orders.length },
  });
});

// ─────────────────────────────────────────────
// ── ROUTE 1: LOOKUP CUSTOMER
//    Works for Voiceflow (POST body) AND
//    Retell AI (GET query params)
//
//    GET  /api/customer?customer_id=C001
//    GET  /api/customer?customer_email=max@email.de
//    POST /api/customer  { customer_id, customer_email }
// ─────────────────────────────────────────────
app.get("/api/customer", authenticate, (req, res) => {
  const { customer_id, customer_email } = req.query;
  console.log(`🔍 GET /api/customer | id=${customer_id} | email=${customer_email}`);

  const customer = findCustomer(customer_id, customer_email);

  if (!customer) {
    return res.status(404).json({ found: false, error: "Customer not found." });
  }

  console.log(`✅ Found: ${customer.customer_name}`);
  return res.json(buildCustomerResponse(customer));
});

app.post("/api/customer", authenticate, (req, res) => {
  const { customer_id, customer_email } = req.body;
  console.log(`🔍 POST /api/customer | id=${customer_id} | email=${customer_email}`);

  const customer = findCustomer(customer_id, customer_email);

  if (!customer) {
    return res.status(404).json({ found: false, error: "Customer not found." });
  }

  console.log(`✅ Found: ${customer.customer_name}`);
  return res.json(buildCustomerResponse(customer));
});

// ─────────────────────────────────────────────
// ── ROUTE 2: LOOKUP ITEM
//    By article number OR by name search
//
//    GET  /api/item?article_number=A001
//    GET  /api/item?article_number=001
//    GET  /api/item?search=hydraulic pump&language=EN
//    POST /api/item  { article_number } or { search, language }
// ─────────────────────────────────────────────
function findItemByNumber(article_number) {
  const normalized = normalizeArticleNumber(article_number);
  if (!normalized) return null;
  return items.find(i => i.article_number === normalized) || null;
}

function findItemByName(search, language = "EN") {
  if (!search) return null;

  const titleField = language === "DE" ? "item_title_DE" : "item_title";

  // Strip filler words
  const fillerWords = new Set([
    'i','want','need','order','would','like','give','me','for','a','an','the','to',
    'please','yes','add','item','number','article','find','get','show','check',
    'ich','möchte','moechte','brauche','bitte','haben','gerne','das','die','der','ein'
  ]);

  const cleanSearch = String(search).toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 1 && !fillerWords.has(w))
    .join(' ').trim();

  if (!cleanSearch) return null;

  const searchWords = cleanSearch.split(' ').filter(w => w.length > 1);
  let bestMatch = null;
  let bestScore = 0;

  for (const item of items) {
    const title = (item[titleField] || '').toLowerCase();
    let score = 0;
    let matchedWords = 0;

    for (const word of searchWords) {
      if (title.includes(word)) {
        matchedWords++;
        score += title.split(' ').includes(word) ? 2 : 1;
      }
    }

    if (matchedWords > 0) {
      if (matchedWords === searchWords.length) score += 10;
      score -= (title.split(' ').length - searchWords.length) * 0.5;
      if (score > bestScore) { bestScore = score; bestMatch = item; }
    }
  }

  return bestMatch;
}

function buildItemResponse(item, language = "EN") {
  return {
    found: true,
    article_number:      item.article_number,
    item_title:          language === "DE" ? item.item_title_DE : item.item_title,
    item_title_EN:       item.item_title,
    item_title_DE:       item.item_title_DE,
    availability_status: item.availability_status,
    item_price:          item.item_price,
  };
}

app.get("/api/item", authenticate, (req, res) => {
  const { article_number, search, language = "EN" } = req.query;
  console.log(`🔍 GET /api/item | article=${article_number} | search=${search} | lang=${language}`);

  let item = null;
  if (article_number && article_number !== "null" && article_number !== "undefined") {
    item = findItemByNumber(article_number);
  } else if (search) {
    item = findItemByName(search, language);
  } else {
    return res.status(400).json({ found: false, error: "Provide article_number or search." });
  }

  if (!item) return res.status(404).json({ found: false, error: "Item not found." });
  console.log(`✅ Found: ${item.item_title}`);
  return res.json(buildItemResponse(item, language));
});

app.post("/api/item", authenticate, (req, res) => {
  const { article_number, search, language = "EN" } = req.body;
  console.log(`🔍 POST /api/item | article=${article_number} | search=${search} | lang=${language}`);

  let item = null;
  if (article_number && article_number !== "null" && article_number !== "undefined") {
    item = findItemByNumber(article_number);
  } else if (search) {
    item = findItemByName(search, language);
  } else {
    return res.status(400).json({ found: false, error: "Provide article_number or search." });
  }

  if (!item) return res.status(404).json({ found: false, error: "Item not found." });
  console.log(`✅ Found: ${item.item_title}`);
  return res.json(buildItemResponse(item, language));
});

// ─────────────────────────────────────────────
// ── ROUTE 3: CREATE ORDER
//    Works for Voiceflow (POST body with items array or items_summary string)
//    Works for Retell AI (POST body)
//
//    POST /api/order
//    { customer_id, items_summary, items, created_via }
// ─────────────────────────────────────────────
function parseItemsSummary(summary) {
  const parsedItems = [];
  if (!summary) return parsedItems;
  const parts = String(summary).split(/,|\band\b/i);
  for (const part of parts) {
    const articleMatch = part.match(/\b([Aa]?\d{3})\b/);
    if (articleMatch) {
      let articleNumber = normalizeArticleNumber(articleMatch[1]);
      const quantityMatch = part.match(/(\d+)\s*(?:x|quantity|qty|pieces|pcs|units)?|(?:quantity|qty|x)\s*(\d+)/i);
      let quantity = 1;
      if (quantityMatch) {
        const qty = parseInt(quantityMatch[1] || quantityMatch[2]);
        if (qty && qty !== parseInt(articleNumber.replace("A", ""))) quantity = qty;
      }
      parsedItems.push({ article_number: articleNumber, quantity });
    }
  }
  return parsedItems;
}

app.post("/api/order", authenticate, (req, res) => {
  console.log("\n📦 POST /api/order");
  console.log(JSON.stringify(req.body, null, 2));

  const { customer_id, customer_email, items: requestedItems, items_summary, created_via = "AI" } = req.body;

  // Find customer
  const matchedCustomer = findCustomer(customer_id, customer_email);
  if (!matchedCustomer) {
    return res.status(404).json({
      order_created: false,
      error: "Customer not found."
    });
  }

  // Resolve items — accept structured array OR text summary
  let parsedItems = [];
  if (requestedItems && Array.isArray(requestedItems) && requestedItems.length > 0) {
    parsedItems = requestedItems.map(i => ({
      article_number: normalizeArticleNumber(i.article_number),
      quantity: i.quantity || 1
    }));
  } else if (items_summary) {
    parsedItems = parseItemsSummary(items_summary);
  }

  if (parsedItems.length === 0) {
    return res.status(400).json({ order_created: false, error: "No items provided or could not parse items." });
  }

  // Validate each item
  let totalPrice = 0;
  const itemResults = parsedItems.map(req => {
    const found = items.find(i => i.article_number === req.article_number);
    const inStock = found && found.availability_status === "Available";
    if (found && inStock) totalPrice += found.item_price * req.quantity;
    return {
      article_number:      req.article_number,
      status:              !found ? "not_found" : !inStock ? "out_of_stock" : "confirmed",
      item_title:          found ? found.item_title : null,
      item_price:          found ? found.item_price : null,
      quantity:            req.quantity,
    };
  });

  const confirmedItems = itemResults.filter(i => i.status === "confirmed");
  if (confirmedItems.length === 0) {
    return res.status(200).json({
      order_created: false,
      customer_id:   matchedCustomer.customer_id,
      customer_name: matchedCustomer.customer_name,
      items:         itemResults,
      error:         "No available items to order."
    });
  }

  // Create order
  const newOrderId = generateOrderId();
  const newOrder = {
    order_id:      newOrderId,
    order_status:  "Pending",
    total_price:   Math.round(totalPrice * 100) / 100,
    created_via,
    order_date:    new Date().toISOString().split("T")[0],
    customer_id:   matchedCustomer.customer_id,
    order_summary: `Order for ${matchedCustomer.customer_name}: ${confirmedItems.map(i => `${i.quantity}x ${i.article_number}`).join(", ")}.`,
  };
  orders.push(newOrder);
  console.log(`✅ Order created: ${newOrderId} | $${newOrder.total_price}`);

  return res.status(200).json({
    order_created:  true,
    order_id:       newOrderId,
    order_status:   "Pending",
    customer_id:    matchedCustomer.customer_id,
    customer_name:  matchedCustomer.customer_name,
    total_price:    newOrder.total_price,
    items:          itemResults,
  });
});

// ─────────────────────────────────────────────
// LEGACY ROUTES — kept for Voiceflow backwards compatibility
// ─────────────────────────────────────────────
app.get("/api/customers",           authenticate, (req, res) => res.json({ total: customers.length, customers }));
app.get("/api/items",               authenticate, (req, res) => res.json({ total: items.length, items }));
app.get("/api/orders",              authenticate, (req, res) => res.json({ total: orders.length, orders }));
app.post("/api/create-order",       authenticate, (req, res) => { req.url = '/api/order'; app._router.handle(req, res); });
app.post("/api/customers/lookup",   authenticate, (req, res) => { req.body.customer_id = req.body.customer_id; return res.redirect(307, '/api/customer'); });

// ─────────────────────────────────────────────
// ERROR HANDLER
// ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("💥 Server error:", err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Mock ERP API v3.0 → http://localhost:${PORT}`);
  console.log(`🔑 Token: ${API_TOKEN}`);
  console.log(`📊 Customers: ${customers.length} | Items: ${items.length} | Orders: ${orders.length}`);
  console.log("\n📡 Clean endpoints:");
  console.log("  GET/POST /api/customer  → lookup by ID or email");
  console.log("  GET/POST /api/item      → lookup by article_number or search");
  console.log("  POST     /api/order     → create order\n");
});