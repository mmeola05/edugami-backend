const { query, transaction } = require("../config/db");

function roleCodes(access) {
  return new Set((access?.roles || []).map((role) => role.code));
}

function isGuardian(access) {
  const roles = roleCodes(access);
  return roles.has("GUARDIAN") && !roles.has("TENANT_ADMIN") && !roles.has("TEACHER");
}

async function getActivePeriodId(client, tenantId) {
  const result = await client.query(`
    SELECT period_id
    FROM tenant_academic_periods
    WHERE tenant_id = $1 AND status = 'active'
    ORDER BY is_default DESC, starts_at DESC NULLS LAST, created_at DESC
    LIMIT 1
  `, [tenantId]);
  return result.rows[0]?.period_id || null;
}

async function recordAcademicHistory(client, user, event) {
  await client.query(`
    INSERT INTO tenant_academic_history_events (
      tenant_id,
      period_id,
      event_type,
      entity_type,
      entity_id,
      student_id,
      class_id,
      subject_id,
      teacher_user_id,
      previous_state,
      next_state,
      actor_user_id,
      occurred_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, NOW())
  `, [
    user.tenantId,
    event.periodId || null,
    event.eventType,
    event.entityType,
    event.entityId,
    event.studentId || null,
    event.classId || null,
    event.subjectId || null,
    event.teacherUserId || null,
    JSON.stringify(event.previousState || {}),
    JSON.stringify(event.nextState || {}),
    user.sub
  ]);
}

async function overview(user, access) {
  const guardianOnly = isGuardian(access);
  const permissions = new Set(access?.permissions || []);
  const can = (permission) => permissions.has("*") || permissions.has(permission);
  const params = [user.tenantId];
  const guardianFilter = guardianOnly
    ? `AND EXISTS (
        SELECT 1 FROM tenant_guardian_student_links gsl
        WHERE gsl.tenant_id = s.tenant_id
          AND gsl.student_id = s.student_id
          AND gsl.guardian_user_id = $2
          AND gsl.status = 'active'
      )`
    : "";
  if (guardianOnly) params.push(user.sub);

  const [classes, subjects, students, teachers] = await Promise.all([
    can("classes.read")
      ? query(`SELECT COUNT(*)::int AS count FROM tenant_classes WHERE tenant_id = $1 AND status = 'active'`, [user.tenantId])
      : Promise.resolve({ rows: [{ count: 0 }] }),
    can("courses.read")
      ? query(`SELECT COUNT(*)::int AS count FROM tenant_subjects WHERE tenant_id = $1 AND status = 'active'`, [user.tenantId])
      : Promise.resolve({ rows: [{ count: 0 }] }),
    can("students.read")
      ? query(`SELECT COUNT(*)::int AS count FROM tenant_students s WHERE tenant_id = $1 AND status = 'active' ${guardianFilter}`, params)
      : Promise.resolve({ rows: [{ count: 0 }] }),
    can("teachers.read")
      ? query(`
      SELECT COUNT(DISTINCT u.user_id)::int AS count
      FROM tenant_users u
      JOIN user_tenant_roles utr ON utr.tenant_id = u.tenant_id AND utr.user_id = u.user_id
      WHERE u.tenant_id = $1 AND u.status = 'active' AND utr.role_code = 'TEACHER'
    `, [user.tenantId])
      : Promise.resolve({ rows: [{ count: 0 }] })
  ]);

  return {
    classes: classes.rows[0]?.count || 0,
    subjects: subjects.rows[0]?.count || 0,
    students: students.rows[0]?.count || 0,
    teachers: teachers.rows[0]?.count || 0,
    guardianScoped: guardianOnly
  };
}

async function listClasses(tenantId) {
  const result = await query(`
    SELECT
      c.class_id,
      c.name,
      c.code,
      c.level,
      c.academic_year,
      c.status,
      COUNT(DISTINCT COALESCE(ce.student_id, s.student_id))::int AS students_count,
      c.created_at,
      c.updated_at
    FROM tenant_classes c
    LEFT JOIN tenant_class_enrollments ce
      ON ce.tenant_id = c.tenant_id
      AND ce.class_id = c.class_id
      AND ce.status = 'active'
    LEFT JOIN tenant_students s
      ON s.tenant_id = c.tenant_id
      AND s.primary_class_id = c.class_id
      AND s.status = 'active'
    WHERE c.tenant_id = $1
    GROUP BY c.class_id
    ORDER BY c.academic_year DESC, c.name ASC
  `, [tenantId]);
  return result.rows;
}

async function createClass(user, data) {
  return transaction(async (client) => {
    const periodId = await getActivePeriodId(client, user.tenantId);
    const result = await client.query(`
      INSERT INTO tenant_classes (tenant_id, name, code, level, academic_year, period_id, status, created_by_user_id, created_at, updated_at)
      VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), $5, $6, $7, $8, NOW(), NOW())
      RETURNING class_id, name, code, level, academic_year, period_id, status, created_at, updated_at
    `, [
      user.tenantId,
      data.name,
      data.code || null,
      data.level || null,
      data.academicYear || "2025-2026",
      periodId,
      data.status || "active",
      user.sub
    ]);
    const created = result.rows[0];
    await recordAcademicHistory(client, user, {
      periodId,
      eventType: "class_created",
      entityType: "class",
      entityId: created.class_id,
      classId: created.class_id,
      nextState: created
    });
    return created;
  });
}

