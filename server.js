const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const printer = require('node-printer');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Predefined list of printers with their IP addresses
const printerList = [
  {
    id: 1,
    name: 'Cannon Printer',
    ip: '192.168.2.120',
    description: 'Main office printer - Color LaserJet',
    status: 'online'
  },
  {
    id: 2,
    name: 'Reception Printer',
    ip: '192.168.8.23',
    description: 'Reception area - Thermal Receipt Printer',
    status: 'online'
  },
  {
    id: 3,
    name: 'Warehouse Printer',
    ip: '192.168.8.121',
    description: 'Warehouse label printer',
    status: 'offline'
  }
];

// API Endpoints

// Get list of available printers
app.get('/api/printers', (req, res) => {
  // Get system printers and merge with our predefined list
  const systemPrinters = printer.getPrinters();
  
  // Combine system printers with our predefined list
  const allPrinters = printerList.map(predefinedPrinter => {
    const systemPrinter = systemPrinters.find(p => p.name === predefinedPrinter.name);
    return {
      ...predefinedPrinter,
      systemStatus: systemPrinter ? systemPrinter.status : 'Not installed'
    };
  });
  
  res.json(allPrinters);
});

// Print to a specific printer
app.post('/api/print', (req, res) => {
  const { printerId, text } = req.body;
  
  if (!printerId || !text) {
    return res.status(400).json({ error: 'Printer ID and text are required' });
  }
  
  const selectedPrinter = printerList.find(p => p.id === printerId);
  
  if (!selectedPrinter) {
    return res.status(404).json({ error: 'Printer not found' });
  }
  
  try {
    // In a real application, you would implement proper printing logic here
    // This is a simplified example
    
    // Find the printer by name in the system printers
    const systemPrinters = printer.getPrinters();
    const systemPrinter = systemPrinters.find(p => p.name === selectedPrinter.name);
    
    if (!systemPrinter) {
      return res.status(400).json({ error: 'Printer not found in system' });
    }
    
    // Simulate printing (in a real app, you would use proper printing code)
    console.log(`Printing to ${selectedPrinter.name} (${selectedPrinter.ip})`);
    console.log('Content:', text);
    
    // Here you would typically use a package like 'ipp' or other printing solution
    // to actually send the print job to the printer's IP address
    
    res.json({ 
      success: true, 
      message: `Print job sent to ${selectedPrinter.name}`,
      printer: selectedPrinter
    });
    
  } catch (error) {
    console.error('Printing error:', error);
    res.status(500).json({ error: 'Printing failed', details: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Printer backend running on http://localhost:${PORT}`);
});
