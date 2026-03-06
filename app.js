const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const uploadRoutes = require('./routes/uploadRoutes'); // Make sure this path is correct
const userManagementRoutes = require('./routes/userManagementroutes');
const customerRoutes = require('./routes/customerRoutes');
const billRoutes = require('./routes/billRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const branchRoutes = require('./routes/branchRoutes');
const couponRoutes = require('./routes/couponRoutes');
const { scheduleNotificationCleanup } = require('./utils/notificationCleanup');
const cors = require("cors");
const cookieParser = require('cookie-parser');

const app = express();

// Connect to database
connectDB();
require('./config/firebaseAdmin');

// CORS config
const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [];

const defaultOrigins = [
  "https://app.relaxfeet.in",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5001",
  "http://127.0.0.1:5173",
  "https://venerable-speculoos-4a9a31.netlify.app",

];

const allowedOrigins = [...new Set([...envOrigins, ...defaultOrigins])];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      console.log('Blocked Origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 200,
};

// Manual CORS middleware (runs first, most reliable on Render/Netlify setups)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Answer preflight immediately
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(cors(corsOptions));
// Handle preflight OPTIONS requests for all routes explicitly
app.options('*', cors(corsOptions));


// Middleware
app.use(express.json({ limit: '10mb' })); // Increase limit for file uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Routes - ORDER MATTERS!
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes); // This should come before other routes
app.use('/api/categories', categoryRoutes);
app.use('/api/users', userManagementRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/coupons', couponRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to RelaxFeet Server API',
    version: '1.0.0',
    endpoints: {

      test: '/api/test'
    }
  });
});

// Login info route
app.get('/login', (req, res) => {
  res.json({
    message: 'Login endpoint',
    method: 'POST',
    url: '/api/auth/login',
    body: {
      email: 'string (required)',
      password: 'string (required)'
    },
    example: {
      email: 'user@example.com',
      password: 'password123'
    }
  });
});

// Register info route
app.get('/register', (req, res) => {
  res.json({
    message: 'Registration endpoint',
    method: 'POST',
    url: '/api/auth/register',
    body: {
      username: 'string (required)',
      email: 'string (required)',
      password: 'string (required)',
      role: 'string (optional, defaults to superadmin)'
    },
    example: {
      username: 'johndoe',
      email: 'john@example.com',
      password: 'securepassword123',
      role: 'admin'
    }
  });
});
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working' });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
});
const PORT = process.env.PORT || 5000;

// Export the app for testing
module.exports = app;

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server is running @ http://0.0.0.0:${PORT}`);
    console.log(`📁 Upload endpoint: http://0.0.0.0:${PORT}/api/upload/image`);
    scheduleNotificationCleanup();
  });
}