async function updateClass(user, classId, data) {
  const result = await query(`
    UPDATE tenant_classes
    SET
      name = COALESCE($3, name),
      code = COALESCE(NULLIF($4, ''), code),
      level = COALESCE(NULLIF($5, ''), level),
      academic_year = COALESCE($6, academic_year),
      status = COALESCE($7, status),
      updated_at = NOW()
    WHERE tenant_id = $1 AND class_id = $2
    RETURNING class_id, name, code, level, academic_year, status, created_at, updated_at
  `, [
    user.tenantId,
    classId,
    data.name || null,
    data.code ?? null,
    data.level ?? null,
    data.academicYear || null,
    data.status || null
  ]);
  return result.rows[0] || null;
}

async function listSubjects(tenantId) {
  const result = await query(`
    SELECT
      sub.subject_id,
      sub.name,
      sub.code,
      sub.stage,
      sub.status,
      COUNT(DISTINCT COALESCE(se.student_id, ss.student_id))::int AS students_count,
      sub.created_at,
      sub.updated_at
    FROM tenant_subjects sub
    LEFT JOIN tenant_subject_enrollments se
      ON se.tenant_id = sub.tenant_id
      AND se.subject_id = sub.subject_id
      AND se.status = 'active'
    LEFT JOIN tenant_student_subjects ss
      ON ss.tenant_id = sub.tenant_id
      AND ss.subject_id = sub.subject_id
      AND ss.status = 'active'
    WHERE sub.tenant_id = $1
    GROUP BY sub.subject_id
    ORDER BY sub.name ASC
  `, [tenantId]);
  return result.rows;
}

async function createSubject(user, data) {
  const result = await query(`
    INSERT INTO tenant_subjects (tenant_id, name, code, stage, status, created_by_user_id, created_at, updated_at)
    VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), $5, $6, NOW(), NOW())
    RETURNING subject_id, name, code, stage, status, created_at, updated_at
  `, [user.tenantId, data.name, data.code || null, data.stage || null, data.status || "active", user.sub]);
  return result.rows[0];
}

async function updateSubject(user, subjectId, data) {
  const result = await query(`
    UPDATE tenant_subjects
    SET
      name = COALESCE($3, name),
      code = COALESCE(NULLIF($4, ''), code),
      stage = COALESCE(NULLIF($5, ''), stage),
      status = COALESCE($6, status),
      updated_at = NOW()
    WHERE tenant_id = $1 AND subject_id = $2
    RETURNING subject_id, name, code, stage, status, created_at, updated_at
  `, [
    user.tenantId,
    subjectId,
    data.name || null,
    data.code ?? null,
    data.stage ?? null,
    data.status || null
  ]);
  return result.rows[0] || null;
}

async function listStudents(user, access) {
  const guardianOnly = isGuardian(access);
  const params = [user.tenantId];
  let guardianJoin = "";
  let guardianWhere = "";

  if (guardianOnly) {
    params.push(user.sub);
    guardianJoin = `
      JOIN tenant_guardian_student_links gsl
        ON gsl.tenant_id = s.tenant_id
        AND gsl.student_id = s.student_id
        AND gsl.guardian_user_id = $2
        AND gsl.status = 'active'
    `;
    guardianWhere = "AND s.status = 'active'";
  }

  const result = await query(`
    SELECT
      s.student_id,
      s.full_name,
      s.preferred_name,
      s.external_ref,
      s.primary_class_id,
      s.status,
      s.metadata_json,
      c.class_id,
      c.name AS class_name,
      c.level AS class_level,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object('subjectId', sub.subject_id, 'name', sub.name, 'code', sub.code)
        ) FILTER (WHERE sub.subject_id IS NOT NULL),
        '[]'::json
      ) AS subjects,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object('userId', gu.user_id, 'displayName', gu.display_name, 'email', gu.email, 'relationshipType', links.relationship_type)
        ) FILTER (WHERE gu.user_id IS NOT NULL),
        '[]'::json
      ) AS guardians,
      s.created_at,
      s.updated_at
    FROM tenant_students s
    ${guardianJoin}
    LEFT JOIN tenant_classes c ON c.tenant_id = s.tenant_id AND c.class_id = s.primary_class_id
    LEFT JOIN (
      SELECT tenant_id, student_id, subject_id
      FROM tenant_student_subjects
      WHERE status = 'active'
      UNION
      SELECT tenant_id, student_id, subject_id
      FROM tenant_subject_enrollments
      WHERE status = 'active'
    ) ss ON ss.tenant_id = s.tenant_id AND ss.student_id = s.student_id
    LEFT JOIN tenant_subjects sub ON sub.tenant_id = ss.tenant_id AND sub.subject_id = ss.subject_id
    LEFT JOIN tenant_guardian_student_links links ON links.tenant_id = s.tenant_id AND links.student_id = s.student_id AND links.status = 'active'
    LEFT JOIN tenant_users gu ON gu.tenant_id = links.tenant_id AND gu.user_id = links.guardian_user_id
    WHERE s.tenant_id = $1 ${guardianWhere}
    GROUP BY s.student_id, c.class_id
    ORDER BY s.full_name ASC
  `, params);
  return result.rows.map((row) => ({
    ...row,
    guardianScoped: guardianOnly
  }));
}

