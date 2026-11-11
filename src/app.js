// ============================================================
// EduManage — Express Application Entry
// Middleware ORDER matters: session → flash → timeouts → locals → routes
// ============================================================
// require('../database/seed')
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const session = require('express-session');
require('dotenv').config();

async function kConnection() {
    const PoolConnection = require('./config/db')
    await PoolConnection
}

kConnection();


const app = express();

// ============================================================
// 1. SECURITY HEADERS
// ============================================================
app.use(helmet({
    contentSecurityPolicy: false, // Disabled for CDN-based Tailwind/Chart.js in dev
    crossOriginEmbedderPolicy: false
}));

// ============================================================
// 2. BODY PARSERS
// ============================================================
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ============================================================
// 3. STATIC FILES
// ============================================================
app.use(express.static(path.join(__dirname, '../public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0
}));

// ============================================================
// 4. VIEW ENGINE (EJS) + LAYOUTS
// ============================================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.set('trust proxy', 1); // for secure cookies behind reverse proxy

const expressLayouts = require('express-ejs-layouts');
app.use(expressLayouts);
app.set('layout', 'layouts/dashboard');
app.set('layout extractScripts', false);
app.set('layout extractStyles', false);

// ============================================================
// 5. SESSION
// ============================================================
const SESSION_MAX_AGE = (parseInt(process.env.SESSION_MAX_AGE_HOURS) || 24) * 60 * 60 * 1000;
const SESSION_IDLE_TIMEOUT = (parseInt(process.env.SESSION_IDLE_MINUTES) || 30) * 60 * 1000;
const SESSION_REMEMBER_AGE = (parseInt(process.env.SESSION_REMEMBER_DAYS) || 30) * 24 * 60 * 60 * 1000;

app.use(session({
    name: 'edumanage.sid',
    secret: process.env.SESSION_SECRET || 'dev_secret_fallback_change_me',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_MAX_AGE
    }
}));

// ============================================================
// 6. FLASH (connect-flash with manual fallback)
// ============================================================
try {
    const flash = require('connect-flash');
    app.use(flash());
    console.log('✅ connect-flash loaded');
} catch (err) {
    console.warn('⚠️ connect-flash not installed — using manual fallback');
    app.use((req, res, next) => {
        req.session.flash = req.session.flash || {};
        req.flash = function (type, message) {
            const bucket = req.session.flash[type] || [];
            if (message !== undefined) {
                bucket.push(message);
                req.session.flash[type] = bucket;
                return bucket;
            }
            req.session.flash[type] = [];
            return bucket;
        };
        next();
    });
}

// ============================================================
// 7. IDLE TIMEOUT — logged-in users only
// ============================================================
app.use((req, res, next) => {
    if (!req.session || !req.session.user) return next();

    const now = Date.now();
    const last = req.session.lastActivity || now;
    const idle = now - last;

    // Remember-me users skip idle timeout
    if (req.session.rememberMe) {
        req.session.lastActivity = now;
        return next();
    }

    if (idle > SESSION_IDLE_TIMEOUT) {
        return req.session.destroy(() => {
            res.clearCookie('edumanage.sid');
            return res.redirect('/login?timeout=idle');
        });
    }

    req.session.lastActivity = now;
    next();
});

// ============================================================
// 8. ABSOLUTE EXPIRY — logged-in users only
// ============================================================
app.use((req, res, next) => {
    if (!req.session || !req.session.user) return next();

    if (!req.session.createdAt) {
        req.session.createdAt = Date.now();
        return next();
    }

    const age = Date.now() - req.session.createdAt;
    const max = req.session.rememberMe ? SESSION_REMEMBER_AGE : SESSION_MAX_AGE;

    if (age > max) {
        return req.session.destroy(() => {
            res.clearCookie('edumanage.sid');
            return res.redirect('/login?timeout=absolute');
        });
    }

    next();
});

