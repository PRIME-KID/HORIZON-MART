// Simple payment server for Horizon Mart
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// Mock data for payment intent creation
const createPaymentIntent = (amount, currency) => {
  // Validate input
  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    throw new Error('Invalid amount. Please provide a positive number.');
  }
  
  if (!currency || typeof currency !== 'string' || !['usd', 'eur', 'gbp'].includes(currency.toLowerCase())) {
    throw new Error('Invalid currency. Supported currencies are USD, EUR, and GBP.');
  }
  
  // Generate mock payment intent data
  const paymentIntentId = 'pi_' + Math.random().toString(36).substring(2, 15);
  const clientSecret = paymentIntentId + '_secret_' + Math.random().toString(36).substring(2, 15);
  
  return {
    id: paymentIntentId,
    object: 'payment_intent',
    amount: Math.round(parseFloat(amount) * 100), // Convert to cents
    currency: currency.toLowerCase(),
    status: 'requires_payment_method',
    client_secret: clientSecret,
    created: Date.now(),
    livemode: false
  };
};

// Mock data for payment confirmation
const confirmPayment = (paymentIntentId) => {
  // Validate input
  if (!paymentIntentId || typeof paymentIntentId !== 'string' || !paymentIntentId.startsWith('pi_')) {
    throw new Error('Invalid payment intent ID. Please provide a valid ID.');
  }
  
  // Generate mock confirmation data
  return {
    success: true,
    status: 'succeeded',
    id: paymentIntentId,
    amount_received: Math.floor(Math.random() * 10000) / 100, // Random amount between 0 and 100
    currency: 'usd',
    payment_method: 'card_' + Math.random().toString(36).substring(2, 10),
    payment_method_details: {
      type: 'card',
      card: {
        brand: ['visa', 'mastercard', 'amex'][Math.floor(Math.random() * 3)],
        last4: Math.floor(1000 + Math.random() * 9000).toString().substring(0, 4)
      }
    },
    created: Date.now(),
    receipt_url: 'https://receipt.example.com/' + Math.random().toString(36).substring(2, 15)
  };
};

// Create HTTP server
const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  // Parse URL
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // Handle payment intent creation
  if (req.method === 'POST' && pathname === '/create-payment-intent') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const { amount, currency } = JSON.parse(body);
        const paymentIntent = createPaymentIntent(amount, currency || 'usd');
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(paymentIntent));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  }
  // Handle payment confirmation
  else if (req.method === 'POST' && pathname === '/confirm-payment') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const { paymentIntentId } = JSON.parse(body);
        const confirmation = confirmPayment(paymentIntentId);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(confirmation));
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  }
  else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Start the server
const PORT = 3003;
server.listen(PORT, () => {
  console.log(`Payment server running on port ${PORT}`);
});