const pool = require('../config/db');
const fs = require('fs');
const path = require('path');

exports.getStudents = async (req, res) => {
    try {
        // Pagination & Search logic
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;

        const search = req.query.search || '';
        const statusFilter = req.query.status || '';

        let query = 'SELECT * FROM students WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) as total FROM students WHERE 1=1';
        let queryParams = [];

        if (search) {
            query += ' AND (first_name LIKE ? OR last_name LIKE ? OR student_id_code LIKE ?)';
            countQuery += ' AND (first_name LIKE ? OR last_name LIKE ? OR student_id_code LIKE ?)';
            const searchParam = `%${search}%`;
            queryParams.push(searchParam, searchParam, searchParam);
        }

        if (statusFilter) {
            query += ' AND status = ?';
            countQuery += ' AND status = ?';
            queryParams.push(statusFilter);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

        // Add limit/offset to params for the main query
        const queryParamsWithPagination = [...queryParams, limit, offset];

        const [students] = await pool.query(query, queryParamsWithPagination);

        // Use a separate array for count query (no limit/offset)
        const [countResult] = await pool.query(countQuery, queryParams);
        const totalPages = Math.ceil(countResult[0].total / limit);

        res.render('students/index', {
            title: 'Students | EduManage',
            students,
            currentPage: page,
            totalPages: Math.ceil(countResult[0].total / limit),
            search,
            statusFilter,
            // Precomputed — no ternaries in view
            isActiveSelected: statusFilter === 'Active' ? 'selected' : '',
            isInactiveSelected: statusFilter === 'Inactive' ? 'selected' : '',
            isGraduatedSelected: statusFilter === 'Graduated' ? 'selected' : '',
            isAllSelected: statusFilter === '' ? 'selected' : ''
        });
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Error loading students.');
        res.redirect('/dashboard');
    }
};

exports.renderCreateForm = (req, res) => {
    res.render('students/form', {
        title: 'Add Student | EduManage',
        student: null,
        action: '/students/create'
    });
};

exports.createStudent = async (req, res) => {
    try {
        const { first_name, last_name, gender, dob, phone, address, enrollment_date, guardian_name, guardian_phone, status } = req.body;

        // Generate Student ID
        const dateYear = new Date().getFullYear();
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const student_id_code = `STU-${dateYear}-${randomNum}`;

        const profile_photo = req.file ? `/uploads/profiles/${req.file.filename}` : 'default-avatar.png';

        await pool.query(`
            INSERT INTO students 
            (student_id_code, first_name, last_name, gender, dob, phone, address, profile_photo, enrollment_date, guardian_name, guardian_phone, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [student_id_code, first_name, last_name, gender, dob, phone, address, profile_photo, enrollment_date, guardian_name, guardian_phone, status]);

        req.flash('success_msg', 'Student added successfully.');
        res.redirect('/students');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Failed to add student. Check server logs.');
        res.redirect('/students/create');
    }
};

exports.renderEditForm = async (req, res) => {
    try {
        const [students] = await pool.query('SELECT * FROM students WHERE id = ?', [req.params.id]);
        if (students.length === 0) return res.redirect('/students');

        res.render('students/form', {
            title: 'Edit Student | EduManage',
            student: students[0],
            action: `/students/edit/${req.params.id}`
        });
    } catch (error) {
        console.error(error);
        res.redirect('/students');
    }
};

exports.updateStudent = async (req, res) => {
    try {
        const { first_name, last_name, gender, dob, phone, address, enrollment_date, guardian_name, guardian_phone, status } = req.body;
        const studentId = req.params.id;

        // Get existing photo
        const [existing] = await pool.query('SELECT profile_photo FROM students WHERE id = ?', [studentId]);
        let profile_photo = existing[0].profile_photo;

        if (req.file) {
            profile_photo = `/uploads/profiles/${req.file.filename}`;
            // Delete old photo if it's not the default
            if (existing[0].profile_photo !== 'default-avatar.png') {
                const oldPath = path.join(__dirname, '../../public', existing[0].profile_photo);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
        }

        await pool.query(`
            UPDATE students SET 
            first_name=?, last_name=?, gender=?, dob=?, phone=?, address=?, profile_photo=?, enrollment_date=?, guardian_name=?, guardian_phone=?, status=?
            WHERE id=?
        `, [first_name, last_name, gender, dob, phone, address, profile_photo, enrollment_date, guardian_name, guardian_phone, status, studentId]);

        req.flash('success_msg', 'Student updated successfully.');
        res.redirect('/students');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Failed to update student.');
        res.redirect(`/students/edit/${req.params.id}`);
    }
};

exports.deleteStudent = async (req, res) => {
    try {
        // Soft delete (Archive)
        await pool.query("UPDATE students SET status = 'Inactive' WHERE id = ?", [req.params.id]);
        req.flash('success_msg', 'Student archived successfully.');
        res.redirect('/students');
    } catch (error) {
        console.error(error);
        req.flash('error_msg', 'Failed to archive student.');
        res.redirect('/students');
    }
};