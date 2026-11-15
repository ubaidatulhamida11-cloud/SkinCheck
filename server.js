const express = require('express');
const path = require('path');
const session = require('express-session');
const app = express();
const PORT = process.env.PORT || 3000;

// Prevent server from crashing on unhandled promise rejections (e.g., from Gemini AI quota limits)
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

// Configuration & DB Migration
require('./src/config/env');
const { runMigration } = require('./src/database/migrate');
runMigration();

// Setup View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'skincheck-mvp-super-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Pass user session to all views automatically
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// Routes
const indexRoutes = require('./src/routes/indexRoutes');
const authRoutes = require('./src/routes/authRoutes');
const onboardingRoutes = require('./src/routes/onboardingRoutes');
const customerRoutes = require('./src/routes/customerRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const apiAuthRoutes = require('./src/routes/apiAuthRoutes');

app.use('/', indexRoutes);
app.use('/auth', authRoutes);
app.use('/api/auth', apiAuthRoutes);
app.use('/onboarding', onboardingRoutes);
app.use('/app', customerRoutes);
app.use('/admin', adminRoutes);

// 404 Handler
app.use((req, res) => {
    res.status(404).send('404: Page not found');
});

app.listen(PORT, () => {
    console.log(`SkinCheck Server running on http://localhost:${PORT}`);
});
