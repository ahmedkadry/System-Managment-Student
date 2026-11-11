const pool = require('../config/db');
const bcrypt = require('bcrypt');

exports.getTeachers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';

        let where = ' WHERE 1=1';
        const params = [];
        if (search) {
            where += ' AND (t.first_name LIKE ? OR t.last_name LIKE ? OR t.teacher_id_code LIKE ? OR u.email LIKE ?)';
            const p = `%${search}%`;
            params.push(p, p, p, p);
        }

        const [teachers] = await pool.query(
            `SELECT t.*, u.email, d.name AS department_name
             FROM teachers t
             JOIN users u ON t.user_id = u.id
             LEFT JOIN departments d ON t.department_id = d.id
             ${where}
             ORDER BY t.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM teachers t JOIN users u ON t.user_id = u.id ${where}`,
            params
        );

        res.render('teachers/index', {
            title: 'Teachers | EduManage',
            teachers,
            currentPage: page,
            totalPages: Math.ceil(countResult[0].total / limit),
            search
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error loading teachers.');
        res.redirect('/dashboard');
    }
};

exports.renderCreateForm = async (req, res) => {
    const [departments] = await pool.query('SELECT * FROM departments ORDER BY name');
    res.render('teachers/form', {
        title: 'Add Teacher | EduManage',
        teacher: null,
        departments,
        action: '/teachers/create'
    });
};

exports.createTeacher = async (req, res) => {
    const { first_name, last_name, email, password, phone, department_id, specialization, hire_date } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Check email uniqueness
        const [existing] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            await connection.rollback();
            req.flash('error_msg', 'Email already registered.');
            return res.redirect('/teachers/create');
        }

        const [role] = await connection.query("SELECT id FROM roles WHERE name = 'Teacher'");
        const hashedPassword = await bcrypt.hash(password, 10);

        const [userResult] = await connection.query(
            'INSERT INTO users (role_id, email, password_hash) VALUES (?, ?, ?)',
            [role[0].id, email, hashedPassword]
        );

        const year = new Date().getFullYear();
        const code = `TCH-${year}-${Math.floor(1000 + Math.random() * 9000)}`;

        await connection.query(
            `INSERT INTO teachers (user_id, teacher_id_code, first_name, last_name, phone, department_id, specialization, hire_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userResult.insertId, code, first_name, last_name, phone || null, department_id || null, specialization || null, hire_date]
        );

        await connection.commit();
        req.flash('success_msg', `Teacher created. ID: ${code}`);
        res.redirect('/teachers');
    } catch (err) {
        await connection.rollback();
        console.error(err);
        req.flash('error_msg', 'Failed to create teacher.');
        res.redirect('/teachers/create');
    } finally {
        connection.release();
    }
};

exports.renderEditForm = async (req, res) => {
    const [teachers] = await pool.query(
        `SELECT t.*, u.email FROM teachers t JOIN users u ON t.user_id = u.id WHERE t.id = ?`,
        [req.params.id]
    );
    if (teachers.length === 0) return res.redirect('/teachers');
    const [departments] = await pool.query('SELECT * FROM departments ORDER BY name');

    res.render('teachers/form', {
        title: 'Edit Teacher | EduManage',
        teacher: teachers[0],
        departments,
        action: `/teachers/edit/${req.params.id}`
    });
};

exports.updateTeacher = async (req, res) => {
    const { first_name, last_name, email, password, phone, department_id, specialization, hire_date } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [teachers] = await connection.query('SELECT user_id FROM teachers WHERE id = ?', [req.params.id]);
        if (teachers.length === 0) throw new Error('Teacher not found');

        await connection.query('UPDATE users SET email = ? WHERE id = ?', [email, teachers[0].user_id]);

        // Optional password reset
        if (password && password.length >= 6) {
            const hash = await bcrypt.hash(password, 10);
            await connection.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, teachers[0].user_id]);
        }

        await connection.query(
            `UPDATE teachers SET first_name=?, last_name=?, phone=?, department_id=?, specialization=?, hire_date=? WHERE id=?`,
            [first_name, last_name, phone || null, department_id || null, specialization || null, hire_date, req.params.id]
        );

        await connection.commit();
        req.flash('success_msg', 'Teacher updated.');
        res.redirect('/teachers');
    } catch (err) {
        await connection.rollback();
        console.error(err);
        req.flash('error_msg', 'Failed to update teacher.');
        res.redirect(`/teachers/edit/${req.params.id}`);
    } finally {
        connection.release();
    }
};

exports.deleteTeacher = async (req, res) => {
    try {
        const [teachers] = await pool.query('SELECT user_id FROM teachers WHERE id = ?', [req.params.id]);
        if (teachers.length > 0) {
            await pool.query('UPDATE users SET status = "suspended" WHERE id = ?', [teachers[0].user_id]);
            await pool.query("UPDATE teachers SET status = 'Inactive' WHERE id = ?", [req.params.id]);
        }
        req.flash('success_msg', 'Teacher archived.');
        res.redirect('/teachers');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to archive teacher.');
        res.redirect('/teachers');
    }
};