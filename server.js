const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const sellerApi = require('./seller-api');
const cors = require('cors');
const { initializeVideoCall, initializeVoiceCall } = require('./twilio-video');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Middleware
app.use(helmet());
app.use(morgan('dev'));
app.use(compression());
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3002',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/profiles';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG and GIF are allowed.'));
        }
    }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/financeconnect', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((err) => {
    console.error('MongoDB connection error:', err);
});

// User Schema
const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    country: { type: String, required: true },
    website: { type: String },
    bio: { type: String },
    userType: { type: String, enum: ['buyer', 'seller'], required: true },
    profilePhoto: { type: String },
    stripeCustomerId: { type: String },
    isVerified: { type: Boolean, default: false },
    lastLogin: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw error;
    }
};

// Method to get public profile
userSchema.methods.getPublicProfile = function() {
    const userObject = this.toObject();
    delete userObject.password;
    delete userObject.stripeCustomerId;
    return userObject;
};

const User = mongoose.model('User', userSchema);

// Authentication middleware
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        const user = await User.findOne({ _id: decoded.userId });

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Please authenticate' });
    }
};

// Routes
// Register new user
app.post('/api/signup', upload.single('profilePhoto'), async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            password,
            phone,
            address,
            city,
            country,
            website,
            bio,
            userType,
            paymentMethodId
        } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Process payment for sellers
        let stripeCustomerId;
        if (userType === 'seller') {
            if (!paymentMethodId) {
                return res.status(400).json({ error: 'Payment method required for seller registration' });
            }

            try {
                const customer = await stripe.customers.create({
                    email,
                    payment_method: paymentMethodId,
                    invoice_settings: {
                        default_payment_method: paymentMethodId,
                    },
                });

                const paymentIntent = await stripe.paymentIntents.create({
                    amount: 2000,
                    currency: 'usd',
                    customer: customer.id,
                    payment_method: paymentMethodId,
                    confirm: true,
                    description: 'Seller registration fee',
                });

                if (paymentIntent.status !== 'succeeded') {
                    return res.status(400).json({ error: 'Payment failed' });
                }

                stripeCustomerId = customer.id;
            } catch (error) {
                console.error('Payment error:', error);
                return res.status(400).json({ error: 'Payment processing failed' });
            }
        }

        // Create user
        const user = new User({
            firstName,
            lastName,
            email,
            password,
            phone,
            address,
            city,
            country,
            website,
            bio,
            userType,
            profilePhoto: req.file ? `/uploads/profiles/${req.file.filename}` : null,
            isVerified: userType === 'seller',
            stripeCustomerId
        });

        await user.save();

        // Generate token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            user: user.getPublicProfile(),
            token
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Error creating user account' });
    }
});

// Login user
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        user.lastLogin = new Date();
        await user.save();

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            user: user.getPublicProfile(),
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Error logging in' });
    }
});

// Get user profile
app.get('/api/profile', auth, async (req, res) => {
    try {
        res.json(req.user.getPublicProfile());
    } catch (error) {
        res.status(500).json({ error: 'Error fetching profile' });
    }
});

// Get user by email
app.get('/api/user', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        
        const user = await User.findOne({ email }).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ user: user.getPublicProfile() });
    } catch (error) {
        console.error('Error fetching user by email:', error);
        res.status(500).json({ error: 'Error fetching user data' });
    }
});

// Update user profile
app.put('/api/profile', auth, upload.single('profilePhoto'), async (req, res) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['firstName', 'lastName', 'phone', 'address', 'city', 'country', 'website', 'bio'];
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
        return res.status(400).json({ error: 'Invalid updates' });
    }

    try {
        updates.forEach(update => req.user[update] = req.body[update]);
        
        if (req.file) {
            req.user.profilePhoto = `/uploads/profiles/${req.file.filename}`;
        }

        await req.user.save();
        res.json(req.user.getPublicProfile());
    } catch (error) {
        res.status(400).json({ error: 'Error updating profile' });
    }
});

// Delete user account
app.delete('/api/profile', auth, async (req, res) => {
    try {
        if (req.user.stripeCustomerId) {
            await stripe.customers.del(req.user.stripeCustomerId);
        }

        await req.user.remove();
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting account' });
    }
});

// Change password
app.put('/api/change-password/:userId', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(req.params.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Verify current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        // Update password
        user.password = newPassword;
        await user.save();
        
        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Error changing password' });
    }
});

// Twilio video/voice call endpoints
app.post('/api/token', async (req, res) => {
    try {
        const { identity, roomName } = req.body;
        const token = await generateToken(identity, roomName);
        res.json({ token });
    } catch (error) {
        console.error('Error generating token:', error);
        res.status(500).json({ error: 'Failed to generate token' });
    }
});

app.post('/api/call/video', async (req, res) => {
    try {
        const { identity, roomName } = req.body;
        const room = await initializeVideoCall(identity, roomName);
        res.json({ roomSid: room.sid });
    } catch (error) {
        console.error('Error initializing video call:', error);
        res.status(500).json({ error: 'Failed to initialize video call' });
    }
});

app.post('/api/call/voice', async (req, res) => {
    try {
        const { identity, roomName } = req.body;
        const room = await initializeVoiceCall(identity, roomName);
        res.json({ roomSid: room.sid });
    } catch (error) {
        console.error('Error initializing voice call:', error);
        res.status(500).json({ error: 'Failed to initialize voice call' });
    }
});

// Payment endpoints
app.post('/create-payment-intent', async (req, res) => {
    try {
        const { amount, currency = 'usd' } = req.body;
        
        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to cents
            currency: currency,
            automatic_payment_methods: {
                enabled: true,
            },
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            id: paymentIntent.id
        });
    } catch (error) {
        console.error('Payment intent error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Payment confirmation endpoint
app.post('/confirm-payment', async (req, res) => {
    try {
        const { paymentIntentId } = req.body;
        
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        
        if (paymentIntent.status === 'succeeded') {
            res.json({ success: true, status: paymentIntent.status });
        } else {
            res.json({ success: false, status: paymentIntent.status });
        }
    } catch (error) {
        console.error('Payment confirmation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
