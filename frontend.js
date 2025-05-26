// Get printer list
fetch('http://localhost:3000/api/printers')
  .then(response => response.json())
  .then(printers => {
    console.log('Available printers:', printers);
    // Display printers in your UI
  });

// Send print job
const printData = {
  printerId: 2, // ID of the selected printer
  text: 'This is a test print job\nSecond line of text'
};

fetch('http://localhost:3000/api/print', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(printData),
})
.then(response => response.json())
.then(data => console.log('Print response:', data));
