const express = require('express');
const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'backend', timestamp: new Date().toISOString() });
});

router.use('/auth', require('../modules/auth/auth.routes'));
router.use('/sync', require('../modules/sync/sync.routes'));
router.use('/restaurantes', require('../modules/restaurants/restaurants.routes'));
router.use('/push-tokens', require('../modules/push/push.routes'));
router.use('/', require('../modules/public/public.routes'));

// Debe montarse antes del router administrativo general para reemplazar
// el catálogo legado de sellos guardado dentro de ui_settings.
router.use('/admin/productos/sellos', require('../modules/seals/seals.routes'));
router.use('/admin', require('../modules/admin/admin.routes'));

module.exports = router;
