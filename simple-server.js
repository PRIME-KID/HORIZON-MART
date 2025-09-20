// Simple server for testing integration
const http = require('http');
const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const crypto = require('crypto');

// In-memory storage for users (in a real app, this would be a database)
const users = [
  // Add a test user for development purposes
  {
    id: 'user_test123',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    phone: '123-456-7890',
    address: '123 Test St',
    city: 'Test City',
    country: 'Test Country',
    website: 'https://example.com',
    bio: 'This is a test user account',
    userType: 'buyer',
    profilePhotoUrl: null,
    createdAt: Date.now(),
    password: crypto.createHash('sha256').update('password123').digest('hex') // password: password123
  }
];

// Function to authenticate a user
const authenticateUser = (email, password) => {
  // Validate input
  if (!email || !password) {
    throw new Error('Email and password are required');
  }
  
  // Find user by email
  const user = users.find(user => user.email === email);
  if (!user) {
    throw new Error('Invalid email or password');
  }
  
  // Hash the provided password and compare with stored hash
  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
  if (user.password !== hashedPassword) {
    throw new Error('Invalid email or password');
  }
  
  // Return user data without password
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

// Mock data for payment intent
const createPaymentIntent = (amount, currency) => {
  // Validate input
  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    throw new Error('Invalid amount. Please provide a valid positive number.');
  }
  
  if (!currency || typeof currency !== 'string' || !['usd', 'eur', 'gbp'].includes(currency.toLowerCase())) {
    throw new Error('Invalid currency. Supported currencies are USD, EUR, and GBP.');
  }
  
  // Generate mock payment intent data
  return {
    clientSecret: 'test_secret_' + Math.random().toString(36).substring(2, 15),
    id: 'pi_' + Math.random().toString(36).substring(2, 15),
    amount: parseFloat(amount),
    currency: currency.toLowerCase(),
    status: 'requires_payment_method',
    created: Date.now()
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

// Handle user registration
const registerUser = (userData, profilePhotoData) => {
  // Validate required fields
  const requiredFields = ['firstName', 'lastName', 'email', 'password', 'userType'];
  for (const field of requiredFields) {
    if (!userData[field]) {
      throw new Error(`${field} is required`);
    }
  }
  
  // Check if email already exists
  const existingUser = users.find(user => user.email === userData.email);
  if (existingUser) {
    throw new Error('Email already registered');
  }
  
  // Hash password (in a real app, use bcrypt)
  const hashedPassword = crypto.createHash('sha256').update(userData.password).digest('hex');
  
  // Create user object
  const newUser = {
    id: 'user_' + Math.random().toString(36).substring(2, 15),
    firstName: userData.firstName,
    lastName: userData.lastName,
    email: userData.email,
    phone: userData.phone,
    address: userData.address,
    city: userData.city,
    country: userData.country,
    website: userData.website || '',
    bio: userData.bio || '',
    userType: userData.userType,
    profilePhotoUrl: profilePhotoData ? `/uploads/${userData.email.replace('@', '_at_')}.jpg` : null,
    createdAt: Date.now()
  };
  
  // Save profile photo if provided
  if (profilePhotoData) {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir);
    }
    
    // Save photo
    const photoPath = path.join(uploadsDir, `${userData.email.replace('@', '_at_')}.jpg`);
    fs.writeFileSync(photoPath, profilePhotoData);
  }
  
  // Add user to in-memory storage
  users.push({
    ...newUser,
    password: hashedPassword // Store hashed password
  });
  
  // Return user data without password
  return newUser;
};

