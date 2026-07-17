const router = require('express').Router();
const cloudinary = require('cloudinary').v2;
const prisma = require('../../lib/prisma');

const LEGACY_CATALOG_KEY = 'product-seals';
const DEFAULT_FOLDER = 'kosher-costa-rica/sellos';

router.options('*', (_req, res) => res.sendStatus(204));

function normalizeTextKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function shortHash(value) {
  const text = String(value || '');
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
  return (hash >>> 0).toString(36).slice(0, 7).toUpperCase();
}

function normalizeBoolean(value, fallback = true) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'si', 'sí', 'activo'].includes(normalized)) return true;
    if (['false', '0', 'no', 'inactivo'].includes(normalized)) return false;
  }
  return fallback;
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error('ID de sello inválido.');
    error.status = 400;
    throw error;
  }
  return id;
}

function isCloudinaryUrl(value) {
  return /^https:\/\/res\.cloudinary\.com\//i.test(String(value || '').trim());
}

function extractCloudinaryPublicId(url) {
  try {
    const value = String(url || '').trim();
    if (!isCloudinaryUrl(value)) return '';
    const path = new URL(value).pathname;
    const uploadIndex = path.indexOf('/upload/');
    if (uploadIndex < 0) return '';
    let rest = path.slice(uploadIndex + '/upload/'.length).replace(/^v\d+\//, '');
    return rest.replace(/\.[a-zA-Z0-9]+$/, '');
  } catch {
    return '';
  }
}

function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    const error = new Error('Cloudinary no está configurado en el backend.');
    error.status = 500;
    throw error;
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
}

async function materializeImageUrl(rawUrl, oldUrl = '') {
  const value = String(rawUrl || '').trim();
  if (!value) return null;
  if (isCloudinaryUrl(value)) return value;
  if (!/^https?:\/\//i.test(value) && !/^data:image\//i.test(value)) {
    const error = new Error('El enlace de imagen no es válido.');
    error.status = 400;
    throw error;
  }

  configureCloudinary();
  const uploaded = await cloudinary.uploader.upload(value, {
    folder: DEFAULT_FOLDER,
    resource_type: 'image',
    overwrite: false,
    unique_filename: true,
    transformation: [
      { width: 1800, height: 1800, crop: 'limit' },
      { quality: 'auto:good', fetch_format: 'auto' },
    ],
  });

  const oldPublicId = extractCloudinaryPublicId(oldUrl);
  if (oldPublicId && oldPublicId !== uploaded.public_id) {
    cloudinary.uploader.destroy(oldPublicId, { resource_type: 'image' }).catch(() => {});
  }

  return uploaded.secure_url;
}

async function ensureSealTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS sellos_productos (
      id SERIAL PRIMARY KEY,
      clave_normalizada TEXT NOT NULL UNIQUE,
      nombre_es TEXT NOT NULL,
      nombre_en TEXT,
      image_url TEXT,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      eliminado BOOLEAN NOT NULL DEFAULT FALSE,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_sellos_productos_activo ON sellos_productos (activo)');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS idx_sellos_productos_image_url ON sellos_productos (image_url)');
}

function rowToPublic(row, usageCount = 0) {
  return {
    id: row.id,
    nombreEs: row.nombre_es,
    nombreEn: row.nombre_en || row.nombre_es,
    valueEs: row.nombre_es,
    valueEn: row.nombre_en || row.nombre_es,
    imageUrl: row.image_url || '',
    activo: row.activo !== false,
    eliminado: row.eliminado === true,
    usageCount,
    creadoEn: row.creado_en || null,
    actualizadoEn: row.actualizado_en || null,
  };
}

async function getRows({ includeInactive = false, includeDeleted = false } = {}) {
  await ensureSealTable();
  const clauses = [];
  if (!includeInactive) clauses.push('activo = TRUE');
  if (!includeDeleted) clauses.push('eliminado = FALSE');
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return prisma.$queryRawUnsafe(`SELECT * FROM sellos_productos ${where} ORDER BY nombre_es ASC, id ASC`);
}