async function createStudent(user, data) {
  return transaction(async (client) => {
    const periodId = await getActivePeriodId(client, user.tenantId);
    const insert = await client.query(`
      INSERT INTO tenant_students (
        tenant_id, full_name, preferred_name, external_ref, primary_class_id, status, metadata_json,
        created_by_user_id, created_at, updated_at
      )
      VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), $5, $6, $7::jsonb, $8, NOW(), NOW())
      RETURNING student_id, full_name, preferred_name, external_ref, primary_class_id, status, metadata_json, created_at, updated_at
    `, [
      user.tenantId,
      data.fullName,
      data.preferredName || null,
      data.externalRef || null,
      data.primaryClassId || null,
      data.status || "active",
      JSON.stringify(data.metadata || {}),
      user.sub
    ]);

    const student = insert.rows[0];
    if (student.primary_class_id) {
      await client.query(`
        INSERT INTO tenant_student_classes (tenant_id, student_id, class_id, academic_year, is_primary)
        VALUES ($1, $2, $3, $4, TRUE)
        ON CONFLICT (tenant_id, student_id, class_id, academic_year)
        DO UPDATE SET is_primary = TRUE
      `, [user.tenantId, student.student_id, student.primary_class_id, data.academicYear || "2025-2026"]);
      await client.query(`
        INSERT INTO tenant_class_enrollments (
          tenant_id, student_id, class_id, period_id, status, is_primary, starts_at, ends_at, created_by_user_id, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, 'active', TRUE, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (tenant_id, student_id, class_id, period_id)
        DO UPDATE SET
          status = 'active',
          is_primary = TRUE,
          starts_at = COALESCE(EXCLUDED.starts_at, tenant_class_enrollments.starts_at),
          ends_at = EXCLUDED.ends_at,
          updated_at = NOW()
      `, [
        user.tenantId,
        student.student_id,
        student.primary_class_id,
        periodId,
        data.startsAt || null,
        data.endsAt || null,
        user.sub
      ]);
    }

    for (const subjectId of data.subjectIds || []) {
      await client.query(`
        INSERT INTO tenant_student_subjects (tenant_id, student_id, subject_id, status)
        VALUES ($1, $2, $3, 'active')
        ON CONFLICT (tenant_id, student_id, subject_id)
        DO UPDATE SET status = 'active'
      `, [user.tenantId, student.student_id, subjectId]);
      await client.query(`
        INSERT INTO tenant_subject_enrollments (
          tenant_id, student_id, subject_id, class_id, period_id, status, starts_at, ends_at, created_by_user_id, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, NOW(), NOW())
        ON CONFLICT (tenant_id, student_id, subject_id, class_id, period_id)
        DO UPDATE SET
          status = 'active',
          starts_at = COALESCE(EXCLUDED.starts_at, tenant_subject_enrollments.starts_at),
          ends_at = EXCLUDED.ends_at,
          updated_at = NOW()
      `, [
        user.tenantId,
        student.student_id,
        subjectId,
        student.primary_class_id || null,
        periodId,
        data.startsAt || null,
        data.endsAt || null,
        user.sub
      ]);
    }

    await recordAcademicHistory(client, user, {
      periodId,
      eventType: "student_created",
      entityType: "student",
      entityId: student.student_id,
      studentId: student.student_id,
      classId: student.primary_class_id,
      nextState: {
        student,
        subjectIds: data.subjectIds || []
      }
    });

    return student;
  });
}

async function updateStudent(user, studentId, data) {
  return transaction(async (client) => {
    const periodId = await getActivePeriodId(client, user.tenantId);
    const result = await client.query(`
      UPDATE tenant_students
      SET
        full_name = COALESCE($3, full_name),
        preferred_name = COALESCE(NULLIF($4, ''), preferred_name),
        external_ref = COALESCE(NULLIF($5, ''), external_ref),
        primary_class_id = COALESCE($6, primary_class_id),
        status = COALESCE($7, status),
        metadata_json = COALESCE($8::jsonb, metadata_json),
        updated_at = NOW()
      WHERE tenant_id = $1 AND student_id = $2
      RETURNING student_id, full_name, preferred_name, external_ref, primary_class_id, status, metadata_json, created_at, updated_at
    `, [
      user.tenantId,
      studentId,
      data.fullName || null,
      data.preferredName ?? null,
      data.externalRef ?? null,
      data.primaryClassId || null,
      data.status || null,
      data.metadata ? JSON.stringify(data.metadata) : null
    ]);
    const student = result.rows[0];
    if (!student) return null;

    if (data.primaryClassId) {
      await client.query(`
        INSERT INTO tenant_student_classes (tenant_id, student_id, class_id, academic_year, is_primary)
        VALUES ($1, $2, $3, $4, TRUE)
        ON CONFLICT (tenant_id, student_id, class_id, academic_year)
        DO UPDATE SET is_primary = TRUE
      `, [user.tenantId, studentId, data.primaryClassId, data.academicYear || "2025-2026"]);
      await client.query(`
        UPDATE tenant_class_enrollments
        SET is_primary = FALSE, updated_at = NOW()
        WHERE tenant_id = $1 AND student_id = $2 AND status = 'active'
      `, [user.tenantId, studentId]);
      await client.query(`
        INSERT INTO tenant_class_enrollments (
          tenant_id, student_id, class_id, period_id, status, is_primary, starts_at, ends_at, created_by_user_id, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, 'active', TRUE, $5, $6, $7, NOW(), NOW())
        ON CONFLICT (tenant_id, student_id, class_id, period_id)
        DO UPDATE SET
          status = 'active',
          is_primary = TRUE,
          starts_at = COALESCE(EXCLUDED.starts_at, tenant_class_enrollments.starts_at),
          ends_at = EXCLUDED.ends_at,
          updated_at = NOW()
      `, [
        user.tenantId,
        studentId,
        data.primaryClassId,
        periodId,
        data.startsAt || null,
        data.endsAt || null,
        user.sub
      ]);
    }

    if (Array.isArray(data.subjectIds)) {
      await client.query(`DELETE FROM tenant_student_subjects WHERE tenant_id = $1 AND student_id = $2`, [user.tenantId, studentId]);
      await client.query(`
        UPDATE tenant_subject_enrollments
        SET status = 'dropped', ends_at = COALESCE(ends_at, CURRENT_DATE), updated_at = NOW()
        WHERE tenant_id = $1 AND student_id = $2 AND status IN ('pending', 'active')
      `, [user.tenantId, studentId]);
      for (const subjectId of data.subjectIds) {
        await client.query(`
          INSERT INTO tenant_student_subjects (tenant_id, student_id, subject_id, status)
          VALUES ($1, $2, $3, 'active')
          ON CONFLICT (tenant_id, student_id, subject_id)
          DO UPDATE SET status = 'active'
        `, [user.tenantId, studentId, subjectId]);
        await client.query(`
          INSERT INTO tenant_subject_enrollments (
            tenant_id, student_id, subject_id, class_id, period_id, status, starts_at, ends_at, created_by_user_id, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, NOW(), NOW())
          ON CONFLICT (tenant_id, student_id, subject_id, class_id, period_id)
          DO UPDATE SET
            status = 'active',
            starts_at = COALESCE(EXCLUDED.starts_at, tenant_subject_enrollments.starts_at),
            ends_at = EXCLUDED.ends_at,
            updated_at = NOW()
        `, [
          user.tenantId,
          studentId,
          subjectId,
          data.primaryClassId || student.primary_class_id || null,
          periodId,
          data.startsAt || null,
          data.endsAt || null,
          user.sub
        ]);
      }
    }

    await recordAcademicHistory(client, user, {
      periodId,
      eventType: "student_updated",
      entityType: "student",
      entityId: student.student_id,
      studentId: student.student_id,
      classId: student.primary_class_id,
      nextState: {
        student,
        subjectIds: Array.isArray(data.subjectIds) ? data.subjectIds : undefined
      }
    });

    return student;
  });
}

