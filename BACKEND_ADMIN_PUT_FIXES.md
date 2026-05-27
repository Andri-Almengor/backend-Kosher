# Cambios aplicados al backend admin

Se ajustó el backend para que el panel de administración pueda editar correctamente estas secciones:

- Productos
- Comercios / Restaurantes
- Novedades / Noticias
- Usuarios

## Cambios principales

1. Se reforzaron las rutas `PUT` existentes.
2. Se agregaron rutas `PATCH` equivalentes para actualizaciones parciales.
3. Se agregaron alias compatibles:
   - `/api/admin/comercios` además de `/api/admin/restaurantes`
   - `/api/admin/novedades` además de `/api/admin/noticias`
4. Se agregó manejo explícito de `OPTIONS` para preflight CORS.
5. Se configuró CORS para permitir:
   - `GET`
   - `POST`
   - `PUT`
   - `PATCH`
   - `DELETE`
   - `OPTIONS`
6. Se agregaron sanitizadores por modelo para evitar errores de Prisma cuando el frontend manda campos públicos o extras como:
   - `id`
   - `creadoEn`
   - `actualizadoEn`
   - `nombre`, `tipo`, `ubicacion` en comercios
   - `rol` como texto en usuarios
7. Se normalizan booleanos como `true`, `false`, `1`, `0`, `sí`, `no`, `activo`, `inactivo`.
8. En usuarios, si se manda `password`, el backend la convierte automáticamente a `passwordHash`.

## Archivos modificados

- `src/app.js`
- `src/modules/admin/admin.routes.js`

## Rutas importantes disponibles

### Productos

- `GET /api/admin/productos`
- `POST /api/admin/productos`
- `PUT /api/admin/productos/:id`
- `PATCH /api/admin/productos/:id`
- `DELETE /api/admin/productos/:id`

### Comercios / Restaurantes

- `GET /api/admin/restaurantes`
- `POST /api/admin/restaurantes`
- `PUT /api/admin/restaurantes/:id`
- `PATCH /api/admin/restaurantes/:id`
- `DELETE /api/admin/restaurantes/:id`

También funcionan:

- `GET /api/admin/comercios`
- `POST /api/admin/comercios`
- `PUT /api/admin/comercios/:id`
- `PATCH /api/admin/comercios/:id`
- `DELETE /api/admin/comercios/:id`

### Novedades / Noticias

- `GET /api/admin/noticias`
- `POST /api/admin/noticias`
- `PUT /api/admin/noticias/:id`
- `PATCH /api/admin/noticias/:id`
- `DELETE /api/admin/noticias/:id`

También funcionan:

- `GET /api/admin/novedades`
- `POST /api/admin/novedades`
- `PUT /api/admin/novedades/:id`
- `PATCH /api/admin/novedades/:id`
- `DELETE /api/admin/novedades/:id`

### Usuarios

- `GET /api/admin/usuarios`
- `POST /api/admin/usuarios`
- `PUT /api/admin/usuarios/:id`
- `PATCH /api/admin/usuarios/:id`
- `DELETE /api/admin/usuarios/:id`