function candidateFrom(raw = {}, fallbackSeed = '') {
  let nombreEs = String(raw.nombreEs ?? raw.valueEs ?? raw.sello ?? raw.nombre ?? '').trim();
  let nombreEn = String(raw.nombreEn ?? raw.valueEn ?? raw.selloEn ?? '').trim();
  const imageUrl = String(raw.imageUrl ?? raw.fotoSello1 ?? raw.fotoSello2 ?? raw.url ?? '').trim();

  if (!nombreEs && !nombreEn && imageUrl) {
    nombreEs = `Sello sin nombre ${shortHash(imageUrl || fallbackSeed)}`;
    nombreEn = `Unnamed seal ${shortHash(imageUrl || fallbackSeed)}`;
  }
  nombreEs = nombreEs || nombreEn;
  nombreEn = nombreEn || nombreEs;
  const key = normalizeTextKey(nombreEs || nombreEn);
  if (!key) return null;
  return { key, nombreEs, nombreEn, imageUrl: imageUrl || null };
}

function mergeCandidates(candidates) {
  const byKey = new Map();
  const keyByImage = new Map();

  for (const candidate of candidates.filter(Boolean)) {
    const imageKey = String(candidate.imageUrl || '').trim().toLowerCase();
    const existingKey = imageKey ? keyByImage.get(imageKey) : null;
    const targetKey = existingKey || candidate.key;
    const current = byKey.get(targetKey);

    if (!current) {
      byKey.set(targetKey, { ...candidate, key: targetKey });
      if (imageKey) keyByImage.set(imageKey, targetKey);
      continue;
    }

    if (!current.nombreEs && candidate.nombreEs) current.nombreEs = candidate.nombreEs;
    if (!current.nombreEn && candidate.nombreEn) current.nombreEn = candidate.nombreEn;
    if (!current.imageUrl && candidate.imageUrl) current.imageUrl = candidate.imageUrl;
    if (imageKey) keyByImage.set(imageKey, targetKey);
  }

  return [...byKey.values()];
}

async function writeLegacyCatalog() {
  const rows = await getRows({ includeInactive: false, includeDeleted: false });
  const value = rows.map((row) => ({
    id: String(row.id),
    nombreEs: row.nombre_es,
    nombreEn: row.nombre_en || row.nombre_es,
    valueEs: row.nombre_es,
    valueEn: row.nombre_en || row.nombre_es,
    imageUrl: row.image_url || '',
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
  }));
  await prisma.uiSetting.upsert({
    where: { key: LEGACY_CATALOG_KEY },
    create: { key: LEGACY_CATALOG_KEY, value, activo: true },
    update: { value, activo: true },
  });
}

async function syncExistingSources() {
  await ensureSealTable();
  const [legacyRow, products, tableRows] = await Promise.all([
    prisma.uiSetting.findUnique({ where: { key: LEGACY_CATALOG_KEY } }),
    prisma.producto.findMany({ select: { id: true, sello: true, selloEn: true, fotoSello1: true, fotoSello2: true } }),
    getRows({ includeInactive: true, includeDeleted: true }),
  ]);

  const legacy = Array.isArray(legacyRow?.value) ? legacyRow.value : [];
  const legacyByImage = new Map(
    legacy
      .map((item) => [String(item?.imageUrl || '').trim().toLowerCase(), item])
      .filter(([key]) => key)
  );

  const candidates = legacy.map((item, index) => candidateFrom(item, `legacy-${index}`));
  for (const product of products) {
    candidates.push(candidateFrom({
      nombreEs: product.sello,
      nombreEn: product.selloEn,
      imageUrl: product.fotoSello1 || product.fotoSello2,
    }, `product-${product.id}-primary`));

    if (product.fotoSello2 && product.fotoSello2 !== product.fotoSello1) {
      const legacyMatch = legacyByImage.get(String(product.fotoSello2).trim().toLowerCase());
      candidates.push(candidateFrom(legacyMatch || { imageUrl: product.fotoSello2 }, `product-${product.id}-secondary`));
    }
  }

  const deletedKeys = new Set(tableRows.filter((row) => row.eliminado).map((row) => row.clave_normalizada));
  const deletedImages = new Set(tableRows.filter((row) => row.eliminado && row.image_url).map((row) => String(row.image_url).toLowerCase()));
  const merged = mergeCandidates(candidates).filter((item) => {
    const imageKey = String(item.imageUrl || '').toLowerCase();
    return !deletedKeys.has(item.key) && !(imageKey && deletedImages.has(imageKey));
  });

  let imported = 0;
  for (const item of merged) {
    const before = await prisma.$queryRawUnsafe('SELECT id FROM sellos_productos WHERE clave_normalizada = $1 LIMIT 1', item.key);
    await prisma.$executeRawUnsafe(
      `INSERT INTO sellos_productos (clave_normalizada, nombre_es, nombre_en, image_url, activo, eliminado)
       VALUES ($1, $2, $3, $4, TRUE, FALSE)
       ON CONFLICT (clave_normalizada) DO UPDATE SET
         nombre_en = COALESCE(NULLIF(sellos_productos.nombre_en, ''), EXCLUDED.nombre_en),
         image_url = COALESCE(NULLIF(sellos_productos.image_url, ''), EXCLUDED.image_url),
         actualizado_en = CURRENT_TIMESTAMP
       WHERE sellos_productos.eliminado = FALSE`,
      item.key,
      item.nombreEs,
      item.nombreEn,
      item.imageUrl
    );
    if (!before.length) imported += 1;
  }

  await writeLegacyCatalog();
  const totalRows = await getRows({ includeInactive: true, includeDeleted: false });
  return { imported, total: totalRows.length };
}