async function listEnrollments(tenantId) {
  const result = await query(`
    SELECT *
    FROM (
      SELECT
        ce.enrollment_id,
        'class' AS enrollment_type,
        ce.student_id,
        st.full_name AS student_name,
        ce.class_id,
        c.name AS class_name,
        NULL::uuid AS subject_id,
        NULL::varchar AS subject_name,
        ce.period_id,
        p.name AS period_name,
        ce.starts_at,
        ce.ends_at,
        ce.status,
        ce.is_primary,
        ce.created_at,
        ce.updated_at
      FROM tenant_class_enrollments ce
      JOIN tenant_students st ON st.tenant_id = ce.tenant_id AND st.student_id = ce.student_id
      JOIN tenant_classes c ON c.tenant_id = ce.tenant_id AND c.class_id = ce.class_id
      LEFT JOIN tenant_academic_periods p ON p.tenant_id = ce.tenant_id AND p.period_id = ce.period_id
      WHERE ce.tenant_id = $1
      UNION ALL
      SELECT
        se.enrollment_id,
        'subject' AS enrollment_type,
        se.student_id,
        st.full_name AS student_name,
        se.class_id,
        c.name AS class_name,
        se.subject_id,
        s.name AS subject_name,
        se.period_id,
        p.name AS period_name,
        se.starts_at,
        se.ends_at,
        se.status,
        FALSE AS is_primary,
        se.created_at,
        se.updated_at
      FROM tenant_subject_enrollments se
      JOIN tenant_students st ON st.tenant_id = se.tenant_id AND st.student_id = se.student_id
      JOIN tenant_subjects s ON s.tenant_id = se.tenant_id AND s.subject_id = se.subject_id
      LEFT JOIN tenant_classes c ON c.tenant_id = se.tenant_id AND c.class_id = se.class_id
      LEFT JOIN tenant_academic_periods p ON p.tenant_id = se.tenant_id AND p.period_id = se.period_id
      WHERE se.tenant_id = $1
    ) enrollments
    ORDER BY
      CASE WHEN status = 'active' THEN 0 WHEN status = 'pending' THEN 1 ELSE 2 END,
      period_name DESC NULLS LAST,
      student_name ASC,
      enrollment_type ASC
  `, [tenantId]);
  return result.rows;
}

async function createEnrollment(user, data) {
  const periodId = await transaction(async (client) => getActivePeriodId(client, user.tenantId));
  if (data.enrollmentType === "subject") {
    const result = await query(`
      INSERT INTO tenant_subject_enrollments (
        tenant_id, student_id, subject_id, class_id, period_id, starts_at, ends_at, status, created_by_user_id, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (tenant_id, student_id, subject_id, class_id, period_id)
      DO UPDATE SET
        starts_at = EXCLUDED.starts_at,
        ends_at = EXCLUDED.ends_at,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING enrollment_id, student_id, subject_id, class_id, period_id, starts_at, ends_at, status, created_at, updated_at
    `, [
      user.tenantId,
      data.studentId,
      data.subjectId,
      data.classId || null,
      periodId,
      data.startsAt || null,
      data.endsAt || null,
      data.status || "active",
      user.sub
    ]);
    return { ...result.rows[0], enrollment_type: "subject" };
  }

  const result = await query(`
    INSERT INTO tenant_class_enrollments (
      tenant_id, student_id, class_id, period_id, starts_at, ends_at, status, is_primary, created_by_user_id, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
    ON CONFLICT (tenant_id, student_id, class_id, period_id)
    DO UPDATE SET
      starts_at = EXCLUDED.starts_at,
      ends_at = EXCLUDED.ends_at,
      status = EXCLUDED.status,
      is_primary = EXCLUDED.is_primary,
      updated_at = NOW()
    RETURNING enrollment_id, student_id, class_id, period_id, starts_at, ends_at, status, is_primary, created_at, updated_at
  `, [
    user.tenantId,
    data.studentId,
    data.classId,
    periodId,
    data.startsAt || null,
    data.endsAt || null,
    data.status || "active",
    data.isPrimary === true,
    user.sub
  ]);
  return { ...result.rows[0], enrollment_type: "class" };
}

