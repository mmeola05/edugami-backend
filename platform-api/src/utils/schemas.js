const Joi = require("joi");
module.exports = {
  login: Joi.object({ email: Joi.string().email().required(), password: Joi.string().min(8).required() }),
  tenantLogin: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    tenantId: Joi.string().allow(null, '').default(null),
    tenantSlug: Joi.string().max(80).allow(null, '').default(null)
  }),
  refresh: Joi.object({ refreshToken: Joi.string().required() }),
  logout: Joi.object({ refreshToken: Joi.string().required() }),
  tenantContext: Joi.object({
    tenantId: Joi.string().allow(null, '').default(null),
    tenantSlug: Joi.string().max(80).allow(null, '').default(null)
  }).or('tenantId', 'tenantSlug'),
  recoveryRequest: Joi.object({ email: Joi.string().email().required() }),
  recoveryReset: Joi.object({ token: Joi.string().required(), newPassword: Joi.string().min(8).required() }),
  createPlatformAccount: Joi.object({ email: Joi.string().email().required(), password: Joi.string().min(8).required(), role: Joi.string().valid('ROOT','SUPPORT').required(), status: Joi.string().valid('active','suspended').default('active') }),
  updatePlatformAccount: Joi.object({ role: Joi.string().valid('ROOT','SUPPORT'), status: Joi.string().valid('active','suspended') }).min(1),
  createTenant: Joi.object({ name: Joi.string().max(150).required(), slug: Joi.string().max(80).required(), tenantType: Joi.string().valid('SCHOOL','ACADEMY','BUSINESS','INDEPENDENT').required(), timezone: Joi.string().max(80).default('Europe/Madrid'), status: Joi.string().valid('active','suspended','archived').default('active') }),
  updateTenant: Joi.object({ name: Joi.string().max(150), slug: Joi.string().max(80), tenantType: Joi.string().valid('SCHOOL','ACADEMY','BUSINESS','INDEPENDENT'), timezone: Joi.string().max(80), status: Joi.string().valid('active','suspended','archived') }).min(1),
  setTenantModules: Joi.object({ modules: Joi.array().items(Joi.object({ moduleKey: Joi.string().required(), isEnabled: Joi.boolean().required() })).min(1).required() }),
  createTenantUser: Joi.object({ email: Joi.string().email().required(), password: Joi.string().min(8).required(), displayName: Joi.string().max(160).required(), status: Joi.string().valid('active','suspended').default('active'), roleCodes: Joi.array().items(Joi.string()).default([]) }),
  updateTenantUser: Joi.object({ displayName: Joi.string().max(160), status: Joi.string().valid('active','suspended'), roleCodes: Joi.array().items(Joi.string()) }).min(1),
  tenantUserRoles: Joi.object({ roleCodes: Joi.array().items(Joi.string()).required() }),
  setTenantRoleAccess: Joi.object({ moduleKeys: Joi.array().items(Joi.string()).required(), permissionCodes: Joi.array().items(Joi.string()).required() }),
  createAlert: Joi.object({
    eventKey: Joi.string().required(),
    severity: Joi.string().valid('info','warning','error','fatal').required(),
    tenantId: Joi.string().allow(null,''),
    title: Joi.string().max(160).required(),
    message: Joi.string().required(),
    status: Joi.string().valid('PENDIENTE','EN_INVESTIGACION','MITIGADO','RESUELTO','CERRADO').default('PENDIENTE'),
    sourceType: Joi.string().max(60).default('manual'),
    sourceRefId: Joi.string().allow('', null).max(160).default(null),
    dedupeKey: Joi.string().allow('', null).max(180).default(null),
    summary: Joi.object().unknown(true).default({}),
    context: Joi.object().unknown(true).default({}),
    channels: Joi.array().items(Joi.string().valid('EMAIL','TELEGRAM','WHATSAPP')).default(['EMAIL'])
  }),
  resolveAlert: Joi.object({ resolutionNote: Joi.string().allow('').default('') }),
  reopenAlert: Joi.object({ note: Joi.string().allow('').default('') }),
  changeAlertStatus: Joi.object({
    status: Joi.string().valid('PENDIENTE','EN_INVESTIGACION','MITIGADO','RESUELTO','CERRADO').required(),
    note: Joi.string().allow('').default('')
  }),
  addIncidentNote: Joi.object({
    body: Joi.string().min(2).required(),
    noteType: Joi.string().valid('investigation','mitigation','resolution','handoff','status_change').default('investigation'),
    isInternal: Joi.boolean().default(true)
  }),
  assignAlert: Joi.object({
    assignedPlatformAccountId: Joi.string().allow(null, '').default(null),
    slaDueAt: Joi.string().isoDate().allow(null, '').default(null),
    note: Joi.string().allow('').default('')
  }),
  frontendErrorAlert: Joi.object({
    severity: Joi.string().valid('warning','error','fatal').default('error'),
    message: Joi.string().required(),
    stack: Joi.string().allow('', null).default(null),
    component: Joi.string().allow('', null).default(null),
    routePath: Joi.string().allow('', null).default(null),
    requestId: Joi.string().allow('', null).default(null),
    correlationId: Joi.string().allow('', null).default(null)
  }),
  createRole: Joi.object({ code: Joi.string().max(60).required(), name: Joi.string().max(120).required(), status: Joi.string().valid('active','inactive').default('active') }),
  updateRole: Joi.object({ code: Joi.string().max(60), name: Joi.string().max(120), status: Joi.string().valid('active','inactive') }).min(1),
  rolePermissions: Joi.object({ permissionCodes: Joi.array().items(Joi.string()).required() }),
  assignRole: Joi.object({ roleId: Joi.string().required() }),
  directPermissions: Joi.object({ permissionCodes: Joi.array().items(Joi.string()).required() }),
  updatePlatformModule: Joi.object({ moduleKey: Joi.string().required(), isEnabled: Joi.boolean().required(), reason: Joi.string().allow('', null).max(300).default(null) })
  ,
  createTenantAcademicPeriod: Joi.object({
    name: Joi.string().max(140).required(),
    code: Joi.string().max(60).required(),
    periodType: Joi.string().valid('school_year', 'term', 'evaluation', 'custom').default('school_year'),
    startsAt: Joi.string().isoDate().allow('', null).default(null),
    endsAt: Joi.string().isoDate().allow('', null).default(null),
    status: Joi.string().valid('planned', 'active', 'closed', 'archived').default('planned'),
    isDefault: Joi.boolean().default(false)
  }),
  updateTenantAcademicPeriod: Joi.object({
    name: Joi.string().max(140),
    code: Joi.string().max(60),
    periodType: Joi.string().valid('school_year', 'term', 'evaluation', 'custom'),
    startsAt: Joi.string().isoDate().allow('', null),
    endsAt: Joi.string().isoDate().allow('', null),
    status: Joi.string().valid('planned', 'active', 'closed', 'archived'),
    isDefault: Joi.boolean()
  }).min(1),
  createTenantClass: Joi.object({
    name: Joi.string().max(140).required(),
    code: Joi.string().allow('', null).max(60).default(null),
    level: Joi.string().allow('', null).max(80).default(null),
    academicYear: Joi.string().max(20).default('2025-2026'),
    status: Joi.string().valid('active', 'archived').default('active')
  }),
  updateTenantClass: Joi.object({
    name: Joi.string().max(140),
    code: Joi.string().allow('', null).max(60),
    level: Joi.string().allow('', null).max(80),
    academicYear: Joi.string().max(20),
    status: Joi.string().valid('active', 'archived')
  }).min(1),
  createTenantSubject: Joi.object({
    name: Joi.string().max(140).required(),
    code: Joi.string().allow('', null).max(60).default(null),
    stage: Joi.string().allow('', null).max(80).default(null),
    status: Joi.string().valid('active', 'archived').default('active')
  }),
  updateTenantSubject: Joi.object({
    name: Joi.string().max(140),
    code: Joi.string().allow('', null).max(60),
    stage: Joi.string().allow('', null).max(80),
    status: Joi.string().valid('active', 'archived')
  }).min(1),
  createTenantStudent: Joi.object({
    fullName: Joi.string().max(180).required(),
    preferredName: Joi.string().allow('', null).max(120).default(null),
    externalRef: Joi.string().allow('', null).max(120).default(null),
    primaryClassId: Joi.string().allow('', null).default(null),
    periodId: Joi.string().allow('', null).default(null),
    startsAt: Joi.string().isoDate().allow('', null).default(null),
    endsAt: Joi.string().isoDate().allow('', null).default(null),
    academicYear: Joi.string().max(20).default('2025-2026'),
    subjectIds: Joi.array().items(Joi.string()).default([]),
    status: Joi.string().valid('active', 'inactive', 'archived').default('active'),
    metadata: Joi.object().unknown(true).default({})
  }),
  updateTenantStudent: Joi.object({
    fullName: Joi.string().max(180),
    preferredName: Joi.string().allow('', null).max(120),
    externalRef: Joi.string().allow('', null).max(120),
    primaryClassId: Joi.string().allow('', null),
    periodId: Joi.string().allow('', null),
    startsAt: Joi.string().isoDate().allow('', null),
    endsAt: Joi.string().isoDate().allow('', null),
    academicYear: Joi.string().max(20),
    subjectIds: Joi.array().items(Joi.string()),
    status: Joi.string().valid('active', 'inactive', 'archived'),
    metadata: Joi.object().unknown(true)
  }).min(1),
  moveTenantStudentToClass: Joi.object({
    classId: Joi.string().required(),
    movedAt: Joi.string().isoDate().allow('', null).default(null),
    academicYear: Joi.string().max(20).default('active')
  }),
  assignTenantStudentSubjects: Joi.object({
    subjectIds: Joi.array().items(Joi.string()).min(1).required(),
    classId: Joi.string().allow('', null).default(null),
    assignedAt: Joi.string().isoDate().allow('', null).default(null),
    replace: Joi.boolean().default(false)
  }),
  createTenantEnrollment: Joi.object({
    enrollmentType: Joi.string().valid('class', 'subject').required(),
    studentId: Joi.string().required(),
    classId: Joi.string().allow('', null).when('enrollmentType', { is: 'class', then: Joi.required(), otherwise: Joi.optional() }),
    subjectId: Joi.string().allow('', null).when('enrollmentType', { is: 'subject', then: Joi.required(), otherwise: Joi.optional() }),
    periodId: Joi.string().allow('', null).default(null),
    startsAt: Joi.string().isoDate().allow('', null).default(null),
    endsAt: Joi.string().isoDate().allow('', null).default(null),
    status: Joi.string().valid('pending', 'active', 'completed', 'dropped', 'suspended', 'cancelled').default('active'),
    isPrimary: Joi.boolean().default(false)
  }),
  updateTenantEnrollment: Joi.object({
    classId: Joi.string().allow('', null),
    periodId: Joi.string().allow('', null),
    startsAt: Joi.string().isoDate().allow('', null),
    endsAt: Joi.string().isoDate().allow('', null),
    status: Joi.string().valid('pending', 'active', 'completed', 'dropped', 'suspended', 'cancelled'),
    isPrimary: Joi.boolean()
  }).min(1),
  linkTenantGuardian: Joi.object({
    guardianUserId: Joi.string().required(),
    relationshipType: Joi.string().max(40).default('guardian'),
    canViewReports: Joi.boolean().default(true),
    canReceiveNotifications: Joi.boolean().default(true)
  }),
  createTenantTeacherAssignment: Joi.object({
    teacherUserId: Joi.string().required(),
    classId: Joi.string().required(),
    subjectId: Joi.string().required(),
    periodId: Joi.string().allow('', null).default(null),
    assignmentRole: Joi.string().max(40).default('lead'),
    startsAt: Joi.string().isoDate().allow('', null).default(null),
    endsAt: Joi.string().isoDate().allow('', null).default(null),
    status: Joi.string().valid('planned', 'active', 'completed', 'suspended', 'cancelled').default('active')
  }),
  updateTenantTeacherAssignment: Joi.object({
    teacherUserId: Joi.string(),
    classId: Joi.string(),
    subjectId: Joi.string(),
    periodId: Joi.string().allow('', null),
    assignmentRole: Joi.string().max(40),
    startsAt: Joi.string().isoDate().allow('', null),
    endsAt: Joi.string().isoDate().allow('', null),
    status: Joi.string().valid('planned', 'active', 'completed', 'suspended', 'cancelled')
  }).min(1),
  setTenantRoleAccess: Joi.object({
    moduleKeys: Joi.array().items(Joi.string()).default([]),
    permissionCodes: Joi.array().items(Joi.string()).default([])
  }),
  updateTenantSettings: Joi.object({
    name: Joi.string().max(150),
    slug: Joi.string().max(80),
    timezone: Joi.string().max(80),
    academicPolicies: Joi.object().unknown(true),
    branding: Joi.object().unknown(true)
  }).min(1)
};