async function calculateUsage(rows) {
  const products = await prisma.producto.findMany({
    select: { sello: true, selloEn: true, fotoSello1: true, fotoSello2: true },
  });
  const counts = new Map();
  for (const row of rows) {
    const key = row.clave_normalizada;
    const image = String(row.image_url || '').trim();
    const count = products.filter((product) => {
      return normalizeTextKey(product.sello) === key ||
        normalizeTextKey(product.selloEn) === key ||
        (!!image && (product.fotoSello1 === image || product.fotoSello2 === image));
    }).length;
    counts.set(row.id, count);
  }
  return counts;
}

async function getRowById(id) {
  await ensureSealTable();
  const rows = await prisma.$queryRawUnsafe('SELECT * FROM sellos_productos WHERE id = $1 AND eliminado = FALSE LIMIT 1', id);
  return rows[0] || null;
}

async function findDuplicate({ key, imageUrl, excludeId }) {
  const values = [key, imageUrl || null];
  let sql = `SELECT * FROM sellos_productos
    WHERE eliminado = FALSE
      AND (clave_normalizada = $1 OR ($2::text IS NOT NULL AND image_url = $2))`;
  if (excludeId) {
    sql += ' AND id <> $3';
    values.push(excludeId);
  }
  sql += ' LIMIT 1';
  const rows = await prisma.$queryRawUnsafe(sql, ...values);
  return rows[0] || null;
}

async function propagateUpdate(oldRow, next) {
  const oldNames = [...new Set([oldRow.nombre_es, oldRow.nombre_en].filter(Boolean))];
  if (oldNames.length) {
    await prisma.producto.updateMany({ where: { sello: { in: oldNames } }, data: { sello: next.nombreEs } });
    await prisma.producto.updateMany({ where: { selloEn: { in: oldNames } }, data: { selloEn: next.nombreEn } });
  }
  if (oldRow.image_url && oldRow.image_url !== next.imageUrl) {
    await prisma.producto.updateMany({ where: { fotoSello1: oldRow.image_url }, data: { fotoSello1: next.imageUrl } });
    await prisma.producto.updateMany({ where: { fotoSello2: oldRow.image_url }, data: { fotoSello2: next.imageUrl } });
  }
}

async function unlinkFromProducts(row) {
  const oldNames = [...new Set([row.nombre_es, row.nombre_en].filter(Boolean))];
  if (oldNames.length) {
    await prisma.producto.updateMany({ where: { sello: { in: oldNames } }, data: { sello: null } });
    await prisma.producto.updateMany({ where: { selloEn: { in: oldNames } }, data: { selloEn: null } });
  }
  if (row.image_url) {
    await prisma.producto.updateMany({ where: { fotoSello1: row.image_url }, data: { fotoSello1: null } });
    await prisma.producto.updateMany({ where: { fotoSello2: row.image_url }, data: { fotoSello2: null } });
  }
}

router.get('/', async (req, res, next) => {
  try {
    await syncExistingSources();
    const includeInactive = String(req.query?.includeInactive || '').toLowerCase() === 'true';
    const rows = await getRows({ includeInactive, includeDeleted: false });
    const usage = await calculateUsage(rows);
    res.json(rows.map((row) => rowToPublic(row, usage.get(row.id) || 0)));
  } catch (error) {
    next(error);
  }
});