async function updateEnrollment(user, enrollmentId, data) {
  const classResult = await query(`
    UPDATE tenant_class_enrollments
    SET
      period_id = COALESCE($3, period_id),
      starts_at = COALESCE($4, starts_at),
      ends_at = COALESCE($5, ends_at),
      status = COALESCE($6, status),
      is_primary = COALESCE($7, is_primary),
      updated_at = NOW()
    WHERE tenant_id = $1 AND enrollment_id = $2
    RETURNING enrollment_id, student_id, class_id, period_id, starts_at, ends_at, status, is_primary, created_at, updated_at
  `, [
    user.tenantId,
    enrollmentId,
    data.periodId || null,
    data.startsAt || null,
    data.endsAt || null,
    data.status || null,
    typeof data.isPrimary === "boolean" ? data.isPrimary : null
  ]);
  if (classResult.rows[0]) return { ...classResult.rows[0], enrollment_type: "class" };

  const subjectResult = await query(`
    UPDATE tenant_subject_enrollments
    SET
      class_id = COALESCE($3, class_id),
      period_id = COALESCE($4, period_id),
      starts_at = COALESCE($5, starts_at),
      ends_at = COALESCE($6, ends_at),
      status = COALESCE($7, status),
      updated_at = NOW()
    WHERE tenant_id = $1 AND enrollment_id = $2
    RETURNING enrollment_id, student_id, subject_id, class_id, period_id, starts_at, ends_at, status, created_at, updated_at
  `, [
    user.tenantId,
    enrollmentId,
    data.classId || null,
    data.periodId || null,
    data.startsAt || null,
    data.endsAt || null,
    data.status || null
  ]);
  if (subjectResult.rows[0]) return { ...subjectResult.rows[0], enrollment_type: "subject" };
  return null;
}

async function listAcademicPeriods(tenantId) {
  const result = await query(`
    SELECT period_id, name, code, period_type, starts_at, ends_at, status, is_default, created_at, updated_at
    FROM tenant_academic_periods
    WHERE tenant_id = $1
    ORDER BY is_default DESC, starts_at DESC NULLS LAST, created_at DESC
  `, [tenantId]);
  return result.rows;
}

async function createAcademicPeriod(user, data) {
  return transaction(async (client) => {
    const becomesActive = data.status === "active" || data.isDefault === true;
    if (becomesActive) {
      await client.query(`
        UPDATE tenant_academic_periods
        SET status = CASE WHEN status = 'active' THEN 'planned' ELSE status END,
            is_default = FALSE,
            updated_at = NOW()
        WHERE tenant_id = $1
      `, [user.tenantId]);
    }
    const result = await client.query(`
      INSERT INTO tenant_academic_periods (
        tenant_id, name, code, period_type, starts_at, ends_at, status, is_default, created_by_user_id, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING period_id, name, code, period_type, starts_at, ends_at, status, is_default, created_at, updated_at
    `, [
      user.tenantId,
      data.name,
      data.code,
      data.periodType || "school_year",
      data.startsAt || null,
      data.endsAt || null,
      becomesActive ? "active" : (data.status || "planned"),
      becomesActive,
      user.sub
    ]);
    const period = result.rows[0];
    await recordAcademicHistory(client, user, {
      periodId: period.period_id,
      eventType: "academic_period_created",
      entityType: "academic_period",
      entityId: period.period_id,
      nextState: period
    });
    return period;
  });
}

async function updateAcademicPeriod(user, periodId, data) {
  return transaction(async (client) => {
    const current = await client.query(`
      SELECT period_id, name, code, period_type, starts_at, ends_at, status, is_default
      FROM tenant_academic_periods
      WHERE tenant_id = $1 AND period_id = $2
    `, [user.tenantId, periodId]);
    if (!current.rows[0]) return null;

    const becomesActive = data.status === "active" || data.isDefault === true;
    if (becomesActive) {
      await client.query(`
        UPDATE tenant_academic_periods
        SET status = CASE WHEN status = 'active' THEN 'planned' ELSE status END,
            is_default = FALSE,
            updated_at = NOW()
        WHERE tenant_id = $1 AND period_id <> $2
      `, [user.tenantId, periodId]);
    }
    const result = await client.query(`
      UPDATE tenant_academic_periods
      SET
        name = COALESCE($3, name),
        code = COALESCE($4, code),
        period_type = COALESCE($5, period_type),
        starts_at = COALESCE($6, starts_at),
        ends_at = COALESCE($7, ends_at),
        status = COALESCE($8, status),
        is_default = COALESCE($9, is_default),
        updated_at = NOW()
      WHERE tenant_id = $1 AND period_id = $2
      RETURNING period_id, name, code, period_type, starts_at, ends_at, status, is_default, created_at, updated_at
    `, [
      user.tenantId,
      periodId,
      data.name || null,
      data.code || null,
      data.periodType || null,
      data.startsAt || null,
      data.endsAt || null,
      becomesActive ? "active" : (data.status || null),
      becomesActive ? true : (typeof data.isDefault === "boolean" ? data.isDefault : null)
    ]);
    const period = result.rows[0] || null;
    if (period) {
      await recordAcademicHistory(client, user, {
        periodId: period.period_id,
        eventType: "academic_period_updated",
        entityType: "academic_period",
        entityId: period.period_id,
        previousState: current.rows[0],
        nextState: period
      });
    }
    return period;
  });
}

