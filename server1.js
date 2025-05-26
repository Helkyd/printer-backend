const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const net = require('net');
const printer = require('node-printer');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Printer configuration
const printerList = [
  {
    id: 1,
    name: 'PRT-BAR01',
    ip: '192.168.8.100',
    port: 9100,  // Standard port for raw printing
    description: 'PRT-BAR01 - Thermal Receipt Printer',
    status: 'online',
    type: 'laser'
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
    ip: '192.168.1.102',
    port: 9100,
    description: 'PRT-KIT01 - Thermal Receipt Printer',
    status: 'offline',
    type: 'label'
  }
];

// Utility function for direct IP printing
function OLD_printViaIP(printerIP, printerPort, data, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let hasResponded = false;

    client.setTimeout(timeout);

    client.connect(printerPort, printerIP, () => {
      console.log(`Connected to printer at ${printerIP}:${printerPort}`);
      client.write(data, (err) => {
        if (err) {
          if (!hasResponded) {
            hasResponded = true;
            reject(err);
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
      if (!hasResponded) {
        hasResponded = true;
        client.destroy();
        reject(new Error('Connection timeout'));
      }
    });

    client.on('error', (err) => {
      if (!hasResponded) {
        hasResponded = true;
        client.destroy();
        reject(err);
      }
    });

    client.on('close', () => {
      if (!hasResponded) {
        hasResponded = true;
        resolve('Connection closed without response');
      }
    });
  });
}

// Enhanced printViaIP function with debugging
async function printViaIP(printerIP, printerPort, data, timeout = 3000) {
  return new Promise((resolve, reject) => {
    console.log(`Attempting to connect to ${printerIP}:${printerPort}...`);

    const client = new net.Socket();
    let hasResponded = false;

    // Set timeout
    client.setTimeout(timeout);

    // Connection established
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

    // Handle printer response
    client.on('data', (data) => {
      console.log('Printer response:', data.toString());
      if (!hasResponded) {
        hasResponded = true;
        client.destroy();
        resolve(data.toString());
      }
    });

    // Handle timeout
    client.on('timeout', () => {
      console.error(`Connection timeout after ${timeout}ms`);
      if (!hasResponded) {
        hasResponded = true;
        client.destroy();
        reject(new Error(`Connection timeout after ${timeout}ms`));
      }
    });

    // Handle connection errors
    client.on('error', (err) => {
      console.error('Connection error:', err);
      if (!hasResponded) {
        hasResponded = true;
        client.destroy();
        reject(err);
      }
    });

    // Handle connection close
    client.on('close', (hadError) => {
      console.log(`Connection closed ${hadError ? 'with error' : 'cleanly'}`);
      if (!hasResponded && !hadError) {
        hasResponded = true;
        resolve('Connection closed without error');
      }
    });
  });
}

// Generate printer-specific commands based on printer type
function generatePrinterCommands(text, printerType) {
  let commands = '';

  // Common ESC/POS commands (for thermal printers)
  const ESC = '\x1B';
  const INIT = ESC + '@';
  const CENTER = ESC + 'a' + '\x01';
  const CUT = ESC + 'i';

  // Add printer-specific commands
  switch(printerType) {
    case 'thermal':
      commands += INIT; // Initialize printer
      commands += CENTER; // Center align
      commands += text;
      commands += '\n\n\n'; // Add some blank lines
      commands += CUT; // Partial cut
      break;

    case 'label':
      // Example Zebra ZPL commands (simplified)
      commands += `^XA^FO50,50^A0N,50,50^FD${text}^FS^XZ`;
      break;

    case 'laser':
    default:
      // Plain text for laser printers
      commands = text;
      break;
  }

  return commands;
}

// API Endpoints

// Get list of available printers
app.get('/api/printers', (req, res) => {
  res.json(printerList.map(printer => ({
    id: printer.id,
    name: printer.name,
    ip: printer.ip,
    description: printer.description,
    status: printer.status,
    type: printer.type
  })));
});

// Check printer connection status
app.get('/api/printers/:id/status', async (req, res) => {
  const printerId = parseInt(req.params.id);
  const printer = printerList.find(p => p.id === printerId);

  if (!printer) {
    return res.status(404).json({ error: 'Printer not found' });
  }

  try {
    // Try to connect to the printer to check status
    const testConnection = await printViaIP(printer.ip, printer.port, '\x1B\x76\x30', 2000);
    res.json({
      status: 'online',
      message: 'Printer is online and responsive'
    });
  } catch (error) {
    res.json({
      status: 'offline',
      message: 'Could not connect to printer',
      error: error.message
    });
  }
});

// Print to a specific printer via direct IP
app.post('/api/print', async (req, res) => {
  const { printerId, text } = req.body;

  if (!printerId || !text) {
    return res.status(400).json({ error: 'Printer ID and text are required' });
  }

  const selectedPrinter = printerList.find(p => p.id === printerId);

  if (!selectedPrinter) {
    return res.status(404).json({ error: 'Printer not found' });
  }

  try {
    // Generate appropriate printer commands
    const printData = generatePrinterCommands(text, selectedPrinter.type);

    // Send to printer via direct IP
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
    console.error('Printing error:', error);
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

// Add this test endpoint to your server
app.get('/api/test-printer/:id', async (req, res) => {
  const printerId = parseInt(req.params.id);
  const printer = printerList.find(p => p.id === printerId);

  if (!printer) {
    return res.status(404).json({ error: 'Printer not found' });
  }

  try {
    // Test with a simple printer initialization command
    const testCommand = '\x1B\x40'; // ESC @ - Initialize printer
    const result = await printViaIP(printer.ip, printer.port, testCommand);

    res.json({
      success: true,
      message: `Successfully connected to ${printer.name}`,
      printer: printer,
      response: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to connect to ${printer.name}`,
      printer: printer,
      error: error.message
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Printer backend running on http://localhost:${PORT}`);
  console.log('Available printer endpoints:');
  console.log(`- GET http://localhost:${PORT}/api/printers`);
  console.log(`- POST http://localhost:${PORT}/api/print`);
});
