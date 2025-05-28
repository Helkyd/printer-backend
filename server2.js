//Created by Helkyd with the help of Deepseek
//Last Modified: 26-05-2025

// npm install express body-parser cors net node-printer https http fs os html-to-text
// npm install html-to-text puppeteer

//process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const net = require('net');
const printer = require('node-printer');
const https = require('https');
const http = require('http');
const fs = require('fs');
const os = require('os');

const { convert } = require('html-to-text');
//const puppeteer = require('puppeteer');

const app = express();
const HTTP_PORT = 3000;
const HTTPS_PORT = 3443;

// Add this right after creating your Express app
app.use(bodyParser.json()); // For parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // For parsing form data

// Simplified and safer CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Simplified origin checking
    const allowedOrigins = [
      'localhost',
      '127.0.0.1',
      '192.168.', // Allow all local network IPs
      '.angolaerp.co.ao', // Your production domain
      '.metagest.ao'
    ];

    const originHostname = new URL(origin).hostname;

    if (
      allowedOrigins.some(allowed =>
        originHostname.includes(allowed) ||
        originHostname.endsWith(allowed)
      )
    ) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Safer preflight handling
app.options(/^\/api\/.*/, cors(corsOptions)); // Only for API routes

// Printer configuration
const printerList = [
  {
    id: 1,
    name: 'PRT-BAR01',
    ip: '192.168.8.23',
    port: 9100,
    description: 'PRT-BAR01 - Thermal Receipt Printer',
    status: 'online',
    type: 'thermal'
  },
  {
    id: 2,
    name: 'PRT-BAR02',
    ip: '192.168.8.23',
    port: 9100,
    description: 'PRT-BAR02 - Thermal Receipt Printer',
    status: 'online',
    type: 'thermal'
  },
  {
    id: 3,
    name: 'PRT-KIT01',
    ip: '192.168.8.23',
    port: 9100,
    description: 'PRT-KIT01 - Thermal Receipt Printer',
    status: 'online',
    type: 'thermal'
  }
];

// Enhanced printViaIP function with debugging
async function printViaIP(printerIP, printerPort, data, timeout = 3000) {
  return new Promise((resolve, reject) => {
    console.log(`Attempting to connect to ${printerIP}:${printerPort}...`);

    const client = new net.Socket();
    let hasResponded = false;

    client.setTimeout(timeout);

    client.connect(printerPort, printerIP, () => {
      console.log(`Successfully connected to ${printerIP}:${printerPort}`);

      client.write(data, (err) => {
        if (err) {
          if (!hasResponded) {
            console.error('Write error:', err);
            hasResponded = true;
            client.destroy();
            reject(err);
          }
        } else {
          console.log('Data sent successfully');
          // Some printers won't respond, so we consider this a success
          if (!hasResponded) {
            hasResponded = true;
            client.destroy();
            resolve('Data sent - no printer response');
          }
        }
      });
    });

    client.on('data', (data) => {
      console.log('Printer response:', data.toString());
      if (!hasResponded) {
        hasResponded = true;
        client.destroy();
        resolve(data.toString());
      }
    });

    client.on('timeout', () => {
      console.error(`Connection timeout after ${timeout}ms`);
      if (!hasResponded) {
        hasResponded = true;
        client.destroy();
        reject(new Error(`Connection timeout after ${timeout}ms`));
      }
    });

    client.on('error', (err) => {
      console.error('Connection error:', err);
      if (!hasResponded) {
        hasResponded = true;
        client.destroy();
        reject(err);
      }
    });

    client.on('close', (hadError) => {
      console.log(`Connection closed ${hadError ? 'with error' : 'cleanly'}`);
      if (!hasResponded && !hadError) {
        hasResponded = true;
        resolve('Connection closed without error');
      }
    });
  });
}

