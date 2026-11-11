const pool = require('../config/db');

// ---- REPORTS HUB ----
exports.hub = (req, res) => {
    res.render('reports/hub', { title: 'Reports | EduManage' });
};

// ---- STUDENT DIRECTORY ----
exports.studentDirectory = async (req, res) => {
    try {
        const statusFilter = req.query.status || '';
        const classFilter = req.query.class || '';

        let where = ' WHERE 1=1';
        const params = [];
        if (statusFilter) { where += ' AND s.status = ?'; params.push(statusFilter); }
        if (classFilter) { where += ' AND s.class_id = ?'; params.push(classFilter); }

        const [students] = await pool.query(
            `SELECT s.*, d.name AS department_name, c.name AS class_name
             FROM students s
             LEFT JOIN departments d ON s.department_id = d.id
             LEFT JOIN classes c ON s.class_id = c.id
             ${where}
             ORDER BY s.last_name, s.first_name`,
            params
        );

        const [classes] = await pool.query('SELECT id, name FROM classes ORDER BY name');

        // Precompute status class + avatar
        const rows = students.map(s => {
            let statusClass = 'bg-red-500/10 text-red-400';
            if (s.status === 'Active') statusClass = 'bg-green-500/10 text-green-400';
            else if (s.status === 'Graduated') statusClass = 'bg-blue-500/10 text-blue-400';
            return {
                id: s.id,
                code: s.student_id_code,
                name: s.first_name + ' ' + s.last_name,
                email: s.email || '',
                phone: s.phone || '',
                gender: s.gender,
                dob: new Date(s.dob).toLocaleDateString(),
                enrollment: new Date(s.enrollment_date).toLocaleDateString(),
                department: s.department_name || '—',
                class: s.class_name || '—',
                status: s.status,
                statusClass
            };
        });

        res.render('reports/students', {
            title: 'Student Directory | EduManage',
            rows,
            classes,
            filters: { status: statusFilter, class: classFilter }
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error generating report.');
        res.redirect('/reports');
    }
};

// ---- ATTENDANCE SUMMARY ----
exports.attendanceSummary = async (req, res) => {
    try {
        const [summary] = await pool.query(
            `SELECT s.id, s.student_id_code, s.first_name, s.last_name,
                    COUNT(a.id) AS total,
                    SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present,
                    SUM(CASE WHEN a.status = 'Absent' THEN 1 ELSE 0 END) AS absent,
                    SUM(CASE WHEN a.status = 'Late' THEN 1 ELSE 0 END) AS late,
                    SUM(CASE WHEN a.status = 'Excused' THEN 1 ELSE 0 END) AS excused
             FROM students s
             LEFT JOIN attendance a ON a.student_id = s.id
             WHERE s.status = 'Active'
             GROUP BY s.id
             ORDER BY s.last_name, s.first_name`
        );

        const rows = summary.map(r => {
            const total = Number(r.total) || 0;
            const present = Number(r.present) || 0;
            const late = Number(r.late) || 0;
            const absent = Number(r.absent) || 0;
            const excused = Number(r.excused) || 0;
            const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

            let rateClass = 'text-red-400';
            if (rate >= 90) rateClass = 'text-green-400';
            else if (rate >= 75) rateClass = 'text-yellow-400';

            return {
                code: r.student_id_code,
                name: r.first_name + ' ' + r.last_name,
                total, present, absent, late, excused,
                rate: rate + '%',
                rateClass
            };
        });

        res.render('reports/attendance', {
            title: 'Attendance Report | EduManage',
            rows
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error generating report.');
        res.redirect('/reports');
    }
};

// ---- GRADE PERFORMANCE ----
exports.gradeReport = async (req, res) => {
    try {
        const courseFilter = req.query.course || '';
        let where = '';
        const params = [];
        if (courseFilter) {
            where = ' WHERE c.id = ?';
            params.push(courseFilter);
        }

        const [courses] = await pool.query('SELECT id, course_code, name FROM courses ORDER BY name');

        const [results] = await pool.query(
            `SELECT s.id AS student_id, s.student_id_code, s.first_name, s.last_name,
                    c.course_code, c.name AS course_name,
                    ROUND(AVG(g.marks_obtained / e.max_marks * 100), 1) AS avg_pct
             FROM grades g
             JOIN exams e ON g.exam_id = e.id
             JOIN courses c ON e.course_id = c.id
             JOIN students s ON g.student_id = s.id
             ${where}
             GROUP BY s.id, c.id
             ORDER BY avg_pct DESC`,
            params
        );

        const rows = results.map(r => {
            const pct = Number(r.avg_pct) || 0;
            let letter = 'F';
            let letterClass = 'bg-red-500/10 text-red-400';
            if (pct >= 90) { letter = 'A'; letterClass = 'bg-green-500/10 text-green-400'; }
            else if (pct >= 80) { letter = 'B'; letterClass = 'bg-cyan-500/10 text-cyan-400'; }
            else if (pct >= 70) { letter = 'C'; letterClass = 'bg-blue-500/10 text-blue-400'; }
            else if (pct >= 60) { letter = 'D'; letterClass = 'bg-yellow-500/10 text-yellow-400'; }

            return {
                student_id: r.student_id,
                code: r.student_id_code,
                name: r.first_name + ' ' + r.last_name,
                course: r.course_name,
                course_code: r.course_code,
                avg_pct: pct + '%',
                letter,
                letterClass
            };
        });

        res.render('reports/grades', {
            title: 'Grade Report | EduManage',
            rows,
            courses,
            courseFilter
        });
    } catch (err) {
        console.error(err);
        req.flash('error_msg', 'Error generating report.');
        res.redirect('/reports');
    }
};

// ---- CSV EXPORT (generic) ----
exports.exportCSV = async (req, res) => {
    try {
        const type = req.params.type;
        let headers = [];
        let data = [];
        let filename = 'export.csv';

        if (type === 'students') {
            headers = ['Student ID', 'Name', 'Email', 'Gender', 'Enrollment', 'Status'];
            const [rows] = await pool.query(
                `SELECT student_id_code, CONCAT(first_name,' ',last_name) AS name, phone, gender, enrollment_date, status FROM students ORDER BY last_name`
            );
            data = rows.map(r => [r.student_id_code, r.name, r.phone || '', r.gender, new Date(r.enrollment_date).toLocaleDateString(), r.status]);
            filename = 'students.csv';
        } else if (type === 'attendance') {
            headers = ['Student ID', 'Name', 'Total', 'Present', 'Absent', 'Late', 'Excused', 'Rate'];
            const [rows] = await pool.query(
                `SELECT s.student_id_code, CONCAT(s.first_name,' ',s.last_name) AS name,
                        COUNT(a.id) AS total,
                        SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END) AS present,
                        SUM(CASE WHEN a.status='Absent' THEN 1 ELSE 0 END) AS absent,
                        SUM(CASE WHEN a.status='Late' THEN 1 ELSE 0 END) AS late,
                        SUM(CASE WHEN a.status='Excused' THEN 1 ELSE 0 END) AS excused
                 FROM students s LEFT JOIN attendance a ON a.student_id = s.id
                 WHERE s.status = 'Active' GROUP BY s.id ORDER BY s.last_name`
            );
            data = rows.map(r => {
                const total = Number(r.total) || 0;
                const rate = total > 0 ? Math.round(((Number(r.present) + Number(r.late)) / total) * 100) : 0;
                return [r.student_id_code, r.name, r.total, r.present || 0, r.absent || 0, r.late || 0, r.excused || 0, rate + '%'];
            });
            filename = 'attendance-report.csv';
        } else if (type === 'grades') {
            headers = ['Student ID', 'Name', 'Course', 'Average %'];
            const [rows] = await pool.query(
                `SELECT s.student_id_code, CONCAT(s.first_name,' ',s.last_name) AS name,
                        c.name AS course, ROUND(AVG(g.marks_obtained / e.max_marks * 100), 1) AS avg_pct
                 FROM grades g JOIN exams e ON g.exam_id = e.id
                 JOIN courses c ON e.course_id = c.id
                 JOIN students s ON g.student_id = s.id
                 GROUP BY s.id, c.id ORDER BY avg_pct DESC`
            );
            data = rows.map(r => [r.student_id_code, r.name, r.course, r.avg_pct + '%']);
            filename = 'grade-report.csv';
        } else {
            return res.redirect('/reports');
        }

        // Escape CSV properly
        const esc = (v) => {
            const s = (v === null || v === undefined) ? '' : String(v);
            return '"' + s.replace(/"/g, '""') + '"';
        };

        let csv = headers.map(esc).join(',') + '\r\n';
        data.forEach(row => { csv += row.map(esc).join(',') + '\r\n'; });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
        res.send('\uFEFF' + csv); // BOM for Excel compatibility
    } catch (err) {
        console.error('exportCSV:', err);
        req.flash('error_msg', 'Export failed.');
        res.redirect('/reports');
    }
};