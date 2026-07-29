const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const TRANSFER_NUMBERS_FILE = path.join(DATA_DIR, 'transfer_numbers.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial seed data if files don't exist
if (!fs.existsSync(BOOKINGS_FILE)) {
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify([
    {
      id: "b1",
      shieldName: "أحمد محمد علي",
      sashName: "أحمد علي",
      tagName: "أحمد",
      department: "هندسة حاسبات",
      companions: 3,
      transferNumber: "01099887766",
      transferType: "فودافون كاش",
      paymentStatus: "كامل",
      notes: "طلب تسليم وشاح إضافي",
      createdAt: new Date().toISOString()
    },
    {
      id: "b2",
      shieldName: "سارة محمود حسن",
      sashName: "سارة محمود",
      tagName: "سارة",
      department: "طب بشري",
      companions: 5,
      transferNumber: "instapay@harka",
      transferType: "انستاباي",
      paymentStatus: "كامل",
      notes: "حجز عائلي مميز",
      createdAt: new Date().toISOString()
    },
    {
      id: "b3",
      shieldName: "عمر خالد فؤاد",
      sashName: "عمر خالد",
      tagName: "عمر",
      department: "هندسة حاسبات",
      companions: 1,
      transferNumber: "01099887766",
      transferType: "فودافون كاش",
      paymentStatus: "ناقص",
      notes: "متبقي 200 جنيه",
      createdAt: new Date().toISOString()
    }
  ], null, 2));
}

if (!fs.existsSync(TRANSFER_NUMBERS_FILE)) {
  fs.writeFileSync(TRANSFER_NUMBERS_FILE, JSON.stringify([
    { id: "tn1", number: "01099887766", name: "محمود - فودافون كاش الرئيسي", type: "فودافون كاش" },
    { id: "tn2", number: "instapay@harka", name: "حساب انستاباي الشركة", type: "انستاباي" },
    { id: "tn3", number: "01122334455", name: "حساب الاحتياطي 2", type: "فودافون كاش" }
  ], null, 2));
}

// Helpers
function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // OPTIONS for CORS
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // API ROUTES
  if (pathname.startsWith('/api/')) {
    // GET /api/bookings
    if (pathname === '/api/bookings' && method === 'GET') {
      return sendJSON(res, { success: true, data: readJSON(BOOKINGS_FILE) });
    }

    // POST /api/bookings
    if (pathname === '/api/bookings' && method === 'POST') {
      const body = await parseBody(req);
      const bookings = readJSON(BOOKINGS_FILE);
      const newBooking = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
        createdAt: new Date().toISOString(),
        ...body
      };
      bookings.unshift(newBooking);
      writeJSON(BOOKINGS_FILE, bookings);
      return sendJSON(res, { success: true, data: newBooking }, 201);
    }

    // PUT /api/bookings/:id
    if (pathname.startsWith('/api/bookings/') && method === 'PUT') {
      const id = pathname.split('/')[3];
      const body = await parseBody(req);
      const bookings = readJSON(BOOKINGS_FILE);
      const idx = bookings.findIndex(b => b.id === id);
      if (idx === -1) return sendJSON(res, { success: false, message: 'الحجز غير موجود' }, 404);
      bookings[idx] = { ...bookings[idx], ...body };
      writeJSON(BOOKINGS_FILE, bookings);
      return sendJSON(res, { success: true, data: bookings[idx] });
    }

    // DELETE /api/bookings/:id
    if (pathname.startsWith('/api/bookings/') && method === 'DELETE') {
      const id = pathname.split('/')[3];
      let bookings = readJSON(BOOKINGS_FILE);
      bookings = bookings.filter(b => b.id !== id);
      writeJSON(BOOKINGS_FILE, bookings);
      return sendJSON(res, { success: true, message: 'تم حذف الحجز' });
    }

    // GET /api/transfer-numbers
    if (pathname === '/api/transfer-numbers' && method === 'GET') {
      return sendJSON(res, { success: true, data: readJSON(TRANSFER_NUMBERS_FILE) });
    }

    // POST /api/transfer-numbers
    if (pathname === '/api/transfer-numbers' && method === 'POST') {
      const { number, name, type } = await parseBody(req);
      const numbers = readJSON(TRANSFER_NUMBERS_FILE);
      const newNum = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
        number: (number || '').trim(),
        name: (name || '').trim(),
        type: type || 'فودافون كاش'
      };
      numbers.unshift(newNum);
      writeJSON(TRANSFER_NUMBERS_FILE, numbers);
      return sendJSON(res, { success: true, data: newNum }, 201);
    }

    // DELETE /api/transfer-numbers/:id
    if (pathname.startsWith('/api/transfer-numbers/') && method === 'DELETE') {
      const id = pathname.split('/')[3];
      let numbers = readJSON(TRANSFER_NUMBERS_FILE);
      numbers = numbers.filter(n => n.id !== id);
      writeJSON(TRANSFER_NUMBERS_FILE, numbers);
      return sendJSON(res, { success: true, message: 'تم حذف الرقم' });
    }

    // GET /api/dashboard/stats
    if (pathname === '/api/dashboard/stats' && method === 'GET') {
      const bookings = readJSON(BOOKINGS_FILE);
      const numbers = readJSON(TRANSFER_NUMBERS_FILE);
      return sendJSON(res, {
        success: true,
        data: {
          totalBookings: bookings.length,
          totalCompanions: bookings.reduce((sum, b) => sum + (parseInt(b.companions) || 0), 0),
          transferNumbersCount: numbers.length
        }
      });
    }

    return sendJSON(res, { success: false, message: 'API Route Not Found' }, 404);
  }

  // STATIC FILE SERVING
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();

  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>404 Not Found</h1>');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(` Server is running on http://localhost:${PORT}`);
});