async function moveStudentToClass(user, studentId, data) {
  return transaction(async (client) => {
    const periodId = await getActivePeriodId(client, user.tenantId);
    const current = await client.query(`
      SELECT student_id, full_name, primary_class_id, status
      FROM tenant_students
      WHERE tenant_id = $1 AND student_id = $2
    `, [user.tenantId, studentId]);
    const student = current.rows[0];
    if (!student) return null;

    await client.query(`
      UPDATE tenant_class_enrollments
      SET status = 'completed',
          is_primary = FALSE,
          ends_at = COALESCE($4, ends_at, CURRENT_DATE),
          updated_at = NOW()
      WHERE tenant_id = $1
        AND student_id = $2
        AND status IN ('pending', 'active')
        AND ($3::uuid IS NULL OR class_id <> $3::uuid)
    `, [user.tenantId, studentId, data.classId, data.movedAt || null]);

    await client.query(`
      INSERT INTO tenant_student_classes (tenant_id, student_id, class_id, academic_year, is_primary, starts_at)
      VALUES ($1, $2, $3, $4, TRUE, $5)
      ON CONFLICT (tenant_id, student_id, class_id, academic_year)
      DO UPDATE SET is_primary = TRUE,
                    starts_at = COALESCE(EXCLUDED.starts_at, tenant_student_classes.starts_at)
    `, [user.tenantId, studentId, data.classId, data.academicYear || "active", data.movedAt || null]);

    const enrollment = await client.query(`
      INSERT INTO tenant_class_enrollments (
        tenant_id, student_id, class_id, period_id, starts_at, status, is_primary, created_by_user_id, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, 'active', TRUE, $6, NOW(), NOW())
      ON CONFLICT (tenant_id, student_id, class_id, period_id)
      DO UPDATE SET
        status = 'active',
        is_primary = TRUE,
        starts_at = COALESCE(EXCLUDED.starts_at, tenant_class_enrollments.starts_at),
        ends_at = NULL,
        updated_at = NOW()
      RETURNING enrollment_id, student_id, class_id, period_id, starts_at, ends_at, status, is_primary
    `, [user.tenantId, studentId, data.classId, periodId, data.movedAt || null, user.sub]);

    const updated = await client.query(`
      UPDATE tenant_students
      SET primary_class_id = $3, updated_at = NOW()
      WHERE tenant_id = $1 AND student_id = $2
      RETURNING student_id, full_name, preferred_name, external_ref, primary_class_id, status, metadata_json, created_at, updated_at
    `, [user.tenantId, studentId, data.classId]);

    await recordAcademicHistory(client, user, {
      periodId,
      eventType: "student_moved_class",
      entityType: "student",
      entityId: studentId,
      studentId,
      classId: data.classId,
      previousState: student,
      nextState: {
        student: updated.rows[0],
        enrollment: enrollment.rows[0]
      }
    });

    return updated.rows[0];
  });
}

async function assignSubjectsToStudent(user, studentId, data) {
  return transaction(async (client) => {
    const periodId = await getActivePeriodId(client, user.tenantId);
    const current = await client.query(`
      SELECT student_id, full_name, primary_class_id, status
      FROM tenant_students
      WHERE tenant_id = $1 AND student_id = $2
    `, [user.tenantId, studentId]);
    const student = current.rows[0];
    if (!student) return null;

    if (data.replace === true) {
      await client.query(`DELETE FROM tenant_student_subjects WHERE tenant_id = $1 AND student_id = $2`, [user.tenantId, studentId]);
      await client.query(`
        UPDATE tenant_subject_enrollments
        SET status = 'dropped',
            ends_at = COALESCE($3, ends_at, CURRENT_DATE),
            updated_at = NOW()
        WHERE tenant_id = $1 AND student_id = $2 AND status IN ('pending', 'active')
      `, [user.tenantId, studentId, data.assignedAt || null]);
    }

    const enrollments = [];
    for (const subjectId of data.subjectIds) {
      await client.query(`
        INSERT INTO tenant_student_subjects (tenant_id, student_id, subject_id, status)
        VALUES ($1, $2, $3, 'active')
        ON CONFLICT (tenant_id, student_id, subject_id)
        DO UPDATE SET status = 'active'
      `, [user.tenantId, studentId, subjectId]);

      const enrollment = await client.query(`
        INSERT INTO tenant_subject_enrollments (
          tenant_id, student_id, subject_id, class_id, period_id, starts_at, status, created_by_user_id, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, NOW(), NOW())
        ON CONFLICT (tenant_id, student_id, subject_id, class_id, period_id)
        DO UPDATE SET
          status = 'active',
          starts_at = COALESCE(EXCLUDED.starts_at, tenant_subject_enrollments.starts_at),
          ends_at = NULL,
          updated_at = NOW()
        RETURNING enrollment_id, student_id, subject_id, class_id, period_id, starts_at, ends_at, status
      `, [
        user.tenantId,
        studentId,
        subjectId,
        data.classId || student.primary_class_id || null,
        periodId,
        data.assignedAt || null,
        user.sub
      ]);
      enrollments.push(enrollment.rows[0]);
    }

    await recordAcademicHistory(client, user, {
      periodId,
      eventType: "student_subjects_assigned",
      entityType: "student",
      entityId: studentId,
      studentId,
      classId: data.classId || student.primary_class_id || null,
      previousState: student,
      nextState: {
        subjectIds: data.subjectIds,
        replace: data.replace === true,
        enrollments
      }
    });

    return { studentId, subjectIds: data.subjectIds, enrollments };
  });
}

