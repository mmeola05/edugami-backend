const { query } = require("../config/db");

async function getDashboard(tenantId, access) {
  // Simple KPIs for now
  const [classes, subjects, students, teachers, activeEnrollments] = await Promise.all([
    query(`SELECT COUNT(*)::int AS count FROM tenant_classes WHERE tenant_id = $1 AND status = 'active'`, [tenantId]),
    query(`SELECT COUNT(*)::int AS count FROM tenant_subjects WHERE tenant_id = $1 AND status = 'active'`, [tenantId]),
    query(`SELECT COUNT(*)::int AS count FROM tenant_students WHERE tenant_id = $1 AND status = 'active'`, [tenantId]),
    query(`
      SELECT COUNT(DISTINCT u.user_id)::int AS count
      FROM tenant_users u
      JOIN user_tenant_roles utr ON utr.tenant_id = u.tenant_id AND utr.user_id = u.user_id
      WHERE u.tenant_id = $1 AND u.status = 'active' AND utr.role_code = 'TEACHER'
    `, [tenantId]),
    query(`
      SELECT COUNT(*)::int AS count
      FROM tenant_student_classes
      WHERE tenant_id = $1
    `, [tenantId])
  ]);

  const studentsCount = students.rows[0]?.count || 0;
  const classesCount = classes.rows[0]?.count || 0;
  const ratio = classesCount > 0 ? (studentsCount / classesCount).toFixed(1) : 0;

  // Simulate trend data for charts
  const historyTrends = await query(`
    SELECT DATE_TRUNC('month', occurred_at) as month, COUNT(*) as events
    FROM tenant_academic_history_events
    WHERE tenant_id = $1
    GROUP BY DATE_TRUNC('month', occurred_at)
    ORDER BY month ASC
    LIMIT 6
  `, [tenantId]);

  return {
    kpis: {
      students: studentsCount,
      classes: classesCount,
      subjects: subjects.rows[0]?.count || 0,
      teachers: teachers.rows[0]?.count || 0,
      enrollments: activeEnrollments.rows[0]?.count || 0,
      studentClassRatio: ratio
    },
    trends: historyTrends.rows.map(r => ({
      date: r.month,
      value: parseInt(r.events, 10)
    }))
  };
}

module.exports = { getDashboard };
