const pool = require('../config/db');

// ============================================================
// HELPER: Detect API requests so we can respond with JSON
// ============================================================
const wantsJSON = (req) => {
    return (
        req.xhr ||
        req.originalUrl.startsWith('/api/') ||
        (req.headers.accept && req.headers.accept.includes('application/json'))
    );
};

// ============================================================
// 1. isAuthenticated
// Ensures a user is logged in AND that the account still
// exists and is active in the database (catches deleted or
// suspended users with an active session).
// ============================================================
const isAuthenticated = async (req, res, next) => {
    try {
        // Not logged in at all
        if (!req.session || !req.session.user) {
            if (wantsJSON(req)) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required.'
                });
            }
            req.flash('error_msg', 'Please log in to access this page.');
            return res.redirect('/login');
        }

        // Verify the user still exists and is active
        const [rows] = await pool.query(
            `SELECT u.id, u.email, u.status, r.name AS role_name
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.id = ?`,
            [req.session.user.id]
        );

        // User was deleted while logged in
        if (rows.length === 0) {
            return req.session.destroy(() => {
                res.clearCookie('connect.sid');
                if (wantsJSON(req)) {
                    return res.status(401).json({ success: false, message: 'Session invalid.' });
                }
                res.redirect('/login');
            });
        }

        // User was suspended while logged in
        if (rows[0].status !== 'active') {
            return req.session.destroy(() => {
                res.clearCookie('connect.sid');
                if (wantsJSON(req)) {
                    return res.status(401).json({ success: false, message: 'Account suspended.' });
                }
                req.flash('error_msg', 'Your account has been suspended.');
                res.redirect('/login');
            });
        }

        // Keep session in sync with DB (in case role changed)
        req.session.user = {
            id: rows[0].id,
            email: rows[0].email,
            role: rows[0].role_name
        };

        next();
    } catch (err) {
        console.error('Auth middleware error:', err);
        if (wantsJSON(req)) {
            return res.status(500).json({ success: false, message: 'Authentication error.' });
        }
        req.flash('error_msg', 'Authentication error. Please try again.');
        res.redirect('/login');
    }
};

// ============================================================
// 2. authorizeRoles(...roles)
// Restricts a route to specific role names.
// - If user is NOT logged in -> redirect to /login
// - If user IS logged in but lacks permission -> 403 Forbidden
//   (NOT redirect to login — that confuses logged-in users!)
// ============================================================
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            if (wantsJSON(req)) {
                return res.status(401).json({ success: false, message: 'Authentication required.' });
            }
            req.flash('error_msg', 'Please log in to access this page.');
            return res.redirect('/login');
        }

        const userRole = req.session.user.role;

        if (allowedRoles.includes(userRole)) {
            return next();
        }

        // Log unauthorized access attempts
        pool.query(
            'INSERT INTO activity_logs (user_id, action, description, ip_address) VALUES (?, ?, ?, ?)',
            [
                req.session.user.id,
                'UNAUTHORIZED_ACCESS',
                `Attempted to access ${req.originalUrl} (requires: ${allowedRoles.join(', ')})`,
                req.ip
            ]
        ).catch(e => console.error('Log error:', e));

        if (wantsJSON(req)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to access this resource.'
            });
        }

        // Render a 403 page instead of redirecting to /login
        return res.status(403).render('errors/403', {
            title: 'Access Denied | EduManage',
            user: req.session.user,
            requiredRoles: allowedRoles
        });
    };
};

// ============================================================
// 3. Shortcut role guards (used heavily in Part 4+)
// ============================================================
const isSuperAdmin = authorizeRoles('Super Admin');
const isAdmin = authorizeRoles('Super Admin', 'Administrator');
const isStaff = authorizeRoles('Super Admin', 'Administrator', 'Teacher');
const isStudent = authorizeRoles('Student');

// ============================================================
// 4. guestOnly
// Prevents already-logged-in users from visiting /login or /register
// ============================================================
const guestOnly = (req, res, next) => {
    if (req.session && req.session.user) {
        return res.redirect('/dashboard');
    }
    next();
};

// ============================================================
// 5. attachUser (optional utility)
// Populates res.locals.user and req.user for any handler.
// Useful if you want to skip the DB check on public pages.
// ============================================================
const attachUser = (req, res, next) => {
    req.user = req.session.user || null;
    res.locals.user = req.user;
    next();
};

module.exports = {
    isAuthenticated,
    authorizeRoles,
    requireRole: authorizeRoles, // Alias for readability
    isSuperAdmin,
    isAdmin,
    isStaff,
    isStudent,
    guestOnly,
    attachUser
};