const express = require("express");
const c = require("../controllers/tenantAcademic.controller");
const admin = require("../controllers/tenantAdmin.controller");
const reports = require("../controllers/tenantReports.controller");
const s = require("../utils/schemas");
const { validate } = require("../middlewares/validate");
const { requireAuth } = require("../middlewares/auth");
const { requireTenantAuth, attachTenantAccess, requireTenantPermission } = require("../middlewares/tenantAuth");

const router = express.Router();

router.use(requireAuth, requireTenantAuth);

router.get("/overview", attachTenantAccess, c.overview);
router.get("/reports/dashboard", requireTenantPermission("reports.read"), attachTenantAccess, reports.dashboard);

router.get("/admin/users", requireTenantPermission("tenant_users.read"), admin.listUsers);
router.post("/admin/users", requireTenantPermission("tenant_users.manage"), validate(s.createTenantUser), admin.createUser);
router.patch("/admin/users/:userId", requireTenantPermission("tenant_users.manage"), validate(s.updateTenantUser), admin.updateUser);
router.get("/admin/roles", requireTenantPermission("tenant_users.read"), admin.listRoles);
router.put("/admin/roles/:roleCode/access", requireTenantPermission("tenant_users.manage"), validate(s.setTenantRoleAccess), admin.setRoleAccess);

router.get("/periods", requireTenantPermission("periods.read"), c.listAcademicPeriods);
router.post("/periods", requireTenantPermission("periods.create"), validate(s.createTenantAcademicPeriod), c.createAcademicPeriod);
router.patch("/periods/:periodId", requireTenantPermission("periods.update"), validate(s.updateTenantAcademicPeriod), c.updateAcademicPeriod);

router.get("/classes", requireTenantPermission("classes.read"), c.listClasses);
router.post("/classes", requireTenantPermission("classes.create"), validate(s.createTenantClass), c.createClass);
router.patch("/classes/:classId", requireTenantPermission("classes.update"), validate(s.updateTenantClass), c.updateClass);

router.get("/courses", requireTenantPermission("courses.read"), c.listSubjects);
router.post("/courses", requireTenantPermission("courses.create"), validate(s.createTenantSubject), c.createSubject);
router.patch("/courses/:subjectId", requireTenantPermission("courses.update"), validate(s.updateTenantSubject), c.updateSubject);

router.get("/students", requireTenantPermission("students.read"), c.listStudents);
router.post("/students", requireTenantPermission("students.create"), validate(s.createTenantStudent), c.createStudent);
router.patch("/students/:studentId", requireTenantPermission("students.update"), validate(s.updateTenantStudent), c.updateStudent);
router.post(
  "/students/:studentId/move-class",
  requireTenantPermission("students.move"),
  validate(s.moveTenantStudentToClass),
  c.moveStudentToClass
);
router.post(
  "/students/:studentId/subjects",
  requireTenantPermission("students.assign_subjects"),
  validate(s.assignTenantStudentSubjects),
  c.assignSubjectsToStudent
);
router.post(
  "/students/:studentId/guardians",
  requireTenantPermission("students.update"),
  validate(s.linkTenantGuardian),
  c.linkGuardian
);

router.get("/enrollments", requireTenantPermission("enrollments.read"), c.listEnrollments);
router.post("/enrollments", requireTenantPermission("enrollments.manage"), validate(s.createTenantEnrollment), c.createEnrollment);
router.patch("/enrollments/:enrollmentId", requireTenantPermission("enrollments.manage"), validate(s.updateTenantEnrollment), c.updateEnrollment);

router.get("/teachers", requireTenantPermission("teachers.read"), c.listTeachers);
router.get("/teacher-assignments", requireTenantPermission("teacher_assignments.read"), c.listTeacherAssignments);
router.post("/teacher-assignments", requireTenantPermission("teacher_assignments.manage"), validate(s.createTenantTeacherAssignment), c.createTeacherAssignment);
router.post("/teacher-assignments/assign", requireTenantPermission("teacher_assignments.assign"), validate(s.createTenantTeacherAssignment), c.assignTeacherToClassSubject);
router.patch("/teacher-assignments/:assignmentId", requireTenantPermission("teacher_assignments.manage"), validate(s.updateTenantTeacherAssignment), c.updateTeacherAssignment);
router.get("/guardians", requireTenantPermission("students.update"), c.listGuardians);
router.get("/academic-history", requireTenantPermission("academic_history.read"), c.listAcademicHistory);

router.get("/settings", requireTenantPermission("settings.read"), admin.getSettings);
router.patch("/settings", requireTenantPermission("settings.manage"), validate(s.updateTenantSettings), admin.updateSettings);

module.exports = router;