// ============================================================
// 9. GLOBAL LOCALS (must come AFTER flash, BEFORE routes)
// ============================================================
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg') || [];
    res.locals.error_msg = req.flash('error_msg') || [];
    res.locals.user = req.session.user || null;
    res.locals.currentPath = req.path;
    next();
});

// ============================================================
// 9b. CURRENT PAGE (for sidebar active state)
// ============================================================
app.use((req, res, next) => {
    const p = req.path;
    let page = '';
    if (p === '/' || p.indexOf('/dashboard') === 0) page = 'dashboard';
    else if (p.indexOf('/students') === 0) page = 'students';
    else if (p.indexOf('/teachers') === 0) page = 'teachers';
    else if (p.indexOf('/courses') === 0) page = 'courses';
    else if (p.indexOf('/attendance') === 0) page = 'attendance';
    else if (p.indexOf('/exams') === 0) page = 'exams';
    else if (p.indexOf('/reports') === 0) page = 'reports';
    else if (p.indexOf('/profile') === 0) page = 'profile';

    res.locals.currentPage = page;

    const u = req.session.user;
    const role = u ? u.role : '';
    const email = u ? u.email : '';
    const initial = email ? email.charAt(0).toUpperCase() : '?';

    const isSuperAdmin = role === 'Super Admin';
    const isAdmin = role === 'Administrator';
    const isTeacher = role === 'Teacher';

    const canDashboard = isSuperAdmin || isAdmin || isTeacher;
    const canManage = isSuperAdmin || isAdmin;
    const canStaff = isSuperAdmin || isAdmin || isTeacher;

    const linkBase = 'flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors ';
    const iconBase = 'w-5 h-5 ';
    const activeLink = 'bg-brand-violet/20 text-brand-violet font-medium';
    const inactiveLink = 'text-gray-300 hover:text-white hover:bg-brand-violet/10';
    const activeIcon = 'text-brand-violet';
    const inactiveIcon = 'text-gray-400';

    function linkClass(key) {
        if (page === key) return linkBase + activeLink;
        return linkBase + inactiveLink;
    }
    function iconClass(key) {
        if (page === key) return iconBase + activeIcon;
        return iconBase + inactiveIcon;
    }

    res.locals.sidebar = {
        email: email,
        role: role,
        initial: initial,
        canDashboard: canDashboard,
        canManage: canManage,
        canStaff: canStaff,
        dashLink: linkClass('dashboard'),
        dashIcon: iconClass('dashboard'),
        studentsLink: linkClass('students'),
        studentsIcon: iconClass('students'),
        teachersLink: linkClass('teachers'),
        teachersIcon: iconClass('teachers'),
        coursesLink: linkClass('courses'),
        coursesIcon: iconClass('courses'),
        attendanceLink: linkClass('attendance'),
        attendanceIcon: iconClass('attendance'),
        examsLink: linkClass('exams'),
        examsIcon: iconClass('exams'),
        reportsLink: linkClass('reports'),
        reportsIcon: iconClass('reports'),
        profileLink: linkClass('profile'),
        profileIcon: iconClass('profile')
    };

    next();
});
// ============================================================
// 10. VIEW HELPERS
// ============================================================
app.locals.avatarUrl = function (photo) {
    const fallback = '/images/default-avatar.svg';
    if (!photo || typeof photo !== 'string' || photo === '' || photo === 'default-avatar.png') {
        return fallback;
    }
    if (photo.indexOf('http://') === 0 || photo.indexOf('https://') === 0) return photo;
    if (photo.charAt(0) === '/') return photo;
    return '/' + photo;
};

app.locals.formatDate = function (date) {
    if (!date) return '';
    try { return new Date(date).toLocaleDateString(); }
    catch (e) { return ''; }
};

