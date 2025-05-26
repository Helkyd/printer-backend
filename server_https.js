const express = require('express');
const cors = require('cors');
const fs = require('fs');
const https = require('https');
const http = require('http');
const net = require('net');

const app = express();
const PORT = 3000;

// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      /^https?:\/\/localhost(:\d+)?$/,
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
      /^https?:\/\/(\d+\.){3}\d+(:\d+)?$/,
      /^https:\/\/(.*\.)?yourdomain\.com$/,
    ];
    
    if (!origin || allowedOrigins.some(regex => regex.test(origin))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Printer routes (from previous example)
app.post('/api/print', async (req, res) => {
  // Your printing logic here
});

// Create both HTTP and HTTPS servers
let httpServer, httpsServer;

// HTTP Server (for development)
httpServer = http.createServer(app);
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP Server running at:
  - http://localhost:${PORT}
  - http://${getLocalIpAddress()}:${PORT}`);
});

// HTTPS Server (if certificates exist)
try {
  const httpsOptions = {
    key: fs.readFileSync('./server.key'),
    cert: fs.readFileSync('./server.cert')
  };
  
  httpsServer = https.createServer(httpsOptions, app);
  httpsServer.listen(3443, '0.0.0.0', () => {
    console.log(`HTTPS Server running at:
    - https://localhost:3443
    - https://${getLocalIpAddress()}:3443`);
  });
} catch (err) {
  console.log('HTTPS server not started (missing certificates)');
}

// Get local IP address
function getLocalIpAddress() {
  const interfaces = require('os').networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      if (interface.family === 'IPv4' && !interface.internal) {
        return interface.address;
      }
    }
  }
  return 'localhost';
}