router.post('/sync-existing', async (_req, res, next) => {
  try {
    const result = await syncExistingSources();
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    await ensureSealTable();
    const nombreEs = String(req.body?.nombreEs ?? req.body?.valueEs ?? req.body?.nombreEn ?? '').trim();
    const nombreEn = String(req.body?.nombreEn ?? req.body?.valueEn ?? nombreEs).trim() || nombreEs;
    if (!nombreEs) return res.status(400).json({ message: 'El sello necesita un nombre.' });

    const key = normalizeTextKey(nombreEs);
    const imageUrl = await materializeImageUrl(req.body?.imageUrl);
    if (!imageUrl) return res.status(400).json({ message: 'El sello necesita una imagen.' });

    const duplicate = await findDuplicate({ key, imageUrl });
    if (duplicate) return res.status(409).json({ message: 'Ya existe un sello con ese nombre o imagen.', seal: rowToPublic(duplicate) });

    const tombstones = await prisma.$queryRawUnsafe('SELECT * FROM sellos_productos WHERE clave_normalizada = $1 LIMIT 1', key);
    let rows;
    if (tombstones[0]) {
      rows = await prisma.$queryRawUnsafe(
        `UPDATE sellos_productos SET nombre_es = $2, nombre_en = $3, image_url = $4, activo = $5,
         eliminado = FALSE, actualizado_en = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        tombstones[0].id,
        nombreEs,
        nombreEn,
        imageUrl,
        normalizeBoolean(req.body?.activo, true)
      );
    } else {
      rows = await prisma.$queryRawUnsafe(
        `INSERT INTO sellos_productos (clave_normalizada, nombre_es, nombre_en, image_url, activo, eliminado)
         VALUES ($1, $2, $3, $4, $5, FALSE) RETURNING *`,
        key,
        nombreEs,
        nombreEn,
        imageUrl,
        normalizeBoolean(req.body?.activo, true)
      );
    }

    await writeLegacyCatalog();
    res.status(201).json(rowToPublic(rows[0], 0));
  } catch (error) {
    next(error);
  }
});

async function updateSeal(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const current = await getRowById(id);
    if (!current) return res.status(404).json({ message: 'Sello no encontrado.' });

    const nombreEs = String(req.body?.nombreEs ?? req.body?.valueEs ?? current.nombre_es).trim();
    const nombreEn = String(req.body?.nombreEn ?? req.body?.valueEn ?? current.nombre_en ?? nombreEs).trim() || nombreEs;
    if (!nombreEs) return res.status(400).json({ message: 'El sello necesita un nombre.' });

    const key = normalizeTextKey(nombreEs);
    const requestedImage = Object.prototype.hasOwnProperty.call(req.body || {}, 'imageUrl') ? req.body.imageUrl : current.image_url;
    const imageUrl = await materializeImageUrl(requestedImage, current.image_url);
    if (!imageUrl) return res.status(400).json({ message: 'El sello necesita una imagen.' });

    const duplicate = await findDuplicate({ key, imageUrl, excludeId: id });
    if (duplicate) return res.status(409).json({ message: 'Otro sello ya usa ese nombre o imagen.', seal: rowToPublic(duplicate) });

    const nextValue = {
      nombreEs,
      nombreEn,
      imageUrl,
      activo: normalizeBoolean(req.body?.activo, current.activo !== false),
    };

    const rows = await prisma.$queryRawUnsafe(
      `UPDATE sellos_productos SET clave_normalizada = $2, nombre_es = $3, nombre_en = $4,
       image_url = $5, activo = $6, actualizado_en = CURRENT_TIMESTAMP
       WHERE id = $1 AND eliminado = FALSE RETURNING *`,
      id,
      key,
      nextValue.nombreEs,
      nextValue.nombreEn,
      nextValue.imageUrl,
      nextValue.activo
    );

    await propagateUpdate(current, nextValue);
    await writeLegacyCatalog();
    const usage = await calculateUsage(rows);
    res.json(rowToPublic(rows[0], usage.get(id) || 0));
  } catch (error) {
    next(error);
  }
}

router.put('/:id', updateSeal);
router.patch('/:id', updateSeal);

router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const current = await getRowById(id);
    if (!current) return res.status(404).json({ message: 'Sello no encontrado.' });

    await unlinkFromProducts(current);
    await prisma.$executeRawUnsafe(
      `UPDATE sellos_productos SET activo = FALSE, eliminado = TRUE, actualizado_en = CURRENT_TIMESTAMP WHERE id = $1`,
      id
    );
    await writeLegacyCatalog();

    const publicId = extractCloudinaryPublicId(current.image_url);
    if (publicId) {
      try {
        configureCloudinary();
        cloudinary.uploader.destroy(publicId, { resource_type: 'image' }).catch(() => {});
      } catch {}
    }

    res.json({ ok: true, id });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
