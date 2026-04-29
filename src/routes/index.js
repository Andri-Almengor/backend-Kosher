const express = require('express');
const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'backend', timestamp: new Date().toISOString() });
});

router.use('/auth', require('../modules/auth/auth.routes'));
router.use('/sync', require('../modules/sync/sync.routes'));
router.use('/restaurantes', require('../modules/restaurants/restaurants.routes'));
router.use('/', require('../modules/public/public.routes'));
router.use('/admin', require('../modules/admin/admin.routes'));

module.exports = router;