app.locals.timeAgo = function (date) {
    if (!date) return '';
    const sec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (sec < 60) return 'just now';
    if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
    if (sec < 86400) return Math.floor(sec / 3600) + 'h ago';
    if (sec < 604800) return Math.floor(sec / 86400) + 'd ago';
    return new Date(date).toLocaleDateString();
};

app.locals.truncate = function (str, len) {
    if (!str) return '';
    if (str.length <= len) return str;
    return str.substring(0, len) + '…';
};

// ============================================================
// 11. ROUTES
// ============================================================
const authRoutes = require('./routes/web/authRoutes');
const dashboardRoutes = require('./routes/web/dashboardRoutes');
const studentRoutes = require('./routes/web/studentRoutes');
const teacherRoutes = require('./routes/web/teacherRoutes');
const courseRoutes = require('./routes/web/courseRoutes');
const attendanceRoutes = require('./routes/web/attendanceRoutes');
const examRoutes = require('./routes/web/examRoutes');
const reportRoutes = require('./routes/web/reportRoutes');
const profileRoutes = require('./routes/web/profileRoutes');
const { PoolConnection } = require('mysql2');

// Public landing page (no layout)
app.get('/', (req, res) => {
    res.render('landing/index', {
        title: 'EduManage | Premium Student Management',
        layout: false
    });
});

// Auth (login, register, logout)
app.use('/', authRoutes);

// Authenticated routes
app.use('/', dashboardRoutes);
app.use('/students', studentRoutes);
app.use('/teachers', teacherRoutes);
app.use('/courses', courseRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/exams', examRoutes);
app.use('/reports', reportRoutes);
app.use('/profile', profileRoutes);

// ============================================================
// 12. 404 HANDLER
// ============================================================
app.use((req, res) => {
    // JSON for API
    if (req.path.startsWith('/api/') || req.xhr) {
        return res.status(404).json({ success: false, message: 'Not found' });
    }
    // Try to render a nice 404 view if it exists, else inline
    res.status(404).render('errors/404', {
        title: 'Page Not Found | EduManage',
        layout: false,
        path: req.path
    }, (err, html) => {
        if (err) {
            return res.status(404).send(`
                <div style="font-family:Inter,sans-serif;padding:60px;text-align:center;background:#0B0F19;color:#F8FAFC;min-height:100vh;">
                    <h1 style="font-size:64px;margin:0;color:#8B5CF6;">404</h1>
                    <p style="color:#94A3B8;margin:8px 0 24px;">Page not found: <code>${req.path}</code></p>
                    <a href="/" style="color:#06B6D4;text-decoration:none;">← Back to home</a>
                </div>
            `);
        }
        res.send(html);
    });
});

// ============================================================
// 13. CENTRALIZED ERROR HANDLER
// ============================================================
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err.message);
    console.error(err.stack);

    // Multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        if (req.flash) req.flash('error_msg', 'File too large. Max 2 MB.');
        return res.redirect(req.get('Referer') || '/dashboard');
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        if (req.flash) req.flash('error_msg', 'Invalid file type.');
        return res.redirect(req.get('Referer') || '/dashboard');
    }

    const status = err.status || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Something went wrong. Please try again.'
        : err.message;

    if (req.path.startsWith('/api/') || req.xhr) {
        return res.status(status).json({ success: false, message });
    }

    res.status(status).render('errors/500', {
        title: 'Server Error | EduManage',
        layout: false,
        message: message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
    }, (renderErr, html) => {
        if (renderErr) {
            return res.status(status).send(`
                <div style="font-family:Inter,sans-serif;padding:60px;text-align:center;background:#0B0F19;color:#F8FAFC;min-height:100vh;">
                    <h1 style="font-size:64px;margin:0;color:#EF4444;">500</h1>
                    <p style="color:#94A3B8;margin:8px 0 24px;">${message}</p>
                    <a href="/" style="color:#06B6D4;text-decoration:none;">← Back to home</a>
                </div>
            `);
        }
        res.send(html);
    });
});

module.exports = app;