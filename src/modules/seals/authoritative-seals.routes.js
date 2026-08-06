const router = require('express').Router();
const { recordManualSealMigration } = require('./seal-authority-bootstrap');
const {
  auditCatalog,
  calculateUsage,
  createSeal,
  deleteSeal,
  getRows,
  reconcileProducts,
  rowToPublic,
  syncExistingSourcesAndReconcile,
  updateSeal,
} = require('./seal-catalog.service');

router.options('*', (_req, res) => res.sendStatus(204));

// Lectura pura: listar sellos nunca vuelve a importar valores antiguos de productos.
router.get('/', async (req, res, next) => {
  try {
    const includeInactive = String(req.query?.includeInactive || '').toLowerCase() === 'true';
    const rows = await getRows({ includeInactive, includeDeleted: false });
    const usage = await calculateUsage(rows);
    res.json(rows.map((row) => rowToPublic(row, usage.get(row.id) || 0)));
  } catch (error) {
    next(error);
  }
});

router.get('/audit', async (_req, res, next) => {
  try {
    res.json({ ok: true, ...(await auditCatalog()) });
  } catch (error) {
    next(error);
  }
});

// Acción explícita de migración: importa el legado una sola vez, deduplica y
// deja todos los productos apuntando a los valores canónicos de la tabla.
router.post('/sync-existing', async (_req, res, next) => {
  try {
    const result = await syncExistingSourcesAndReconcile();
    await recordManualSealMigration(result);
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.post('/reconcile-products', async (_req, res, next) => {
  try {
    const result = await reconcileProducts({ clearUnknown: true });
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    res.status(201).json(await createSeal(req.body));
  } catch (error) {
    next(error);
  }
});

async function updateHandler(req, res, next) {
  try {
    res.json(await updateSeal(req.params.id, req.body));
  } catch (error) {
    next(error);
  }
}

router.put('/:id', updateHandler);
router.patch('/:id', updateHandler);

router.delete('/:id', async (req, res, next) => {
  try {
    res.json(await deleteSeal(req.params.id));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