async function assignTeacherToClassSubject(user, data) {
  return transaction(async (client) => {
    const periodId = await getActivePeriodId(client, user.tenantId);
    const role = data.assignmentRole || "lead";
    const status = data.status || "active";

    if (role === "lead" && status === "active") {
      const conflictCheck = await client.query(`
        SELECT assignment_id FROM tenant_teacher_assignments 
        WHERE tenant_id = $1 
          AND class_id = $2 
          AND subject_id = $3 
          AND period_id = $4 
          AND assignment_role = 'lead' 
          AND status = 'active' 
          AND teacher_user_id != $5
      `, [user.tenantId, data.classId, data.subjectId, periodId, data.teacherUserId]);
      
      if (conflictCheck.rows.length > 0) {
        throw new Error("No puede haber múltiples profesores 'Titulares' (lead) activos para la misma clase y asignatura.");
      }
    }

    const result = await client.query(`
      INSERT INTO tenant_teacher_assignments (
        tenant_id, teacher_user_id, class_id, subject_id, period_id, assignment_role, starts_at, ends_at, status,
        created_by_user_id, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (tenant_id, teacher_user_id, class_id, subject_id, period_id, assignment_role)
      DO UPDATE SET
        starts_at = COALESCE(EXCLUDED.starts_at, tenant_teacher_assignments.starts_at),
        ends_at = EXCLUDED.ends_at,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING assignment_id, teacher_user_id, class_id, subject_id, period_id, assignment_role, starts_at, ends_at, status, created_at, updated_at
    `, [
      user.tenantId,
      data.teacherUserId,
      data.classId,
      data.subjectId,
      periodId,
      role,
      data.startsAt || null,
      data.endsAt || null,
      status,
      user.sub
    ]);
    const assignment = result.rows[0];
    await recordAcademicHistory(client, user, {
      periodId,
      eventType: "teacher_assigned",
      entityType: "teacher_assignment",
      entityId: assignment.assignment_id,
      classId: assignment.class_id,
      subjectId: assignment.subject_id,
      teacherUserId: assignment.teacher_user_id,
      nextState: assignment
    });
    return assignment;
  });
}

async function listAcademicHistory(tenantId, filters = {}) {
  const params = [tenantId];
  const where = ["tenant_id = $1"];
  if (filters.studentId) {
    params.push(filters.studentId);
    where.push(`student_id = $${params.length}`);
  }
  if (filters.classId) {
    params.push(filters.classId);
    where.push(`class_id = $${params.length}`);
  }
  if (filters.periodId) {
    params.push(filters.periodId);
    where.push(`period_id = $${params.length}`);
  }
  const result = await query(`
    SELECT
      history_event_id,
      period_id,
      event_type,
      entity_type,
      entity_id,
      student_id,
      class_id,
      subject_id,
      teacher_user_id,
      previous_state,
      next_state,
      actor_user_id,
      occurred_at
    FROM tenant_academic_history_events
    WHERE ${where.join(" AND ")}
    ORDER BY occurred_at DESC
    LIMIT 200
  `, params);
  return result.rows;
}

async function listTeacherAssignments(tenantId) {
  const result = await query(`
    SELECT
      ta.assignment_id,
      ta.teacher_user_id,
      u.display_name AS teacher_name,
      u.email AS teacher_email,
      ta.class_id,
      c.name AS class_name,
      ta.subject_id,
      s.name AS subject_name,
      ta.period_id,
      p.name AS period_name,
      ta.assignment_role,
      ta.starts_at,
      ta.ends_at,
      ta.status,
      ta.created_at,
      ta.updated_at
    FROM tenant_teacher_assignments ta
    JOIN tenant_users u ON u.tenant_id = ta.tenant_id AND u.user_id = ta.teacher_user_id
    JOIN tenant_classes c ON c.tenant_id = ta.tenant_id AND c.class_id = ta.class_id
    JOIN tenant_subjects s ON s.tenant_id = ta.tenant_id AND s.subject_id = ta.subject_id
    LEFT JOIN tenant_academic_periods p ON p.tenant_id = ta.tenant_id AND p.period_id = ta.period_id
    WHERE ta.tenant_id = $1
    ORDER BY p.starts_at DESC NULLS LAST, c.name ASC, s.name ASC, u.display_name ASC
  `, [tenantId]);
  return result.rows;
}

async function createTeacherAssignment(user, data) {
  return assignTeacherToClassSubject(user, data);
}

