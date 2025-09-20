const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const stripe = require('stripe')('sk_test_51RabJrPQCFOFR0ZaL5pEk3UXU5xu3RwqKyvrzfxpF9HSWhhil5QXrrl8n9TaXhRDzZcH7Ly2zXFQPKdFWQ9EORPA00SnryxDC1'); // Replace with your Stripe secret key

const app = express();

// Middleware
app.use(cors({
    origin: 'http://localhost:3002',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

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
mongoose.connect('mongodb://localhost:27017/financeconnect', {
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
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    isVerified: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);

// Signup endpoint
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

        // Validate required fields
        if (!firstName || !lastName || !email || !password || !phone || !address || !city || !country || !userType) {
            return res.status(400).json({ 
                error: 'All required fields must be filled',
                missing: {
                    firstName: !firstName,
                    lastName: !lastName,
                    email: !email,
                    password: !password,
                    phone: !phone,
                    address: !address,
                    city: !city,
                    country: !country,
                    userType: !userType
                }
            });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // If user is a seller, process payment
        if (userType === 'seller') {
            if (!paymentMethodId) {
                return res.status(400).json({ error: 'Payment method is required for seller registration' });
            }

            try {
                // Create a payment intent
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: 2000, // $20.00 in cents
                    currency: 'usd',
                    payment_method: paymentMethodId,
                    confirm: true,
                    description: 'Seller registration fee',
                    metadata: {
                        email: email,
                        userType: userType
                    }
                });

                if (paymentIntent.status !== 'succeeded') {
                    return res.status(400).json({ error: 'Payment failed' });
                }
            } catch (error) {
                console.error('Payment error:', error);
                return res.status(400).json({ error: 'Payment processing failed' });
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const user = new User({
            firstName,
            lastName,
            email,
            password: hashedPassword,
            phone,
            address,
            city,
            country,
            website,
            bio,
            userType,
            profilePhoto: req.file ? `/uploads/profiles/${req.file.filename}` : null,
            isVerified: userType === 'seller' // Mark seller accounts as verified after payment
        });

        await user.save();

        // Return success response without sensitive data
        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                userType: user.userType,
                profilePhoto: user.profilePhoto,
                isVerified: user.isVerified
            }
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ 
            error: 'Error creating user account',
            details: error.message 
        });
    }
});

// Get user profile
app.get('/api/profile/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching user profile' });
    }
});

// Update user profile
app.put('/api/profile/:userId', upload.single('profilePhoto'), async (req, res) => {
    try {
        const updates = req.body;
        delete updates.password; // Prevent password update through this route

        if (req.file) {
            updates.profilePhoto = `/uploads/profiles/${req.file.filename}`;
        }

        const user = await User.findByIdAndUpdate(
            req.params.userId,
            { ...updates, updatedAt: Date.now() },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Error updating user profile' });
    }
});

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

const PORT = 3002;
app.listen(PORT, () => {
    console.log(`Auth server running on port ${PORT}`);
});