// MIME types for file extensions
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Function to get user by email (without password)
const getUserByEmail = (email) => {
  // Validate input
  if (!email) {
    throw new Error('Email is required');
  }
  
  // Find user by email
  const user = users.find(user => user.email === email);
  if (!user) {
    throw new Error('User not found');
  }
  
  // Return user data without password
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

// Create a server
const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Parse URL
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  
  // Handle GET /api/user endpoint
  if (req.method === 'GET' && pathname === '/api/user') {
    try {
      const email = url.searchParams.get('email');
      
      // Validate required fields
      if (!email) {
        throw new Error('Email parameter is required');
      }
      
      // Get user by email
      const user = getUserByEmail(email);
      
      // Log success for debugging
      console.log(`User data retrieved for: ${user.email}`);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'User data retrieved successfully',
        user: user
      }));
    } catch (error) {
      console.error('Error retrieving user data:', error.message);
      
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: error.message || 'User not found',
        code: 'user_not_found'
      }));
    }
  }
  // Serve static files
  else if (req.method === 'GET' && pathname !== '/create-payment-intent' && pathname !== '/confirm-payment' && pathname !== '/api/user') {
    // Default to index.html if root is requested
    let filePath = '.' + pathname;
    if (pathname === '/') {
      filePath = './test-integration.html';
    }
    
    // Get the file extension
    const extname = path.extname(filePath);
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    
    // Read the file
    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code === 'ENOENT') {
          // File not found
          res.writeHead(404, { 'Content-Type': 'text/html' });
          res.end('404 Not Found');
        } else {
          // Server error
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('500 Internal Server Error: ' + error.code);
        }
      } else {
        // Success
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
  }
  // Handle API endpoints
  else if (req.method === 'POST' && pathname === '/create-payment-intent') {
    let body = '';
    
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        // Parse request body
        let parsedBody;
        try {
          parsedBody = JSON.parse(body);
        } catch (parseError) {
          throw new Error('Invalid JSON format in request body');
        }
        
        const { amount, currency } = parsedBody;
        
        // Validate required fields
        if (!amount) {
          throw new Error('Amount is required');
        }
        
        if (!currency) {
          throw new Error('Currency is required');
        }
        
        // Create payment intent
        const paymentIntent = createPaymentIntent(amount, currency);
        
        // Log success for debugging
        console.log(`Created payment intent: ${paymentIntent.id} for amount: ${amount} ${currency}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(paymentIntent));
      } catch (error) {
        console.error('Error creating payment intent:', error.message);
        
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: error.message || 'Invalid request data',
          code: 'payment_intent_creation_failed'
        }));
      }
    });
  } 
  else if (req.method === 'POST' && pathname === '/confirm-payment') {
    let body = '';
    
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        // Parse request body
        let parsedBody;
        try {
          parsedBody = JSON.parse(body);
        } catch (parseError) {
          throw new Error('Invalid JSON format in request body');
        }
        
        const { paymentIntentId } = parsedBody;
        
        // Validate required fields
        if (!paymentIntentId) {
          throw new Error('Payment Intent ID is required');
        }
        
        // Confirm payment
        const confirmation = confirmPayment(paymentIntentId);
        
        // Log success for debugging
        console.log(`Confirmed payment: ${paymentIntentId}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(confirmation));
      } catch (error) {
        console.error('Error confirming payment:', error.message);
        
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: error.message || 'Invalid request data',
          code: 'payment_confirmation_failed'
        }));
      }
    });
  }
  else if (req.method === 'POST' && pathname === '/api/signup') {
    // Handle multipart form data for signup
    const contentType = req.headers['content-type'] || '';
    
    // Check if it's multipart form data
    if (contentType.includes('multipart/form-data')) {
      const boundary = contentType.split('boundary=')[1];
      let body = '';
      let profilePhotoData = null;
      
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      
      req.on('end', () => {
        try {
          // Parse multipart form data
          const parts = body.split(`--${boundary}`);
          const formData = {};
          
          // Process each part
          for (const part of parts) {
            if (part.includes('Content-Disposition: form-data;')) {
              // Extract field name
              const nameMatch = part.match(/name="([^"]+)"/i);
              if (nameMatch) {
                const name = nameMatch[1];
                
                // Check if it's a file
                if (part.includes('filename="')) {
                  // Handle profile photo
                  if (name === 'profilePhoto') {
                    // Extract binary data
                    const binaryDataStart = part.indexOf('\r\n\r\n') + 4;
                    const binaryDataEnd = part.lastIndexOf('\r\n');
                    if (binaryDataStart > 0 && binaryDataEnd > binaryDataStart) {
                      profilePhotoData = Buffer.from(part.substring(binaryDataStart, binaryDataEnd), 'binary');
                    }
                  }
                } else {
                  // Handle regular form field
                  const valueStart = part.indexOf('\r\n\r\n') + 4;
                  const valueEnd = part.lastIndexOf('\r\n');
                  if (valueStart > 0 && valueEnd > valueStart) {
                    formData[name] = part.substring(valueStart, valueEnd);
                  }
                }
              }
            }
          }
          
          // Process payment for sellers
          if (formData.userType === 'seller' && formData.paymentMethodId) {
            // In a real app, you would process the payment with Stripe here
            console.log(`Processing seller registration payment with payment method: ${formData.paymentMethodId}`);
          }
          
          // Register user
          const newUser = registerUser(formData, profilePhotoData);
          
          // Log success for debugging
          console.log(`Registered new user: ${newUser.email} as ${newUser.userType}`);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            message: 'User registered successfully',
            user: newUser
          }));
        } catch (error) {
          console.error('Error registering user:', error.message);
          
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: error.message || 'Registration failed',
            code: 'registration_failed'
          }));
        }
      });
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Invalid content type. Expected multipart/form-data',
        code: 'invalid_content_type'
      }));
    }
  }
  else if (req.method === 'POST' && pathname === '/api/login') {
    let body = '';
    
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        // Parse request body
        let parsedBody;
        try {
          parsedBody = JSON.parse(body);
        } catch (parseError) {
          throw new Error('Invalid JSON format in request body');
        }
        
        const { email, password } = parsedBody;
        
        // Validate required fields
        if (!email) {
          throw new Error('Email is required');
        }
        
        if (!password) {
          throw new Error('Password is required');
        }
        
        // Authenticate user
        const user = authenticateUser(email, password);
        
        // Log success for debugging
        console.log(`User logged in: ${user.email}`);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Login successful',
          user: user
        }));
      } catch (error) {
        console.error('Error logging in:', error.message);
        
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: error.message || 'Authentication failed',
          code: 'authentication_failed'
        }));
      }
    });
  }
  else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Start the server
const PORT = 3002;
server.listen(PORT, () => {
  console.log(`Simple server running on port ${PORT}`);
});