async function updateTeacherAssignment(user, assignmentId, data) {
  return transaction(async (client) => {
    // Check current assignment details to handle partial updates
    const currentRes = await client.query(`SELECT * FROM tenant_teacher_assignments WHERE tenant_id = $1 AND assignment_id = $2`, [user.tenantId, assignmentId]);
    if (currentRes.rows.length === 0) return null;
    const current = currentRes.rows[0];

    const role = data.assignmentRole || current.assignment_role;
    const status = data.status || current.status;
    const classId = data.classId || current.class_id;
    const subjectId = data.subjectId || current.subject_id;
    const periodId = data.periodId || current.period_id;
    const teacherUserId = data.teacherUserId || current.teacher_user_id;

    if (role === "lead" && status === "active") {
      const conflictCheck = await client.query(`
        SELECT assignment_id FROM tenant_teacher_assignments 
        WHERE tenant_id = $1 
          AND class_id = $2 
          AND subject_id = $3 
          AND period_id = $4 
          AND assignment_role = 'lead' 
          AND status = 'active' 
          AND teacher_user_id != $5
          AND assignment_id != $6
      `, [user.tenantId, classId, subjectId, periodId, teacherUserId, assignmentId]);
      
      if (conflictCheck.rows.length > 0) {
        throw new Error("No puede haber múltiples profesores 'Titulares' (lead) activos para la misma clase y asignatura.");
      }
    }

    const result = await client.query(`
      UPDATE tenant_teacher_assignments
      SET
        teacher_user_id = COALESCE($3, teacher_user_id),
        class_id = COALESCE($4, class_id),
        subject_id = COALESCE($5, subject_id),
        period_id = COALESCE($6, period_id),
        assignment_role = COALESCE($7, assignment_role),
        starts_at = COALESCE($8, starts_at),
        ends_at = COALESCE($9, ends_at),
        status = COALESCE($10, status),
        updated_at = NOW()
      WHERE tenant_id = $1 AND assignment_id = $2
      RETURNING assignment_id, teacher_user_id, class_id, subject_id, period_id, assignment_role, starts_at, ends_at, status, created_at, updated_at
    `, [
      user.tenantId,
      assignmentId,
      data.teacherUserId || null,
      data.classId || null,
      data.subjectId || null,
      data.periodId || null,
      data.assignmentRole || null,
      data.startsAt || null,
      data.endsAt || null,
      data.status || null
    ]);
    return result.rows[0] || null;
  });
}

async function listTeachers(tenantId) {
  const result = await query(`
    SELECT
      u.user_id,
      u.email,
      u.display_name,
      u.status,
      u.created_at,
      COALESCE(
        json_agg(json_build_object('code', r.code, 'name', r.name) ORDER BY r.code)
        FILTER (WHERE r.code IS NOT NULL),
        '[]'::json
      ) AS roles
    FROM tenant_users u
    JOIN user_tenant_roles utr ON utr.tenant_id = u.tenant_id AND utr.user_id = u.user_id
    JOIN tenant_roles r ON r.tenant_id = utr.tenant_id AND r.code = utr.role_code
    WHERE u.tenant_id = $1
      AND utr.role_code = 'TEACHER'
    GROUP BY u.user_id
    ORDER BY u.display_name ASC
  `, [tenantId]);
  return result.rows;
}

async function listGuardians(tenantId) {
  const result = await query(`
    SELECT
      u.user_id,
      u.email,
      u.display_name,
      u.status,
      COUNT(gsl.student_id)::int AS linked_students_count,
      u.created_at
    FROM tenant_users u
    JOIN user_tenant_roles utr ON utr.tenant_id = u.tenant_id AND utr.user_id = u.user_id
    LEFT JOIN tenant_guardian_student_links gsl
      ON gsl.tenant_id = u.tenant_id
      AND gsl.guardian_user_id = u.user_id
      AND gsl.status = 'active'
    WHERE u.tenant_id = $1
      AND utr.role_code = 'GUARDIAN'
      AND u.status = 'active'
    GROUP BY u.user_id
    ORDER BY u.display_name ASC
  `, [tenantId]);
  return result.rows;
}

async function linkGuardian(user, studentId, data) {
  const result = await query(`
    INSERT INTO tenant_guardian_student_links (
      tenant_id,
      guardian_user_id,
      student_id,
      relationship_type,
      can_view_reports,
      can_receive_notifications,
      status,
      authorized_by_user_id,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, NOW(), NOW())
    ON CONFLICT (tenant_id, guardian_user_id, student_id)
    DO UPDATE SET
      relationship_type = EXCLUDED.relationship_type,
      can_view_reports = EXCLUDED.can_view_reports,
      can_receive_notifications = EXCLUDED.can_receive_notifications,
      status = 'active',
      authorized_by_user_id = EXCLUDED.authorized_by_user_id,
      updated_at = NOW()
    RETURNING link_id, guardian_user_id, student_id, relationship_type, can_view_reports, can_receive_notifications, status
  `, [
    user.tenantId,
    data.guardianUserId,
    studentId,
    data.relationshipType || "guardian",
    data.canViewReports !== false,
    data.canReceiveNotifications !== false,
    user.sub
  ]);
  return result.rows[0];
}

module.exports = {
  overview,
  listAcademicPeriods,
  createAcademicPeriod,
  updateAcademicPeriod,
  listClasses,
  createClass,
  updateClass,
  listSubjects,
  createSubject,
  updateSubject,
  listStudents,
  createStudent,
  updateStudent,
  moveStudentToClass,
  assignSubjectsToStudent,
  listEnrollments,
  createEnrollment,
  updateEnrollment,
  listAcademicHistory,
  listTeachers,
  listTeacherAssignments,
  createTeacherAssignment,
  assignTeacherToClassSubject,
  updateTeacherAssignment,
  listGuardians,
  linkGuardian
};
