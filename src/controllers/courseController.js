const pool = require('../config/db');
/*
exports.getCourses = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';

        let where = ' WHERE 1=1';
        const params = [];
        if (search) {
            where += ' AND (c.name LIKE ? OR c.course_code LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        const [courses] = await pool.query(
            `SELECT c.*, d.name AS department_name, 
                CONCAT(t.first_name, ' ', t.last_name) AS teacher_name,
                (SELECT COUNT(*) FROM course_enrollments ce WHERE ce.course_id = c.id AND ce.status = 'Enrolled') AS enrolled_count
             FROM courses c
             LEFT JOIN departments d ON c.department_id = d.id
             LEFT JOIN teachers t ON c.teacher_id = t.id
             ${where}
             ORDER BY c.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM courses c ${where}`, params);

        // In getCourses:
        const departmentFilter = req.query.department || '';

        if (search) {
            where += ' AND (c.name LIKE ? OR c.course_code LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        if (departmentFilter) {
            where += ' AND c.department_id = ?';
            params.push(departmentFilter);
        }

        // Fetch departments for the dropdown
        const [departments] = await pool.query('SELECT id, name FROM departments ORDER BY name');


        res.render('courses/index', {
            title: 'Courses | EduManage',
            courses,
            currentPage: page,
            totalPages: Math.ceil(countResult[0].total / limit),
            search,
            departments,
            departmentFilter
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error loading courses.');
        res.redirect('/dashboard');
    }
};

*/

exports.getCourses = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';

        let where = ' WHERE 1=1';
        const params = [];
        if (search) {
            where += ' AND (c.name LIKE ? OR c.course_code LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        const [courses] = await pool.query(
            `SELECT c.*, d.name AS department_name,
                    CONCAT(t.first_name, ' ', t.last_name) AS teacher_name,
                    (SELECT COUNT(*) FROM course_enrollments ce
                     WHERE ce.course_id = c.id AND ce.status = 'Enrolled') AS enrolled_count
             FROM courses c
             LEFT JOIN departments d ON c.department_id = d.id
             LEFT JOIN teachers t ON c.teacher_id = t.id
             ${where}
             ORDER BY c.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM courses c ${where}`,
            params
        );

        res.render('courses/index', {
            title: 'Courses | EduManage',
            courses,
            currentPage: page,
            totalPages: Math.ceil(countResult[0].total / limit),
            search
            // ← NO statusFilter — this is critical
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error loading courses.');
        res.redirect('/dashboard');
    }
};

exports.renderCreateForm = async (req, res) => {
    const [teachers] = await pool.query("SELECT t.id, t.first_name, t.last_name FROM teachers t WHERE t.status = 'Active' ORDER BY t.first_name");
    const [departments] = await pool.query('SELECT * FROM departments ORDER BY name');
    res.render('courses/form', {
        title: 'Add Course | EduManage',
        course: null,
        teachers,
        departments,
        action: '/courses/create'
    });
};

exports.createCourse = async (req, res) => {
    const { course_code, name, description, department_id, credit_hours, teacher_id } = req.body;
    try {
        await pool.query(
            `INSERT INTO courses (course_code, name, description, department_id, credit_hours, teacher_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [course_code, name, description || null, department_id || null, credit_hours, teacher_id || null]
        );
        req.flash('success_msg', 'Course created.');
        res.redirect('/courses');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', err.code === 'ER_DUP_ENTRY' ? 'Course code already exists.' : 'Failed to create course.');
        res.redirect('/courses/create');
    }
};

exports.renderEditForm = async (req, res) => {
    const [courses] = await pool.query('SELECT * FROM courses WHERE id = ?', [req.params.id]);
    if (courses.length === 0) return res.redirect('/courses');
    const [teachers] = await pool.query("SELECT t.id, t.first_name, t.last_name FROM teachers t WHERE t.status = 'Active' ORDER BY t.first_name");
    const [departments] = await pool.query('SELECT * FROM departments ORDER BY name');

    res.render('courses/form', {
        title: 'Edit Course | EduManage',
        course: courses[0],
        teachers,
        departments,
        action: `/courses/edit/${req.params.id}`
    });
};

exports.updateCourse = async (req, res) => {
    const { course_code, name, description, department_id, credit_hours, teacher_id } = req.body;
    try {
        await pool.query(
            `UPDATE courses SET course_code=?, name=?, description=?, department_id=?, credit_hours=?, teacher_id=? WHERE id=?`,
            [course_code, name, description || null, department_id || null, credit_hours, teacher_id || null, req.params.id]
        );
        req.flash('success_msg', 'Course updated.');
        res.redirect('/courses');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to update course.');
        res.redirect(`/courses/edit/${req.params.id}`);
    }
};

exports.deleteCourse = async (req, res) => {
    try {
        const [enrollments] = await pool.query(
            "SELECT COUNT(*) as c FROM course_enrollments WHERE course_id = ? AND status = 'Enrolled'",
            [req.params.id]
        );
        if (enrollments[0].c > 0) {
            req.flash('error_msg', 'Cannot delete course with enrolled students. Unenroll them first.');
            return res.redirect('/courses');
        }
        await pool.query('DELETE FROM courses WHERE id = ?', [req.params.id]);
        req.flash('success_msg', 'Course deleted.');
        res.redirect('/courses');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to delete course.');
        res.redirect('/courses');
    }
};

// ============ COURSE DETAILS + ENROLLMENT ============
exports.showCourse = async (req, res) => {
    try {
        const [courses] = await pool.query(
            `SELECT c.*, d.name AS department_name, CONCAT(t.first_name, ' ', t.last_name) AS teacher_name
             FROM courses c LEFT JOIN departments d ON c.department_id = d.id
             LEFT JOIN teachers t ON c.teacher_id = t.id WHERE c.id = ?`,
            [req.params.id]
        );
        if (courses.length === 0) return res.redirect('/courses');

        const [enrolled] = await pool.query(
            `SELECT ce.id AS enrollment_id, s.id AS student_id, s.student_id_code, s.first_name, s.last_name, s.profile_photo
             FROM course_enrollments ce JOIN students s ON ce.student_id = s.id
             WHERE ce.course_id = ? AND ce.status = 'Enrolled' ORDER BY s.first_name`,
            [req.params.id]
        );

        const [available] = await pool.query(
            `SELECT id, student_id_code, first_name, last_name FROM students
             WHERE status = 'Active' AND id NOT IN (SELECT student_id FROM course_enrollments WHERE course_id = ? AND status = 'Enrolled')
             ORDER BY first_name`,
            [req.params.id]
        );

        res.render('courses/show', {
            title: 'Course Details | EduManage',
            course: courses[0],
            enrolled,
            available
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error loading course.');
        res.redirect('/courses');
    }
};

exports.enrollStudent = async (req, res) => {
    const { student_id } = req.body;
    try {
        await pool.query(
            `INSERT INTO course_enrollments (student_id, course_id) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE status = 'Enrolled'`,
            [student_id, req.params.id]
        );
        req.flash('success_msg', 'Student enrolled.');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to enroll student.');
    }
    res.redirect(`/courses/${req.params.id}`);
};

exports.unenrollStudent = async (req, res) => {
    try {
        await pool.query(
            'UPDATE course_enrollments SET status = "Dropped" WHERE id = ? AND course_id = ?',
            [req.params.enrollmentId, req.params.id]
        );
        req.flash('success_msg', 'Student unenrolled.');
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Failed to unenroll.');
    }
    res.redirect(`/courses/${req.params.id}`);
};