// Generate printer-specific commands
function OLD_generatePrinterCommands(text, printerType) {
  let commands = '';

  const ESC = '\x1B';
  const INIT = ESC + '@';
  const CENTER = ESC + 'a' + '\x01';
  const CUT = ESC + 'i';

  switch(printerType) {
    case 'thermal':
      commands += INIT + CENTER + text + '\n\n\n' + CUT;
      break;
    case 'label':
      commands += `^XA^FO50,50^A0N,50,50^FD${text}^FS^XZ`;
      break;
    default:
      commands = text;
  }

  return commands;
}

function OLDD_generatePrinterCommands(content, printerType) {
  let commands = '';
  const ESC = '\x1B';

  switch(printerType) {
    case 'thermal':
      commands = ESC + '@' +      // Initialize printer
                ESC + 'a' + '\x01' +  // Center alignment
                content +
                '\n\n\n' + ESC + 'i';  // Cut paper
      break;

    case 'label':
      // Simple ZPL implementation for labels
      commands = `^XA^FO50,50^A0N,50,50^FD${content}^FS^XZ`;
      break;

    default:  // For laser printers
      commands = content;
  }

  return commands;
}

function generatePrinterCommands(content, printerType) {
  // Thermal printers need ESC/POS commands
  if (printerType === 'thermal') {
    const ESC = '\x1B';
    return [
      ESC + '@',           // Initialize
      ESC + 'a' + '\x01',  // Center align
      content,
      '\n\n\n' + ESC + 'd' + '\x03',  // Feed 3 lines
      ESC + 'i'            // Cut paper
    ].join('');
  }

  // Direct text for other types
  return content;
}

// API Endpoints
app.get('/api/printers', (req, res) => {
  res.json(printerList.map(p => ({
    id: p.id,
    name: p.name,
    ip: p.ip,
    description: p.description,
    status: p.status,
    type: p.type
  })));
});

app.get('/api/printers/:id/status', async (req, res) => {
  const printerId = parseInt(req.params.id);
  const printer = printerList.find(p => p.id === printerId);

  if (!printer) {
    return res.status(404).json({ error: 'Printer not found' });
  }

  try {
    await printViaIP(printer.ip, printer.port, '\x1B\x40', 2000);
    res.json({ status: 'online', message: 'Printer is responsive' });
  } catch (error) {
    res.json({ status: 'offline', message: error.message });
  }
});

app.post('/api/prints_old', async (req, res) => {
  console.log ('REEEEEEEQQQQ ', req.body)
  const { printerId, text } = req.body;

  if (!printerId || !text) {
    return res.status(400).json({ error: 'Printer ID and text are required' });
  }

  const selectedPrinter = printerList.find(p => p.id === printerId);
  if (!selectedPrinter) {
    return res.status(404).json({ error: 'Printer not found' });
  }

  try {
    const printData = generatePrinterCommands(text, selectedPrinter.type);
    const result = await printViaIP(selectedPrinter.ip, selectedPrinter.port, printData);

    res.json({
      success: true,
      message: `Print job sent to ${selectedPrinter.name}`,
      printer: {
        id: selectedPrinter.id,
        name: selectedPrinter.name,
        ip: selectedPrinter.ip
      },
      response: result
    });
  } catch (error) {
    res.status(500).json({
      error: 'Printing failed',
      details: error.message,
      printer: {
        id: selectedPrinter.id,
        name: selectedPrinter.name,
        ip: selectedPrinter.ip
      }
    });
  }
});

app.post('/api/prints', async (req, res) => {
  const { printerId, text, contentType } = req.body;

  if (!printerId || !text) {
    return res.status(400).json({ error: 'Printer ID and text are required' });
  }

  const selectedPrinter = printerList.find(p => p.id === printerId);
  if (!selectedPrinter) {
    return res.status(404).json({ error: 'Printer not found' });
  }

  try {
    let printData;

    // Handle different content types
    if (contentType === 'escpos') {
      // Decode base64 ESC/POS data
      printData = Buffer.from(text, 'base64');
    } else {
      // Default text processing
      printData = generatePrinterCommands(text, selectedPrinter.type);
    }

    const result = await printViaIP(selectedPrinter.ip, selectedPrinter.port, printData);

    res.json({
      success: true,
      message: `Print job sent to ${selectedPrinter.name}`,
      printer: {
        id: selectedPrinter.id,
        name: selectedPrinter.name,
        ip: selectedPrinter.ip
      },
      response: result
    });
  } catch (error) {
    res.status(500).json({
      error: 'Printing failed',
      details: error.message,
      printer: {
        id: selectedPrinter.id,
        name: selectedPrinter.name,
        ip: selectedPrinter.ip
      }
    });
  }
});


