const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const FormData = require('form-data');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

dotenv.config();
const fetch = require('node-fetch');

// ============================================
// ENVIRONMENT VALIDATION ON STARTUP
// ============================================
const REQUIRED_ENV = ['MONGO_URI', 'JWT_SECRET'];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
    console.error(`❌ Missing required environment variables: ${missingEnv.join(', ')}`);
    console.error('Please create a .env file with these variables set.');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// Python backend URL
const PYTHON_BACKEND = process.env.PYTHON_BACKEND_URL || 'http://localhost:8000';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// ROBUST MONGODB CONNECTION WITH RETRY LOGIC
// ============================================

const mongooseOptions = {
    autoIndex: true,
};

const CONNECTION_STATES = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
};

let isConnected = false;
let connectionAttempts = 0;
const MAX_RETRIES = 5;

const connectDB = async () => {
    connectionAttempts++;

    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, mongooseOptions);

        isConnected = true;
        connectionAttempts = 0;

        console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.db.databaseName}`);

        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
            isConnected = false;
        });

        mongoose.connection.on('disconnected', () => {
            console.log('⚠️ MongoDB disconnected');
            isConnected = false;
        });

        mongoose.connection.on('reconnected', () => {
            console.log('✅ MongoDB reconnected');
            isConnected = true;
        });

    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err.message);

        if (err.name === 'MongooseServerSelectionError') {
            console.log('\n🔍 TROUBLESHOOTING STEPS:');
            console.log('1. Check if MongoDB is running locally (mongod)');
            console.log('2. Check if the connection string matches your local configuration');
        }

        if (connectionAttempts < MAX_RETRIES) {
            const delay = Math.min(1000 * Math.pow(2, connectionAttempts), 30000);
            console.log(`⏰ Retrying in ${delay / 1000} seconds...`);
            setTimeout(connectDB, delay);
        } else {
            console.log('❌ Max retries reached. Server will continue without MongoDB connection.');
            console.log('⚠️ Some features may not work properly.');
        }
    }
};

connectDB();

// ============================================
// FIX: Define WatermarkedImage schema and model ONCE at top level
// Previously it was defined twice (once here, once inline in history route)
// which caused the second reference to potentially be undefined.
// ============================================
const watermarkedImageSchema = new mongoose.Schema({
    user_id: { type: String, required: true },
    image_id: { type: String, required: true },
    original_name: String,
    auth_tag: String,
    created_at: { type: Date, default: Date.now }
}, { collection: 'watermarked_images' });

// Use mongoose.models to avoid "Cannot overwrite model once compiled" error on hot reload
const WatermarkRef = mongoose.models.WatermarkedImage ||
    mongoose.model('WatermarkedImage', watermarkedImageSchema);

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        mongodbState: CONNECTION_STATES[mongoose.connection.readyState],
        timestamp: new Date().toISOString()
    });
});

// Routes
app.get('/', (req, res) => res.send('Server is running'));

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({
            name,
            email,
            password: hashedPassword
        });

        await user.save();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const payload = {
            user: {
                id: user.id,
                name: user.name
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '1h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// Delete Account
app.delete('/api/auth/delete', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token, authorization denied' });
        }

        const { password } = req.body;
        if (!password) {
            return res.status(400).json({ message: 'Password is required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect password' });
        }

        await User.findByIdAndDelete(decoded.user.id);
        res.json({ message: 'Account deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error during account deletion' });
    }
});

// Get User Profile
app.get('/api/auth/profile', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ message: 'No token, authorization denied' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.user.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error fetching profile' });
    }
});

// Update Profile (Email or Password)
app.put('/api/auth/update', async (req, res) => {
    try {
        const { currentPassword, newEmail, newPassword } = req.body;
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'No token, authorization denied' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect current password' });
        }

        if (newEmail) {
            const otherUser = await User.findOne({ email: newEmail });
            if (otherUser && otherUser.id !== user.id) {
                return res.status(400).json({ message: 'Email already in use' });
            }
            user.email = newEmail;
        }

        if (newPassword) {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(newPassword, salt);
        }

        await user.save();
        res.json({
            message: 'Profile updated successfully',
            user: { id: user.id, name: user.name, email: user.email }
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ message: 'Server error updating profile' });
    }
});

// ============================================
// JWT AUTH MIDDLEWARE
// ============================================
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (err) {
        console.error('JWT Error:', err.name, err.message);
        const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Token is not valid';
        res.status(401).json({ message, error: err.message });
    }
};

// ============================================
// FIX: Timeout helper compatible with node-fetch v2
// node-fetch v2 does not support AbortController's signal natively.
// We wrap the fetch in a Promise.race with a manual timeout rejection.
// ============================================
const fetchWithTimeout = (url, options, timeoutMs = 30000) => {
    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), timeoutMs)
    );
    return Promise.race([fetch(url, options), timeoutPromise]);
};

/**
 * @route   POST /api/autoencoder/embed
 * @desc    Forward embedding request to Python backend with image and data
 * @access  Private
 */
app.post('/api/autoencoder/embed', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Image file is required' });
        }

        const { data } = req.body;
        if (!data) {
            return res.status(400).json({ message: 'Data to embed is required' });
        }

        console.log(`Processing embed request for user: ${req.user.id}`);
        console.log(`Image: ${req.file.originalname}, Size: ${req.file.size} bytes`);
        console.log(`Data length: ${data.length} characters`);

        const formData = new FormData();
        formData.append('image', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });
        formData.append('data', data);
        formData.append('user_id', req.user.id);

        const response = await fetchWithTimeout(
            `${PYTHON_BACKEND}/api/autoencoder/embed`,
            { method: 'POST', body: formData, headers: formData.getHeaders() },
            60000 // 60s timeout for embedding (model inference can be slow)
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || 'Python backend error');
        }

        // Save reference to MongoDB
        try {
            await WatermarkRef.create({
                user_id: req.user.id,
                image_id: result.image_id,
                original_name: req.file.originalname,
                auth_tag: result.auth_tag,
                created_at: new Date()
            });
            console.log('Saved watermark reference to MongoDB');
        } catch (dbError) {
            // Log but don't fail — main operation succeeded
            console.error('Error saving to MongoDB:', dbError);
        }

        res.json({
            success: true,
            message: 'Data embedded successfully',
            image_id: result.image_id,
            autoencoder_tag: result.autoencoder_tag,
            auth_tag: result.auth_tag,
            session_key: result.session_key,
            metadata: result.metadata,
            image: result.image
        });

    } catch (err) {
        console.error('Error in /api/autoencoder/embed:', err);

        if (err.message === 'REQUEST_TIMEOUT') {
            return res.status(504).json({
                success: false,
                message: 'Python backend timeout',
                error: 'Request timed out after 60 seconds'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error processing autoencoder embedding request',
            error: err.message
        });
    }
});

/**
 * @route   POST /api/autoencoder/extract
 * @desc    Forward extraction request to Python backend
 * @access  Private
 */
app.post('/api/autoencoder/extract', authMiddleware, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Image file is required' });
        }

        const { image_id, session_key } = req.body;

        console.log('=== EXTRACT REQUEST ===');
        console.log(`User: ${req.user.id}`);
        console.log(`Image: ${req.file.originalname}, Size: ${req.file.size} bytes`);
        console.log(`Image ID: ${image_id || 'Not provided'}`);
        console.log(`Session Key: ${session_key ? 'Provided' : 'Not provided'}`);

        const formData = new FormData();
        formData.append('image', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });

        if (image_id) {
            formData.append('image_id', image_id);
        }

        if (session_key) {
            formData.append('session_key', session_key);
        }

        console.log('Forwarding to Python backend...');

        const response = await fetchWithTimeout(
            `${PYTHON_BACKEND}/api/autoencoder/extract`,
            { method: 'POST', body: formData, headers: formData.getHeaders() },
            30000
        );

        console.log('Python backend response status:', response.status);

        const responseText = await response.text();

        let result;
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            console.error('Failed to parse Python response as JSON:', responseText.substring(0, 200));
            throw new Error('Python backend returned invalid JSON');
        }

        if (!response.ok) {
            throw new Error(result.detail || result.message || 'Python backend error');
        }

        console.log('Extraction successful');

        res.json({
            success: true,
            message: 'Data extracted successfully',
            extracted_data: result.extracted_data,
            autoencoder_tag: result.autoencoder_tag,
            verification: result.verification,
            metadata: result.metadata
        });

    } catch (err) {
        console.error('=== EXTRACT ERROR ===');
        console.error('Error name:', err.name);
        console.error('Error message:', err.message);

        if (err.message === 'REQUEST_TIMEOUT') {
            return res.status(504).json({
                success: false,
                message: 'Python backend timeout',
                error: 'Request timed out after 30 seconds'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error processing autoencoder extraction request',
            error: err.message
        });
    }
});

/**
 * @route   GET /api/autoencoder/verify/:image_id
 * @desc    Verify image integrity
 * @access  Private
 */
app.get('/api/autoencoder/verify/:image_id', authMiddleware, async (req, res) => {
    try {
        const { image_id } = req.params;

        const response = await fetchWithTimeout(
            `${PYTHON_BACKEND}/api/autoencoder/verify/${image_id}`,
            { method: 'GET', headers: { 'Content-Type': 'application/json' } },
            10000
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || 'Python backend error');
        }

        res.json({ success: true, ...result });

    } catch (err) {
        console.error('Error in /api/autoencoder/verify:', err);
        res.status(500).json({
            success: false,
            message: 'Error verifying image',
            error: err.message
        });
    }
});

/**
 * @route   GET /api/autoencoder/history
 * @desc    Get user's watermarked images history
 * @access  Private
 * FIX: Now uses the single top-level WatermarkRef instead of re-fetching
 * mongoose.models.WatermarkedImage which could be undefined if registration failed.
 */
app.get('/api/autoencoder/history', authMiddleware, async (req, res) => {
    try {
        const localHistory = await WatermarkRef.find({ user_id: req.user.id })
            .sort({ created_at: -1 })
            .limit(50)
            .lean();

        return res.json({
            success: true,
            history: localHistory.map(item => ({
                id: item.image_id,
                image_name: item.original_name,
                created_at: item.created_at,
                auth_tag: item.auth_tag ? item.auth_tag.substring(0, 16) + '...' : null,
                has_image: true
            }))
        });
    } catch (err) {
        console.error('Error in /api/autoencoder/history:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching history',
            error: err.message
        });
    }
});

/**
 * @route   GET /api/autoencoder/image/:image_id
 * @desc    Retrieve a specific watermarked image by ID
 * @access  Private
 */
app.get('/api/autoencoder/image/:image_id', authMiddleware, async (req, res) => {
    try {
        const { image_id } = req.params;

        const record = await WatermarkRef.findOne({
            image_id: image_id,
            user_id: req.user.id
        });

        if (record) {
            return res.json({
                success: true,
                image_id: record.image_id,
                original_name: record.original_name,
                created_at: record.created_at,
                auth_tag: record.auth_tag
            });
        }

        res.status(404).json({ success: false, message: 'Image not found' });

    } catch (err) {
        console.error('Error in /api/autoencoder/image:', err);
        res.status(500).json({
            success: false,
            message: 'Error fetching image',
            error: err.message
        });
    }
});

/**
 * @route   GET /api/autoencoder/status
 * @desc    Check Python backend status
 * @access  Public
 */
app.get('/api/autoencoder/status', async (req, res) => {
    try {
        const response = await fetchWithTimeout(
            `${PYTHON_BACKEND}/`,
            { method: 'GET' },
            3000
        );

        if (response.ok) {
            const data = await response.json();
            res.json({
                success: true,
                status: 'connected',
                message: 'Python backend is running',
                details: data
            });
        } else {
            res.json({
                success: false,
                status: 'error',
                message: 'Python backend returned an error'
            });
        }
    } catch (err) {
        res.json({
            success: false,
            status: 'disconnected',
            message: 'Python backend is not reachable',
            error: err.message
        });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));