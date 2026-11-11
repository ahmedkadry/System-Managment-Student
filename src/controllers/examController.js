const pool = require('../config/db');

// ---- LIST EXAMS for a course ----
exports.listExams = async (req, res) => {
    try {
        const [courses] = await pool.query(
            `SELECT c.id, c.course_code, c.name,
                    CONCAT(t.first_name, ' ', t.last_name) AS teacher_name
             FROM courses c
             LEFT JOIN teachers t ON c.teacher_id = t.id
             ORDER BY c.name`
        );

        const courseId = req.query.course || '';
        let exams = [];
        let selectedCourse = null;

        if (courseId) {
            const [courseRows] = await pool.query(
                'SELECT id, course_code, name FROM courses WHERE id = ?',
                [courseId]
            );
            selectedCourse = courseRows[0] || null;

            [exams] = await pool.query(
                `SELECT e.*,
                        (SELECT COUNT(*) FROM grades g WHERE g.exam_id = e.id) AS graded_count
                 FROM exams e
                 WHERE e.course_id = ?
                 ORDER BY e.exam_date DESC`,
                [courseId]
            );
        }

        res.render('exams/index', {
            title: 'Exams | EduManage',
            courses,
            exams,
            selectedCourse,
            selectedCourseId: courseId
        });
    } catch (err) {
        console.error('listExams:', err);
        req.flash('error_msg', 'Error loading exams.');
        res.redirect('/dashboard');
    }
};

// ---- CREATE EXAM FORM ----
exports.renderCreateForm = async (req, res) => {
    try {
        const [courses] = await pool.query('SELECT id, course_code, name FROM courses ORDER BY name');
        res.render('exams/form', {
            title: 'Create Exam | EduManage',
            courses,
            exam: null,
            action: '/exams/create'
        });
    } catch (err) {
        console.error('renderCreateForm:', err);
        res.redirect('/exams');
    }
};

// ---- SAVE EXAM ----
exports.createExam = async (req, res) => {
    try {
        const { course_id, title, exam_date, max_marks, passing_marks } = req.body;
        if (Number(passing_marks) > Number(max_marks)) {
            req.flash('error_msg', 'Passing marks cannot exceed max marks.');
            return res.redirect('/exams/create');
        }
        await pool.query(
            `INSERT INTO exams (course_id, title, exam_date, max_marks, passing_marks)
             VALUES (?, ?, ?, ?, ?)`,
            [course_id, title, exam_date, max_marks, passing_marks]
        );
        req.flash('success_msg', 'Exam created.');
        res.redirect('/exams?course=' + course_id);
    } catch (err) {
        console.error('createExam:', err);
        req.flash('error_msg', 'Failed to create exam.');
        res.redirect('/exams/create');
    }
};

// ---- EDIT EXAM FORM ----
exports.renderEditForm = async (req, res) => {
    try {
        const [exams] = await pool.query('SELECT * FROM exams WHERE id = ?', [req.params.id]);
        if (exams.length === 0) return res.redirect('/exams');
        const [courses] = await pool.query('SELECT id, course_code, name FROM courses ORDER BY name');
        res.render('exams/form', {
            title: 'Edit Exam | EduManage',
            courses,
            exam: exams[0],
            action: '/exams/edit/' + req.params.id
        });
    } catch (err) {
        console.error('renderEditForm:', err);
        res.redirect('/exams');
    }
};

// ---- UPDATE EXAM ----
exports.updateExam = async (req, res) => {
    try {
        const { course_id, title, exam_date, max_marks, passing_marks } = req.body;
        if (Number(passing_marks) > Number(max_marks)) {
            req.flash('error_msg', 'Passing marks cannot exceed max marks.');
            return res.redirect('/exams/edit/' + req.params.id);
        }
        await pool.query(
            `UPDATE exams SET course_id=?, title=?, exam_date=?, max_marks=?, passing_marks=? WHERE id=?`,
            [course_id, title, exam_date, max_marks, passing_marks, req.params.id]
        );
        req.flash('success_msg', 'Exam updated.');
        res.redirect('/exams?course=' + course_id);
    } catch (err) {
        console.error('updateExam:', err);
        req.flash('error_msg', 'Failed to update exam.');
        res.redirect('/exams/edit/' + req.params.id);
    }
};

