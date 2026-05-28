# Push Notifications - Backend Kosher Costa Rica

Esta versión agrega soporte backend para notificaciones push reales usando Expo Push API.

## Nuevas rutas públicas

### Registrar token
`POST /api/push-tokens/register`

Body recomendado desde la app:

```json
{
  "token": "ExponentPushToken[xxxx]",
  "platform": "android",
  "language": "es",
  "deviceId": "opcional",
  "appVersion": "3.0.2"
}
```

### Desactivar token
`POST /api/push-tokens/unregister`

```json
{
  "token": "ExponentPushToken[xxxx]"
}
```

### Estadísticas
`GET /api/push-tokens/stats`

### Prueba
`POST /api/push-tokens/send-test`

```json
{
  "title": "Kosher Costa Rica",
  "body": "Notificación de prueba",
  "language": "es"
}
```

## Nuevas rutas admin

- `GET /api/admin/push-tokens/stats`
- `POST /api/admin/push/send-test`

## Envío automático desde admin

### Noticias / novedades
Ya existía el campo `notifyUsers` en la tabla `noticias`. Si se envía en `true`, el backend envía push automáticamente:

```json
{
  "titulo": "Nueva novedad",
  "contenido": "...",
  "notifyUsers": true
}
```

### Productos
No se cambia la tabla de productos. Para enviar push al crear producto, manda `notifyUsers: true` o `sendNotification: true` en el body.

### Restaurantes / comercios
No se cambia la tabla de restaurantes. Para enviar push al crear comercio/restaurante, manda `notifyUsers: true` o `sendNotification: true` en el body.

## Migración Prisma

Ejecutar después de subir el código:

```bash
npx prisma migrate deploy
npx prisma generate
```

En desarrollo local también puedes usar:

```bash
npx prisma migrate dev
```

## Notas

- No requiere instalar `expo-server-sdk`; usa directamente la Expo Push API con `fetch`.
- Node 18+ ya trae `fetch` global. Render normalmente usa Node moderno.
- Los tokens inválidos se desactivan automáticamente cuando Expo responde `DeviceNotRegistered`.
- Guarda idioma, plataforma, versión y último uso del dispositivo.
