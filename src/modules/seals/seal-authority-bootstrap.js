const prisma = require('../../lib/prisma');
const { syncExistingSourcesAndReconcile } = require('./seal-catalog.service');

const MIGRATION_KEY = 'product-seals-authoritative-v1';
let migrationPromise = null;

async function ensureInitialSealMigration() {
  const completed = await prisma.uiSetting.findUnique({ where: { key: MIGRATION_KEY } });
  if (completed?.activo) return completed.value || { alreadyCompleted: true };

  if (!migrationPromise) {
    migrationPromise = (async () => {
      const result = await syncExistingSourcesAndReconcile();
      const value = {
        completedAt: new Date().toISOString(),
        ...result,
      };
      await prisma.uiSetting.upsert({
        where: { key: MIGRATION_KEY },
        create: { key: MIGRATION_KEY, value, activo: true },
        update: { value, activo: true },
      });
      return value;
    })().finally(() => {
      migrationPromise = null;
    });
  }

  return migrationPromise;
}

module.exports = {
  ensureInitialSealMigration,
};