// Updated print endpoint
app.post('/api/print', async (req, res) => {
  const { printerId, html, text } = req.body;

  if (!printerId) {
    return res.status(400).json({ error: 'Printer ID is required' });
  }

  const selectedPrinter = printerList.find(p => p.id === printerId);
  if (!selectedPrinter) {
    return res.status(404).json({ error: 'Printer not found' });
  }

  try {
    let printContent;

    if (html) {
      // METHOD 1: Simple HTML to text conversion (best for thermal printers)
      printContent = convert(html, {
        wordwrap: 40,  // Match thermal printer width
        preserveNewlines: true,
        uppercaseHeadings: false,
        hideLinkHrefIfSameAsText: true
      });

      // METHOD 2: PDF Generation (for laser printers)
      /*
      if (selectedPrinter.type === 'laser') {
        const browser = await puppeteer.launch({
          headless: 'new',
          args: ['--no-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true
        });
        await browser.close();

        // For PDF-compatible printers
        return await printViaIP(
          selectedPrinter.ip,
          selectedPrinter.port,
          pdfBuffer
        );
      }
      */
    } else {
      printContent = text;
    }

    // Generate proper printer commands
    const printData = generatePrinterCommands(
      printContent,
      selectedPrinter.type
    );

    const result = await printViaIP(
      selectedPrinter.ip,
      selectedPrinter.port,
      printData
    );

    res.json({ success: true, message: 'Print successful' });

  } catch (error) {
    res.status(500).json({
      error: 'Printing failed',
      details: error.message
    });
  }
});

app.post('/api/print-raw', async (req, res) => {
  const printerId = req.headers['x-printer-id'];

  if (!printerId) {
    return res.status(400).json({ error: 'Printer ID header is required' });
  }

  const selectedPrinter = printerList.find(p => p.id === parseInt(printerId));
  if (!selectedPrinter) {
    return res.status(404).json({ error: 'Printer not found' });
  }

  try {
    // Get raw binary data
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const printData = Buffer.concat(chunks);

    const result = await printViaIP(selectedPrinter.ip, selectedPrinter.port, printData);

    res.json({
      success: true,
      message: `Print job sent to ${selectedPrinter.name}`,
      printer: {
        id: selectedPrinter.id,
        name: selectedPrinter.name
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Printing failed',
      details: error.message
    });
  }
});

// Get local IP addresses
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// Create HTTP server
const httpServer = http.createServer(app);
httpServer.listen(HTTP_PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  console.log(`HTTP Server running on:`);
  console.log(`- http://localhost:${HTTP_PORT}`);
  ips.forEach(ip => console.log(`- http://${ip}:${HTTP_PORT}`));
});

// Create HTTPS server if certificates exist
try {
  const httpsOptions = {
    key: fs.readFileSync('privkey.pem'),
    cert: fs.readFileSync('cert.pem')
  };

  const httpsServer = https.createServer(httpsOptions, app);
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    const ips = getLocalIPs();
    console.log(`HTTPS Server running on:`);
    console.log(`- https://localhost:${HTTPS_PORT}`);
    ips.forEach(ip => console.log(`- https://${ip}:${HTTPS_PORT}`));
    console.log('Note: You may need to accept self-signed certificate warnings');
  });
} catch (err) {
  console.log('HTTPS server not started (missing certificates)');
  console.log('To create self-signed certificates, run:');
  console.log('openssl req -nodes -new -x509 -keyout server.key -out server.cert');
}
