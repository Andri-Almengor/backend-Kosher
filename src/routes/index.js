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

// Antes del router administrativo general, valida que cada producto use
// exclusivamente sellos activos del catálogo normalizado.
router.use(
  '/admin/productos',
  require('../modules/seals/product-seal-canonical.middleware')
);

// La tabla sellos_productos es la única fuente de verdad. Esta ruta reemplaza
// completamente el catálogo legado que se reconstruía desde los productos.
router.use(
  '/admin/productos/sellos',
  require('../modules/seals/authoritative-seals.routes')
);

router.use('/admin', require('../modules/admin/admin.routes'));

module.exports = router;
