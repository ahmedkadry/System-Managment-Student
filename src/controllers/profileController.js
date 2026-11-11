const pool = require('../config/db');
const bcrypt = require('bcrypt');

exports.renderProfile = async (req, res) => {
    try {
        const [users] = await pool.query(
            `SELECT u.id, u.email, u.created_at, r.name AS role_name
             FROM users u JOIN roles r ON u.role_id = r.id
             WHERE u.id = ?`,
            [req.session.user.id]
        );
        if (users.length === 0) return res.redirect('/login');
        const user = users[0];

        // Load linked student/teacher profile if exists
        let linked = null;
        if (user.role_name === 'Student') {
            const [rows] = await pool.query('SELECT * FROM students WHERE user_id = ?', [user.id]);
            linked = rows[0] || null;
        } else if (user.role_name === 'Teacher') {
            const [rows] = await pool.query('SELECT * FROM teachers WHERE user_id = ?', [user.id]);
            linked = rows[0] || null;
        }

        // Precompute display name + avatar
        let displayName = user.email.split('@')[0];
        let avatar = '/images/default-avatar.svg';
        if (linked) {
            displayName = linked.first_name + ' ' + linked.last_name;
            if (linked.profile_photo && linked.profile_photo !== 'default-avatar.png') {
                avatar = linked.profile_photo;
            }
        }

        const createdDate = new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        res.render('profile/index', {
            title: 'My Profile | EduManage',
            user,
            linked,
            displayName,
            avatar,
            createdDate
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error loading profile.');
        res.redirect('/dashboard');
    }
};

exports.changePassword = async (req, res) => {
    try {
        const { current_password, new_password, confirm_password } = req.body;

        if (!current_password || !new_password || !confirm_password) {
            req.flash('error_msg', 'All password fields are required.');
            return res.redirect('/profile');
        }
        if (new_password.length < 6) {
            req.flash('error_msg', 'New password must be at least 6 characters.');
            return res.redirect('/profile');
        }
        if (new_password !== confirm_password) {
            req.flash('error_msg', 'New passwords do not match.');
            return res.redirect('/profile');
        }

        const [users] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.session.user.id]);
        if (users.length === 0) return res.redirect('/login');

        const ok = await bcrypt.compare(current_password, users[0].password_hash);
        if (!ok) {
            req.flash('error_msg', 'Current password is incorrect.');
            return res.redirect('/profile');
        }

        const hash = await bcrypt.hash(new_password, 10);
        await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.session.user.id]);

        // Log activity
        pool.query(
            'INSERT INTO activity_logs (user_id, action, description, ip_address) VALUES (?, ?, ?, ?)',
            [req.session.user.id, 'PASSWORD_CHANGE', 'User changed their password', req.ip]
        ).catch(() => { });

        req.flash('success_msg', 'Password updated successfully.');
        res.redirect('/profile');
    } catch (err) {
        console.error('changePassword:', err);
        req.flash('error_msg', 'Failed to update password.');
        res.redirect('/profile');
    }
};