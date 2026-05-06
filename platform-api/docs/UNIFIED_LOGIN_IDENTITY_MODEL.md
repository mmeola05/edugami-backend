# Modelo de login unico e identidad

## Objetivo

La experiencia de producto debe tener un login visual unico: email/usuario y contrasena.

El usuario no debe elegir si es ROOT, tenant, padre/tutor o usuario publico antes de autenticarse. El backend resuelve los accesos disponibles despues de validar credenciales.

## Ambitos de cuenta

EduGami puede tener varios ambitos:

- `platform`: cuentas internas ROOT/SUPPORT, tabla `platform_accounts`.
- `tenant`: cuentas vinculadas a un centro/tenant, tabla `tenant_users`.
- `public`: cuentas sin tenant para perfil y actividades publicas, tabla `public_accounts`.

Estos ambitos no son lo mismo que roles. Son superficies de acceso.

## Usuario publico sin tenant

Un usuario publico puede existir sin pertenecer a ningun tenant. Casos futuros:

- gestionar su perfil,
- participar en actividades publicas,
- acceder a contenido abierto,
- convertirse mas adelante en alumno, padre/tutor o usuario tenant sin perder identidad.

Este usuario no debe tener `tenant_id` obligatorio.

## Resolucion recomendada del login

1. Buscar el email en `platform_accounts`, `tenant_users` y `public_accounts`.
2. Validar password en los candidatos encontrados.
3. Construir una lista de contextos disponibles.
4. Si solo hay un contexto, entrar directamente.
5. Si hay varios, mostrar selector despues del login.

Ejemplo de contextos:

```json
[
  { "scope": "platform", "label": "ROOT" },
  { "scope": "tenant", "tenantId": "...", "label": "Colegio A" },
  { "scope": "public", "label": "Perfil personal" }
]
```

## Regla importante

No mezclar `tenant_id` con identidad global.

Un usuario puede:

- no tener ningun tenant,
- tener un tenant,
- tener varios tenants,
- tener hijos autorizados en varios tenants,
- tener tambien perfil publico.

El login identifica a la persona/cuenta. El contexto define que puede hacer en ese momento.

## Estado actual preparado

La migracion `013_public_accounts_identity_scope.sql` deja preparada la base para:

- scope `PUBLIC`,
- modulos publicos basicos,
- permisos publicos basicos,
- tabla `public_accounts`,
- refresh tokens publicos,
- reset tokens publicos,
- permisos directos de cuenta publica.

Todavia no obliga a usar usuario publico ni cambia el login actual. Solo evita que en el futuro haya que romper el modelo.

## Modulos reutilizables por scope

Para no duplicar codigo, un modulo debe ser una capacidad funcional reutilizable. Por ejemplo:

- `PROFILE`,
- `ACTIVITIES`,
- `AI_TUTOR`.

La disponibilidad por tipo de usuario vive en `module_scope_availability`:

- `ACTIVITIES` puede estar disponible en `PUBLIC`,
- `ACTIVITIES` puede estar disponible en `TENANT`,
- la UI puede reutilizar la misma pantalla,
- permisos y datos cambian segun contexto.

Ejemplo:

- usuario publico: `scope=PUBLIC`, permisos `public_activities.read`, datos sin tenant,
- alumno tenant: `scope=TENANT`, permisos `activities.read`, datos filtrados por tenant/alumno/clase.

La regla de producto es no duplicar pantallas por tipo de cuenta. Se reutiliza la pantalla y se cambia comportamiento por contexto, permisos y origen de datos.