// ---- DELETE EXAM ----
exports.deleteExam = async (req, res) => {
    try {
        const [exams] = await pool.query('SELECT course_id FROM exams WHERE id = ?', [req.params.id]);
        await pool.query('DELETE FROM exams WHERE id = ?', [req.params.id]);
        req.flash('success_msg', 'Exam deleted.');
        if (exams.length > 0) return res.redirect('/exams?course=' + exams[0].course_id);
        res.redirect('/exams');
    } catch (err) {
        console.error('deleteExam:', err);
        req.flash('error_msg', 'Failed to delete exam.');
        res.redirect('/exams');
    }
};

// ---- GRADE ENTRY PAGE ----
exports.renderGradeEntry = async (req, res) => {
    try {
        const [exams] = await pool.query(
            `SELECT e.*, c.course_code, c.name AS course_name
             FROM exams e JOIN courses c ON e.course_id = c.id
             WHERE e.id = ?`,
            [req.params.id]
        );
        if (exams.length === 0) {
            req.flash('error_msg', 'Exam not found.');
            return res.redirect('/exams');
        }
        const exam = exams[0];

        const [students] = await pool.query(
            `SELECT s.id, s.student_id_code, s.first_name, s.last_name, s.profile_photo,
                    g.marks_obtained, g.id AS grade_id
             FROM course_enrollments ce
             JOIN students s ON s.id = ce.student_id
             LEFT JOIN grades g ON g.student_id = s.id AND g.exam_id = ?
             WHERE ce.course_id = ? AND ce.status = 'Enrolled' AND s.status = 'Active'
             ORDER BY s.first_name`,
            [exam.id, exam.course_id]
        );

        // Precompute per-student grade + percentage
        const studentRows = students.map(s => {
            let marks = s.marks_obtained;
            let pct = null;
            let letter = '—';
            let letterClass = 'bg-gray-500/10 text-gray-400 border border-gray-500/20';

            if (marks !== null && marks !== undefined) {
                const m = Number(marks);
                pct = Math.round((m / exam.max_marks) * 100);
                if (pct >= 90) { letter = 'A'; letterClass = 'bg-green-500/10 text-green-400 border border-green-500/20'; }
                else if (pct >= 80) { letter = 'B'; letterClass = 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'; }
                else if (pct >= 70) { letter = 'C'; letterClass = 'bg-blue-500/10 text-blue-400 border border-blue-500/20'; }
                else if (pct >= 60) { letter = 'D'; letterClass = 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'; }
                else { letter = 'F'; letterClass = 'bg-red-500/10 text-red-400 border border-red-500/20'; }
            }

            return {
                id: s.id,
                code: s.student_id_code,
                name: s.first_name + ' ' + s.last_name,
                avatar: s.profile_photo || '/images/default-avatar.svg',
                marks: (marks === null || marks === undefined) ? '' : marks,
                hasGrade: marks !== null && marks !== undefined,
                pct: pct === null ? '—' : pct + '%',
                letter,
                letterClass
            };
        });

        res.render('exams/grades', {
            title: 'Enter Grades | EduManage',
            exam,
            studentRows
        });
    } catch (err) {
        console.error('renderGradeEntry:', err);
        req.flash('error_msg', 'Error loading grade entry.');
        res.redirect('/exams');
    }
};

// ---- SAVE GRADES (bulk) ----
exports.saveGrades = async (req, res) => {
    const examId = req.params.id;
    const grades = req.body.grades || {};

    const connection = await pool.getConnection();
    try {
        const [exams] = await connection.query('SELECT max_marks FROM exams WHERE id = ?', [examId]);
        if (exams.length === 0) throw new Error('Exam not found');
        const maxMarks = Number(exams[0].max_marks);

        await connection.beginTransaction();

        for (const studentId of Object.keys(grades)) {
            const raw = grades[studentId];
            if (raw === '' || raw === null || raw === undefined) {
                // Empty input → delete existing grade
                await connection.query(
                    'DELETE FROM grades WHERE exam_id = ? AND student_id = ?',
                    [examId, studentId]
                );
                continue;
            }
            const marks = Number(raw);
            if (isNaN(marks) || marks < 0 || marks > maxMarks) {
                await connection.rollback();
                req.flash('error_msg', 'Marks must be between 0 and ' + maxMarks + '.');
                return res.redirect('/exams/' + examId + '/grades');
            }
            await connection.query(
                `INSERT INTO grades (exam_id, student_id, marks_obtained) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE marks_obtained = VALUES(marks_obtained)`,
                [examId, studentId, marks]
            );
        }

        await connection.commit();
        req.flash('success_msg', 'Grades saved.');
        res.redirect('/exams/' + examId + '/grades');
    } catch (err) {
        await connection.rollback();
        console.error('saveGrades:', err);
        req.flash('error_msg', 'Failed to save grades.');
        res.redirect('/exams/' + examId + '/grades');
    } finally {
        connection.release();
    }
};

// ---- STUDENT REPORT CARD ----
exports.studentReportCard = async (req, res) => {
    try {
        const studentId = req.params.id;
        const [students] = await pool.query(
            'SELECT * FROM students WHERE id = ?',
            [studentId]
        );
        if (students.length === 0) return res.redirect('/students');
        const student = students[0];

        const [results] = await pool.query(
            `SELECT e.id AS exam_id, e.title, e.max_marks, e.exam_date, e.passing_marks,
                    c.course_code, c.name AS course_name,
                    g.marks_obtained
             FROM grades g
             JOIN exams e ON g.exam_id = e.id
             JOIN courses c ON e.course_id = c.id
             WHERE g.student_id = ?
             ORDER BY e.exam_date DESC`,
            [studentId]
        );

        // Precompute per-row
        const rows = results.map(r => {
            const marks = Number(r.marks_obtained);
            const pct = Math.round((marks / r.max_marks) * 100);
            let letter = 'F';
            let letterClass = 'bg-red-500/10 text-red-400 border border-red-500/20';
            if (pct >= 90) { letter = 'A'; letterClass = 'bg-green-500/10 text-green-400 border border-green-500/20'; }
            else if (pct >= 80) { letter = 'B'; letterClass = 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'; }
            else if (pct >= 70) { letter = 'C'; letterClass = 'bg-blue-500/10 text-blue-400 border border-blue-500/20'; }
            else if (pct >= 60) { letter = 'D'; letterClass = 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'; }

            const passing = marks >= r.passing_marks;
            return {
                exam_id: r.exam_id,
                title: r.title,
                course: r.course_name,
                code: r.course_code,
                date: new Date(r.exam_date).toLocaleDateString(),
                marks,
                max_marks: r.max_marks,
                pct,
                pctStr: pct + '%',
                letter,
                letterClass,
                result: passing ? 'Pass' : 'Fail',
                resultClass: passing ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            };
        });

        // Compute average
        let avg = 0;
        if (rows.length > 0) {
            let total = 0;
            rows.forEach(r => { total += r.pct; });
            avg = Math.round(total / rows.length);
        }

        res.render('exams/report-card', {
            title: 'Report Card | EduManage',
            student,
            rows,
            average: avg,
            totalExams: rows.length,
            studentAvatar: student.profile_photo || '/images/default-avatar.svg'
        });
    } catch (err) {
        console.error('studentReportCard:', err);
        req.flash('error_msg', 'Error loading report card.');
        res.redirect('/students');
    }
};