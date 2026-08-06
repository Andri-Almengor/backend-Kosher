const router = require('express').Router();
const { ensureInitialSealMigration } = require('./seal-authority-bootstrap');
const {
  auditCatalog,
  calculateUsage,
  createSeal,
  deleteSeal,
  getRows,
  reconcileProducts,
  rowToPublic,
  updateSeal,
  writeLegacyCatalog,
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

// La importación del legado ocurre únicamente dentro de ensureInitialSealMigration.
// Después de quedar marcada, este botón solo vuelve a aplicar los valores oficiales
// de la tabla a los productos; nunca reimporta sellos huérfanos desde ellos.
router.post('/sync-existing', async (_req, res, next) => {
  try {
    const migration = await ensureInitialSealMigration();
    const reconciliation = await reconcileProducts({ clearUnknown: true });
    await writeLegacyCatalog();
    res.json({
      ok: true,
      alreadyMigrated: true,
      migration,
      ...reconciliation,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/reconcile-products', async (_req, res, next) => {
  try {
    const result = await reconcileProducts({ clearUnknown: true });
    await writeLegacyCatalog();
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
