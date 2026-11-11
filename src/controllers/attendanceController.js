const pool = require('../config/db');

// Step 1: Select course + date
exports.index = async (req, res) => {
    try {
        const [courses] = await pool.query(
            `SELECT c.id, c.course_code, c.name, CONCAT(t.first_name, ' ', t.last_name) AS teacher_name
             FROM courses c LEFT JOIN teachers t ON c.teacher_id = t.id
             ORDER BY c.name`
        );
        res.render('attendance/index', {
            title: 'Attendance | EduManage',
            courses,
            selectedCourse: req.query.course || ''
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error loading attendance.');
        res.redirect('/dashboard');
    }
};

// Step 2: Mark attendance page
exports.renderMarkPage = async (req, res) => {
    const { course, date } = req.query;
    if (!course || !date) return res.redirect('/attendance');

    try {
        const [courseData] = await pool.query('SELECT id, name, course_code FROM courses WHERE id = ?', [course]);
        if (courseData.length === 0) return res.redirect('/attendance');

        const [students] = await pool.query(
            `SELECT s.id, s.first_name, s.last_name, s.student_id_code, s.profile_photo,
                    a.status AS attendance_status
             FROM course_enrollments ce
             JOIN students s ON s.id = ce.student_id
             LEFT JOIN attendance a ON a.student_id = s.id AND a.course_id = ? AND a.date = ?
             WHERE ce.course_id = ? AND ce.status = 'Enrolled' AND s.status = 'Active'
             ORDER BY s.first_name`,
            [course, date, course]
        );

        res.render('attendance/mark', {
            title: 'Mark Attendance | EduManage',
            course: courseData[0],
            date,
            students
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error loading attendance.');
        res.redirect('/attendance');
    }
};

// Step 3: Save
exports.saveAttendance = async (req, res) => {
    const { course_id, date, attendance } = req.body;
    if (!course_id || !date || !attendance) return res.redirect('/attendance');

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        for (const [studentId, status] of Object.entries(attendance)) {
            if (!['Present', 'Absent', 'Late', 'Excused'].includes(status)) continue;
            await connection.query(
                `INSERT INTO attendance (student_id, course_id, date, status) VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE status = VALUES(status)`,
                [studentId, course_id, date, status]
            );
        }
        await connection.commit();
        req.flash('success_msg', 'Attendance saved.');
        res.redirect(`/attendance/reports?course=${course_id}`);
    } catch (err) {
        await connection.rollback();
        console.error(err);
        req.flash('error_msg', 'Failed to save attendance.');
        res.redirect(`/attendance/mark?course=${course_id}&date=${date}`);
    } finally {
        connection.release();
    }
};

// Step 4: Reports
exports.reports = async (req, res) => {
    const courseId = req.query.course || '';
    const from = req.query.from || '';
    const to = req.query.to || '';

    try {
        const [courses] = await pool.query('SELECT id, name, course_code FROM courses ORDER BY name');

        let records = [];
        let stats = { total: 0, present: 0, absent: 0, late: 0, excused: 0 };

        if (courseId) {
            let sql = `SELECT a.*, s.first_name, s.last_name, s.student_id_code
                       FROM attendance a JOIN students s ON a.student_id = s.id
                       WHERE a.course_id = ?`;
            const params = [courseId];
            if (from) { sql += ' AND a.date >= ?'; params.push(from); }
            if (to) { sql += ' AND a.date <= ?'; params.push(to); }
            sql += ' ORDER BY a.date DESC, s.first_name';

            [records] = await pool.query(sql, params);

            // Compute stats
            stats.total = records.length;
            for (const r of records) {
                if (r.status === 'Present') stats.present++;
                else if (r.status === 'Absent') stats.absent++;
                else if (r.status === 'Late') stats.late++;
                else if (r.status === 'Excused') stats.excused++;
            }
        }

        res.render('attendance/reports', {
            title: 'Attendance Reports | EduManage',
            courses, records, stats,
            filters: { course: courseId, from, to }
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error loading reports.');
        res.redirect('/attendance');
    }
};