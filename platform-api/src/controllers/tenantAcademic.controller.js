const service = require("../services/tenantAcademic.service");
const { ok, created, fail } = require("../utils/response");

async function overview(req, res, next) {
  try {
    return ok(res, await service.overview(req.user, req.tenantAccess));
  } catch (error) {
    return next(error);
  }
}

async function listClasses(req, res, next) {
  try {
    return ok(res, await service.listClasses(req.user.tenantId));
  } catch (error) {
    return next(error);
  }
}

async function listAcademicPeriods(req, res, next) {
  try {
    return ok(res, await service.listAcademicPeriods(req.user.tenantId));
  } catch (error) {
    return next(error);
  }
}

async function createAcademicPeriod(req, res, next) {
  try {
    return created(res, await service.createAcademicPeriod(req.user, req.body), "Periodo creado");
  } catch (error) {
    return next(error);
  }
}

async function updateAcademicPeriod(req, res, next) {
  try {
    const item = await service.updateAcademicPeriod(req.user, req.params.periodId, req.body);
    if (!item) return fail(res, "NOT_FOUND", "Periodo no encontrado", 404);
    return ok(res, item, "Periodo actualizado");
  } catch (error) {
    return next(error);
  }
}

async function createClass(req, res, next) {
  try {
    return created(res, await service.createClass(req.user, req.body), "Clase creada");
  } catch (error) {
    return next(error);
  }
}

async function updateClass(req, res, next) {
  try {
    const item = await service.updateClass(req.user, req.params.classId, req.body);
    if (!item) return fail(res, "NOT_FOUND", "Clase no encontrada", 404);
    return ok(res, item, "Clase actualizada");
  } catch (error) {
    return next(error);
  }
}

async function listSubjects(req, res, next) {
  try {
    return ok(res, await service.listSubjects(req.user.tenantId));
  } catch (error) {
    return next(error);
  }
}

async function createSubject(req, res, next) {
  try {
    return created(res, await service.createSubject(req.user, req.body), "Asignatura creada");
  } catch (error) {
    return next(error);
  }
}

async function updateSubject(req, res, next) {
  try {
    const item = await service.updateSubject(req.user, req.params.subjectId, req.body);
    if (!item) return fail(res, "NOT_FOUND", "Asignatura no encontrada", 404);
    return ok(res, item, "Asignatura actualizada");
  } catch (error) {
    return next(error);
  }
}

async function listStudents(req, res, next) {
  try {
    return ok(res, await service.listStudents(req.user, req.tenantAccess));
  } catch (error) {
    return next(error);
  }
}

async function createStudent(req, res, next) {
  try {
    return created(res, await service.createStudent(req.user, req.body), "Alumno creado");
  } catch (error) {
    return next(error);
  }
}

async function updateStudent(req, res, next) {
  try {
    const item = await service.updateStudent(req.user, req.params.studentId, req.body);
    if (!item) return fail(res, "NOT_FOUND", "Alumno no encontrado", 404);
    return ok(res, item, "Alumno actualizado");
  } catch (error) {
    return next(error);
  }
}

async function moveStudentToClass(req, res, next) {
  try {
    const item = await service.moveStudentToClass(req.user, req.params.studentId, req.body);
    if (!item) return fail(res, "NOT_FOUND", "Alumno no encontrado", 404);
    return ok(res, item, "Alumno movido");
  } catch (error) {
    return next(error);
  }
}

async function assignSubjectsToStudent(req, res, next) {
  try {
    const item = await service.assignSubjectsToStudent(req.user, req.params.studentId, req.body);
    if (!item) return fail(res, "NOT_FOUND", "Alumno no encontrado", 404);
    return ok(res, item, "Asignaturas asignadas");
  } catch (error) {
    return next(error);
  }
}

async function listEnrollments(req, res, next) {
  try {
    return ok(res, await service.listEnrollments(req.user.tenantId));
  } catch (error) {
    return next(error);
  }
}

async function listAcademicHistory(req, res, next) {
  try {
    return ok(res, await service.listAcademicHistory(req.user.tenantId, req.query));
  } catch (error) {
    return next(error);
  }
}

async function createEnrollment(req, res, next) {
  try {
    return created(res, await service.createEnrollment(req.user, req.body), "Matricula creada");
  } catch (error) {
    return next(error);
  }
}

async function updateEnrollment(req, res, next) {
  try {
    const item = await service.updateEnrollment(req.user, req.params.enrollmentId, req.body);
    if (!item) return fail(res, "NOT_FOUND", "Matricula no encontrada", 404);
    return ok(res, item, "Matricula actualizada");
  } catch (error) {
    return next(error);
  }
}

async function listTeachers(req, res, next) {
  try {
    return ok(res, await service.listTeachers(req.user.tenantId));
  } catch (error) {
    return next(error);
  }
}

async function listTeacherAssignments(req, res, next) {
  try {
    return ok(res, await service.listTeacherAssignments(req.user.tenantId));
  } catch (error) {
    return next(error);
  }
}

async function createTeacherAssignment(req, res, next) {
  try {
    return created(res, await service.createTeacherAssignment(req.user, req.body), "Asignacion docente creada");
  } catch (error) {
    return next(error);
  }
}

async function assignTeacherToClassSubject(req, res, next) {
  try {
    return created(res, await service.assignTeacherToClassSubject(req.user, req.body), "Profesor asignado");
  } catch (error) {
    if (error.message.includes("No puede haber múltiples profesores")) {
      return fail(res, "VALIDATION_ERROR", error.message, 400);
    }
    return next(error);
  }
}

async function updateTeacherAssignment(req, res, next) {
  try {
    const item = await service.updateTeacherAssignment(req.user, req.params.assignmentId, req.body);
    if (!item) return fail(res, "NOT_FOUND", "Asignacion docente no encontrada", 404);
    return ok(res, item, "Asignacion docente actualizada");
  } catch (error) {
    if (error.message.includes("No puede haber múltiples profesores")) {
      return fail(res, "VALIDATION_ERROR", error.message, 400);
    }
    return next(error);
  }
}

async function listGuardians(req, res, next) {
  try {
    return ok(res, await service.listGuardians(req.user.tenantId));
  } catch (error) {
    return next(error);
  }
}

async function linkGuardian(req, res, next) {
  try {
    return created(
      res,
      await service.linkGuardian(req.user, req.params.studentId, req.body),
      "Tutor vinculado"
    );
  } catch (error) {
    return next(error);
  }
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
