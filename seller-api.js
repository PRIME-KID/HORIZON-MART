const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const stripe = require('stripe')(process.env.sk_test_51RabJrPQCFOFR0ZaL5pEk3UXU5xu3RwqKyvrzfxpF9HSWhhil5QXrrl8n9TaXhRDzZcH7Ly2zXFQPKdFWQ9EORPA00SnryxDC1);

// Define Good Schema
const goodSchema = new mongoose.Schema({
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    title: String,
    description: String,
    price: Number,
    category: {
        type: String,
        enum: ['general', 'premium', 'services', 'digital', 'high-volume']
    },
    images: [String],
    contactInfo: {
        email: String,
        phone: String,
        website: String
    },
    commissionRate: Number,
    status: {
        type: String,
        enum: ['active', 'inactive', 'pending'],
        default: 'pending'
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Good = mongoose.model('Good', goodSchema);

// Commission rates based on category - now all 1%
const COMMISSION_RATES = {
    'general': 0.01,    // 1%
    'premium': 0.01,    // 1%
    'services': 0.01,   // 1%
    'digital': 0.01,    // 1%
    'high-volume': 0.01 // 1%
};

// Add new good
router.post('/goods', async (req, res) => {
    try {
        const {
            title,
            description,
            price,
            category,
            images,
            contactInfo
        } = req.body;

        // Calculate commission rate based on category
        const commissionRate = COMMISSION_RATES[category];

        const good = new Good({
            sellerId: req.user._id, // Assuming user is authenticated
            title,
            description,
            price,
            category,
            images,
            contactInfo,
            commissionRate
        });

        await good.save();
        res.status(201).json(good);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get seller's goods
router.get('/goods', async (req, res) => {
    try {
        const goods = await Good.find({ sellerId: req.user._id });
        res.json(goods);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update good
router.put('/goods/:id', async (req, res) => {
    try {
        const good = await Good.findOneAndUpdate(
            { _id: req.params.id, sellerId: req.user._id },
            { ...req.body, updatedAt: Date.now() },
            { new: true }
        );
        if (!good) {
            return res.status(404).json({ error: 'Good not found' });
        }
        res.json(good);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete good
router.delete('/goods/:id', async (req, res) => {
    try {
        const good = await Good.findOneAndDelete({
            _id: req.params.id,
            sellerId: req.user._id
        });
        if (!good) {
            return res.status(404).json({ error: 'Good not found' });
        }
        res.json({ message: 'Good deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get seller analytics
router.get('/analytics', async (req, res) => {
    try {
        const goods = await Good.find({ sellerId: req.user._id });
        
        // Calculate total sales and commission
        const analytics = {
            totalSales: goods.reduce((sum, good) => sum + good.price, 0),
            totalCommission: goods.reduce((sum, good) => 
                sum + (good.price * good.commissionRate), 0),
            activeListings: goods.filter(g => g.status === 'active').length,
            categoryBreakdown: goods.reduce((acc, good) => {
                acc[good.category] = (acc[good.category] || 0) + 1;
                return acc;
            }, {})
        };

        res.json(analytics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Calculate commission for a sale
router.post('/calculate-commission', async (req, res) => {
    try {
        const { price, category } = req.body;
        const commissionRate = COMMISSION_RATES[category];
        const commission = price * commissionRate;
        
        res.json({
            price,
            category,
            commissionRate,
            commission,
            sellerAmount: price - commission
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Define the Listing schema
const listingSchema = new mongoose.Schema({
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, required: true },
    isPremium: { type: Boolean, default: false },
    premiumExpiry: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const Listing = mongoose.model('Listing', listingSchema);

// Middleware to log requests
router.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Get all listings for a seller
router.get('/listings', async (req, res) => {
    try {
        console.log('Fetching listings...');
        // For testing, we'll use a mock seller ID
        const mockSellerId = new mongoose.Types.ObjectId();
        const listings = await Listing.find({ sellerId: mockSellerId });
        console.log(`Found ${listings.length} listings`);
        res.json(listings);
    } catch (error) {
        console.error('Error fetching listings:', error);
        res.status(500).json({ 
            error: 'Error fetching listings',
            details: error.message 
        });
    }
});

// Create a new listing
router.post('/listings', async (req, res) => {
    try {
        console.log('Creating new listing:', req.body);
        const { name, description, price, category } = req.body;
        
        // Validate required fields
        if (!name || !description || !price || !category) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['name', 'description', 'price', 'category']
            });
        }

        // For testing, we'll use a mock seller ID
        const mockSellerId = new mongoose.Types.ObjectId();
        const listing = new Listing({
            sellerId: mockSellerId,
            name,
            description,
            price,
            category
        });

        await listing.save();
        console.log('Listing created successfully:', listing._id);
        res.status(201).json(listing);
    } catch (error) {
        console.error('Error creating listing:', error);
        res.status(500).json({ 
            error: 'Error creating listing',
            details: error.message 
        });
    }
});

// Update a listing
router.put('/listings/:id', async (req, res) => {
    try {
        console.log(`Updating listing ${req.params.id}:`, req.body);
        const { name, description, price, category } = req.body;
        
        // For testing, we'll use a mock seller ID
        const mockSellerId = new mongoose.Types.ObjectId();
        const listing = await Listing.findOneAndUpdate(
            { _id: req.params.id, sellerId: mockSellerId },
            { 
                name, 
                description, 
                price, 
                category, 
                updatedAt: Date.now() 
            },
            { new: true }
        );

        if (!listing) {
            console.log(`Listing ${req.params.id} not found`);
            return res.status(404).json({ error: 'Listing not found' });
        }

        console.log('Listing updated successfully:', listing._id);
        res.json(listing);
    } catch (error) {
        console.error('Error updating listing:', error);
        res.status(500).json({ 
            error: 'Error updating listing',
            details: error.message 
        });
    }
});

// Delete a listing
router.delete('/listings/:id', async (req, res) => {
    try {
        console.log(`Deleting listing ${req.params.id}`);
        // For testing, we'll use a mock seller ID
        const mockSellerId = new mongoose.Types.ObjectId();
        const listing = await Listing.findOneAndDelete({
            _id: req.params.id,
            sellerId: mockSellerId
        });

        if (!listing) {
            console.log(`Listing ${req.params.id} not found`);
            return res.status(404).json({ error: 'Listing not found' });
        }

        console.log('Listing deleted successfully:', listing._id);
        res.json({ message: 'Listing deleted successfully' });
    } catch (error) {
        console.error('Error deleting listing:', error);
        res.status(500).json({ 
            error: 'Error deleting listing',
            details: error.message 
        });
    }
});

// Toggle premium status for a listing
router.put('/listings/:id/premium', async (req, res) => {
    try {
        console.log(`Toggling premium status for listing ${req.params.id}:`, req.body);
        const { isPremium } = req.body;
        
        // For testing, we'll use a mock seller ID
        const mockSellerId = new mongoose.Types.ObjectId();
        const listing = await Listing.findOne({
            _id: req.params.id,
            sellerId: mockSellerId
        });

        if (!listing) {
            console.log(`Listing ${req.params.id} not found`);
            return res.status(404).json({ error: 'Listing not found' });
        }

        listing.isPremium = isPremium;
        if (isPremium) {
            listing.premiumExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        } else {
            listing.premiumExpiry = null;
        }

        await listing.save();
        console.log('Premium status updated successfully:', listing._id);
        res.json(listing);
    } catch (error) {
        console.error('Error toggling premium status:', error);
        res.status(500).json({ 
            error: 'Error updating premium status',
            details: error.message 
        });
    }
});

// Get premium listing statistics
router.get('/premium-stats', async (req, res) => {
    try {
        console.log('Fetching premium statistics...');
        // For testing, we'll use a mock seller ID
        const mockSellerId = new mongoose.Types.ObjectId();
        
        const [totalListings, premiumListings, activePremiumListings] = await Promise.all([
            Listing.countDocuments({ sellerId: mockSellerId }),
            Listing.countDocuments({
                sellerId: mockSellerId,
                isPremium: true
            }),
            Listing.countDocuments({
                sellerId: mockSellerId,
                isPremium: true,
                premiumExpiry: { $gt: new Date() }
            })
        ]);

        console.log('Premium statistics:', {
            totalListings,
            premiumListings,
            activePremiumListings
        });

        res.json({
            totalListings,
            premiumListings,
            activePremiumListings
        });
    } catch (error) {
        console.error('Error fetching premium statistics:', error);
        res.status(500).json({ 
            error: 'Error fetching premium statistics',
            details: error.message 
        });
    }
});

module.exports = router;