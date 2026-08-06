const cloudinary = require('cloudinary').v2;
const prisma = require('../../lib/prisma');

const LEGACY_CATALOG_KEY = 'product-seals';
const DEFAULT_FOLDER = 'kosher-costa-rica/sellos';
const PRODUCT_SEAL_FIELDS = ['sello', 'selloEn', 'fotoSello1', 'fotoSello2'];

function createHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  error.statusCode = status;
  return error;
}

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

function normalizeImageKey(value) {
  return String(value ?? '').trim().toLowerCase();
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

function parseSealId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw createHttpError('ID de sello inválido.', 400);
  return id;
}

function shortHash(value) {
  const text = String(value || '');
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(index);
  }
  return (hash >>> 0).toString(36).slice(0, 7).toUpperCase();
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
    const rest = path.slice(uploadIndex + '/upload/'.length).replace(/^v\d+\//, '');
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
    throw createHttpError('Cloudinary no está configurado en el backend.', 500);
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
}

async function materializeImageUrl(rawUrl, oldUrl = '') {
  const value = String(rawUrl || '').trim();
  if (!value) return null;
  if (isCloudinaryUrl(value)) return value;
  if (!/^https?:\/\//i.test(value) && !/^data:image\//i.test(value)) {
    throw createHttpError('El enlace de imagen del sello no es válido.', 400);
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

async function destroyCloudinaryImage(url) {
  const publicId = extractCloudinaryPublicId(url);
  if (!publicId) return;
  try {
    configureCloudinary();
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch {
    // La eliminación remota no debe impedir la limpieza de la base de datos.
  }
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
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS idx_sellos_productos_activo ON sellos_productos (activo)'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS idx_sellos_productos_image_url ON sellos_productos (image_url)'
  );
}

async function getRows({ includeInactive = false, includeDeleted = false } = {}) {
  await ensureSealTable();
  const clauses = [];
  if (!includeInactive) clauses.push('activo = TRUE');
  if (!includeDeleted) clauses.push('eliminado = FALSE');
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return prisma.$queryRawUnsafe(
    `SELECT * FROM sellos_productos ${where} ORDER BY nombre_es ASC, id ASC`
  );
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

async function getRowById(id, { includeDeleted = false } = {}) {
  await ensureSealTable();
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM sellos_productos WHERE id = $1 ${includeDeleted ? '' : 'AND eliminado = FALSE'} LIMIT 1`,
    id
  );
  return rows[0] || null;
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

function getProductNameKeys(product = {}) {
  return [...new Set([normalizeTextKey(product.sello), normalizeTextKey(product.selloEn)].filter(Boolean))];
}

function findSealMatches(rows, { nombreEs, nombreEn, imageUrl } = {}) {
  const nameKeys = new Set(
    [normalizeTextKey(nombreEs), normalizeTextKey(nombreEn)].filter(Boolean)
  );
  const imageKey = normalizeImageKey(imageUrl);

  const nameMatches = rows.filter((row) => {
    if (!nameKeys.size) return false;
    return nameKeys.has(row.clave_normalizada) || nameKeys.has(normalizeTextKey(row.nombre_en));
  });
  const imageMatches = imageKey
    ? rows.filter((row) => normalizeImageKey(row.image_url) === imageKey)
    : [];

  return { nameMatches, imageMatches };
}

function resolveSealFromRows(rows, hints, { required = true } = {}) {
  const { nameMatches, imageMatches } = findSealMatches(rows, hints);
  const byName = nameMatches[0] || null;
  const byImage = imageMatches[0] || null;

  if (byName && byImage && byName.id !== byImage.id) {
    throw createHttpError(
      'El nombre y la imagen seleccionados pertenecen a sellos diferentes. Selecciona nuevamente el sello desde el catálogo.',
      409
    );
  }

  if (nameMatches.length > 1 || imageMatches.length > 1) {
    throw createHttpError(
      'El catálogo contiene sellos duplicados para esta selección. Ejecuta la sincronización de sellos antes de continuar.',
      409
    );
  }

  const selected = byImage || byName;
  if (!selected && required) {
    throw createHttpError(
      'El sello seleccionado no existe o está inactivo. Debes elegirlo desde el apartado Sellos.',
      400
    );
  }
  return selected || null;
}

async function canonicalizeProductSealBody(body = {}, { currentProduct = null, partial = false } = {}) {
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(body || {}, key);
  const touchesSeal = !partial || PRODUCT_SEAL_FIELDS.some(hasOwn);
  if (!touchesSeal) return { ...body };

  const rows = await getRows({ includeInactive: false, includeDeleted: false });
  const effective = (key) => (hasOwn(key) ? body[key] : currentProduct?.[key]);
  const next = { ...body };

  const primaryHints = {
    nombreEs: String(effective('sello') ?? '').trim(),
    nombreEn: String(effective('selloEn') ?? '').trim(),
    imageUrl: String(effective('fotoSello1') ?? '').trim(),
  };
  const hasPrimary = Boolean(primaryHints.nombreEs || primaryHints.nombreEn || primaryHints.imageUrl);

  let primary = null;
  if (hasPrimary) {
    primary = resolveSealFromRows(rows, primaryHints);
    next.sello = primary.nombre_es;
    next.selloEn = primary.nombre_en || primary.nombre_es;
    next.fotoSello1 = primary.image_url || null;
  } else {
    next.sello = null;
    next.selloEn = null;
    next.fotoSello1 = null;
  }

  const secondaryImage = String(effective('fotoSello2') ?? '').trim();
  if (secondaryImage) {
    const secondary = resolveSealFromRows(rows, { imageUrl: secondaryImage });
    next.fotoSello2 =
      primary && normalizeImageKey(primary.image_url) === normalizeImageKey(secondary.image_url)
        ? null
        : secondary.image_url || null;
  } else {
    next.fotoSello2 = null;
  }

  return next;
}

async function calculateUsage(rows) {
  const products = await prisma.producto.findMany({
    select: { sello: true, selloEn: true, fotoSello1: true, fotoSello2: true },
  });
  const counts = new Map();

  for (const row of rows) {
    const key = row.clave_normalizada;
    const enKey = normalizeTextKey(row.nombre_en);
    const imageKey = normalizeImageKey(row.image_url);
    let count = 0;

    for (const product of products) {
      const productKeys = getProductNameKeys(product);
      const primaryImage = normalizeImageKey(product.fotoSello1);
      const secondaryImage = normalizeImageKey(product.fotoSello2);
      if (
        productKeys.includes(key) ||
        (enKey && productKeys.includes(enKey)) ||
        (imageKey && (primaryImage === imageKey || secondaryImage === imageKey))
      ) {
        count += 1;
      }
    }
    counts.set(row.id, count);
  }

  return counts;
}

async function runProductUpdates(updates) {
  const batchSize = 25;
  for (let index = 0; index < updates.length; index += batchSize) {
    const batch = updates.slice(index, index + batchSize);
    await Promise.all(
      batch.map(({ id, data }) => prisma.producto.update({ where: { id }, data }))
    );
  }
}

async function rewriteProductsForSeal(oldRow, nextRow = null) {
  const products = await prisma.producto.findMany({
    select: { id: true, sello: true, selloEn: true, fotoSello1: true, fotoSello2: true },
  });
  const oldKey = oldRow.clave_normalizada;
  const oldEnKey = normalizeTextKey(oldRow.nombre_en);
  const oldImageKey = normalizeImageKey(oldRow.image_url);
  const updates = [];

  for (const product of products) {
    const nameKeys = getProductNameKeys(product);
    const primaryImageKey = normalizeImageKey(product.fotoSello1);
    const secondaryImageKey = normalizeImageKey(product.fotoSello2);
    const primaryMatches =
      nameKeys.includes(oldKey) ||
      (oldEnKey && nameKeys.includes(oldEnKey)) ||
      (oldImageKey && primaryImageKey === oldImageKey);
    const secondaryMatches = oldImageKey && secondaryImageKey === oldImageKey;
    const data = {};

    if (primaryMatches) {
      data.sello = nextRow ? nextRow.nombre_es : null;
      data.selloEn = nextRow ? nextRow.nombre_en || nextRow.nombre_es : null;
      data.fotoSello1 = nextRow ? nextRow.image_url || null : null;
    }
    if (secondaryMatches) {
      const nextSecondary = nextRow ? nextRow.image_url || null : null;
      data.fotoSello2 =
        nextRow && primaryMatches && normalizeImageKey(nextRow.image_url) === normalizeImageKey(nextSecondary)
          ? null
          : nextSecondary;
    }

    if (Object.keys(data).length) updates.push({ id: product.id, data });
  }

  await runProductUpdates(updates);
  return updates.length;
}

function chooseProductSeal(rows, product) {
  const { nameMatches, imageMatches } = findSealMatches(rows, {
    nombreEs: product.sello,
    nombreEn: product.selloEn,
    imageUrl: product.fotoSello1,
  });

  // La imagen es el identificador más fuerte cuando el nombre histórico quedó desactualizado.
  return imageMatches[0] || nameMatches[0] || null;
}

async function reconcileProducts({ clearUnknown = true } = {}) {
  const rows = await getRows({ includeInactive: false, includeDeleted: false });
  const products = await prisma.producto.findMany({
    select: { id: true, sello: true, selloEn: true, fotoSello1: true, fotoSello2: true },
  });
  const updates = [];
  const stats = {
    productsUpdated: 0,
    primaryCanonicalized: 0,
    orphanPrimaryCleared: 0,
    secondaryCanonicalized: 0,
    orphanSecondaryCleared: 0,
  };

  for (const product of products) {
    const data = {};
    const hasPrimary = Boolean(
      String(product.sello || '').trim() ||
      String(product.selloEn || '').trim() ||
      String(product.fotoSello1 || '').trim()
    );
    const primary = hasPrimary ? chooseProductSeal(rows, product) : null;

    if (primary) {
      const canonical = {
        sello: primary.nombre_es,
        selloEn: primary.nombre_en || primary.nombre_es,
        fotoSello1: primary.image_url || null,
      };
      if (
        product.sello !== canonical.sello ||
        product.selloEn !== canonical.selloEn ||
        product.fotoSello1 !== canonical.fotoSello1
      ) {
        Object.assign(data, canonical);
        stats.primaryCanonicalized += 1;
      }
    } else if (hasPrimary && clearUnknown) {
      Object.assign(data, { sello: null, selloEn: null, fotoSello1: null });
      stats.orphanPrimaryCleared += 1;
    }

    const secondaryImageKey = normalizeImageKey(product.fotoSello2);
    if (secondaryImageKey) {
      const secondaryMatches = rows.filter(
        (row) => normalizeImageKey(row.image_url) === secondaryImageKey
      );
      const secondary = secondaryMatches[0] || null;
      const effectivePrimaryImage = normalizeImageKey(
        Object.prototype.hasOwnProperty.call(data, 'fotoSello1') ? data.fotoSello1 : product.fotoSello1
      );

      if (secondary) {
        const canonicalSecondary =
          effectivePrimaryImage && effectivePrimaryImage === normalizeImageKey(secondary.image_url)
            ? null
            : secondary.image_url || null;
        if (product.fotoSello2 !== canonicalSecondary) {
          data.fotoSello2 = canonicalSecondary;
          stats.secondaryCanonicalized += 1;
        }
      } else if (clearUnknown) {
        data.fotoSello2 = null;
        stats.orphanSecondaryCleared += 1;
      }
    }

    if (Object.keys(data).length) updates.push({ id: product.id, data });
  }

  await runProductUpdates(updates);
  stats.productsUpdated = updates.length;
  return stats;
}

async function dedupeRowsByImage() {
  const rows = await getRows({ includeInactive: true, includeDeleted: false });
  const byImage = new Map();
  let merged = 0;

  for (const row of rows) {
    const imageKey = normalizeImageKey(row.image_url);
    if (!imageKey) continue;
    const current = byImage.get(imageKey);
    if (!current) {
      byImage.set(imageKey, row);
      continue;
    }

    const survivor = current.activo !== false ? current : row;
    const duplicate = survivor.id === current.id ? row : current;
    byImage.set(imageKey, survivor);

    await prisma.$executeRawUnsafe(
      `UPDATE sellos_productos
       SET activo = FALSE, eliminado = TRUE, actualizado_en = CURRENT_TIMESTAMP
       WHERE id = $1`,
      duplicate.id
    );
    merged += 1;
  }

  return merged;
}

function candidateFrom(raw = {}, fallbackSeed = '') {
  let nombreEs = String(raw.nombreEs ?? raw.valueEs ?? raw.sello ?? raw.nombre ?? '').trim();
  let nombreEn = String(raw.nombreEn ?? raw.valueEn ?? raw.selloEn ?? '').trim();
  const imageUrl = String(
    raw.imageUrl ?? raw.fotoSello1 ?? raw.fotoSello2 ?? raw.url ?? ''
  ).trim();

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

async function importCandidate(candidate, tableRows) {
  if (!candidate) return false;
  const imageKey = normalizeImageKey(candidate.imageUrl);
  const tombstone = tableRows.find(
    (row) =>
      row.eliminado === true &&
      (row.clave_normalizada === candidate.key ||
        (imageKey && normalizeImageKey(row.image_url) === imageKey))
  );
  if (tombstone) return false;

  const existing = tableRows.find(
    (row) =>
      row.eliminado !== true &&
      (row.clave_normalizada === candidate.key ||
        (imageKey && normalizeImageKey(row.image_url) === imageKey))
  );

  if (existing) {
    const nextNameEn = existing.nombre_en || candidate.nombreEn || existing.nombre_es;
    const nextImage = existing.image_url || candidate.imageUrl || null;
    if (nextNameEn !== existing.nombre_en || nextImage !== existing.image_url) {
      await prisma.$executeRawUnsafe(
        `UPDATE sellos_productos
         SET nombre_en = $2, image_url = $3, actualizado_en = CURRENT_TIMESTAMP
         WHERE id = $1`,
        existing.id,
        nextNameEn,
        nextImage
      );
      existing.nombre_en = nextNameEn;
      existing.image_url = nextImage;
    }
    return false;
  }

  const rows = await prisma.$queryRawUnsafe(
    `INSERT INTO sellos_productos
      (clave_normalizada, nombre_es, nombre_en, image_url, activo, eliminado)
     VALUES ($1, $2, $3, $4, TRUE, FALSE)
     RETURNING *`,
    candidate.key,
    candidate.nombreEs,
    candidate.nombreEn,
    candidate.imageUrl
  );
  tableRows.push(rows[0]);
  return true;
}

async function syncExistingSourcesAndReconcile() {
  await ensureSealTable();
  const [legacyRow, products, initialRows] = await Promise.all([
    prisma.uiSetting.findUnique({ where: { key: LEGACY_CATALOG_KEY } }),
    prisma.producto.findMany({
      select: { id: true, sello: true, selloEn: true, fotoSello1: true, fotoSello2: true },
    }),
    getRows({ includeInactive: true, includeDeleted: true }),
  ]);

  const legacy = Array.isArray(legacyRow?.value) ? legacyRow.value : [];
  const legacyByImage = new Map(
    legacy
      .map((item) => [normalizeImageKey(item?.imageUrl), item])
      .filter(([key]) => key)
  );
  const candidates = legacy.map((item, index) => candidateFrom(item, `legacy-${index}`));

  for (const product of products) {
    candidates.push(
      candidateFrom(
        {
          nombreEs: product.sello,
          nombreEn: product.selloEn,
          imageUrl: product.fotoSello1 || product.fotoSello2,
        },
        `product-${product.id}-primary`
      )
    );

    if (product.fotoSello2 && product.fotoSello2 !== product.fotoSello1) {
      const legacyMatch = legacyByImage.get(normalizeImageKey(product.fotoSello2));
      candidates.push(
        candidateFrom(
          legacyMatch || { imageUrl: product.fotoSello2 },
          `product-${product.id}-secondary`
        )
      );
    }
  }

  let imported = 0;
  for (const candidate of candidates) {
    if (await importCandidate(candidate, initialRows)) imported += 1;
  }

  const merged = await dedupeRowsByImage();
  const reconciliation = await reconcileProducts({ clearUnknown: true });
  await writeLegacyCatalog();
  const totalRows = await getRows({ includeInactive: true, includeDeleted: false });

  return {
    imported,
    merged,
    total: totalRows.length,
    ...reconciliation,
  };
}

async function auditCatalog() {
  const [activeRows, allRows, products] = await Promise.all([
    getRows({ includeInactive: false, includeDeleted: false }),
    getRows({ includeInactive: true, includeDeleted: true }),
    prisma.producto.findMany({
      select: { id: true, sello: true, selloEn: true, fotoSello1: true, fotoSello2: true },
    }),
  ]);

  let orphanPrimary = 0;
  let orphanSecondary = 0;
  for (const product of products) {
    const hasPrimary = Boolean(
      String(product.sello || '').trim() ||
      String(product.selloEn || '').trim() ||
      String(product.fotoSello1 || '').trim()
    );
    if (hasPrimary && !chooseProductSeal(activeRows, product)) orphanPrimary += 1;
    if (
      product.fotoSello2 &&
      !activeRows.some(
        (row) => normalizeImageKey(row.image_url) === normalizeImageKey(product.fotoSello2)
      )
    ) {
      orphanSecondary += 1;
    }
  }

  const imageCounts = new Map();
  for (const row of activeRows) {
    const key = normalizeImageKey(row.image_url);
    if (key) imageCounts.set(key, (imageCounts.get(key) || 0) + 1);
  }

  return {
    active: activeRows.length,
    inactive: allRows.filter((row) => !row.eliminado && row.activo === false).length,
    deleted: allRows.filter((row) => row.eliminado === true).length,
    duplicateImages: [...imageCounts.values()].filter((count) => count > 1).length,
    orphanPrimary,
    orphanSecondary,
    products: products.length,
  };
}

async function findDuplicate({ key, imageUrl, excludeId = null }) {
  const rows = await getRows({ includeInactive: true, includeDeleted: false });
  const imageKey = normalizeImageKey(imageUrl);
  return (
    rows.find(
      (row) =>
        row.id !== excludeId &&
        (row.clave_normalizada === key ||
          (imageKey && normalizeImageKey(row.image_url) === imageKey))
    ) || null
  );
}

async function createSeal(payload = {}) {
  await ensureSealTable();
  const nombreEs = String(
    payload.nombreEs ?? payload.valueEs ?? payload.nombreEn ?? payload.valueEn ?? ''
  ).trim();
  const nombreEn = String(
    payload.nombreEn ?? payload.valueEn ?? nombreEs
  ).trim() || nombreEs;
  if (!nombreEs) throw createHttpError('El sello necesita un nombre.', 400);

  const key = normalizeTextKey(nombreEs);
  const imageUrl = await materializeImageUrl(payload.imageUrl);
  if (!imageUrl) throw createHttpError('El sello necesita una imagen.', 400);

  const duplicate = await findDuplicate({ key, imageUrl });
  if (duplicate) {
    throw Object.assign(
      createHttpError('Ya existe un sello con ese nombre o imagen.', 409),
      { seal: rowToPublic(duplicate) }
    );
  }

  const tombstones = await getRows({ includeInactive: true, includeDeleted: true });
  const imageKey = normalizeImageKey(imageUrl);
  const tombstone = tombstones.find(
    (row) =>
      row.eliminado === true &&
      (row.clave_normalizada === key || normalizeImageKey(row.image_url) === imageKey)
  );

  let rows;
  if (tombstone) {
    rows = await prisma.$queryRawUnsafe(
      `UPDATE sellos_productos
       SET clave_normalizada = $2, nombre_es = $3, nombre_en = $4, image_url = $5,
           activo = $6, eliminado = FALSE, actualizado_en = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      tombstone.id,
      key,
      nombreEs,
      nombreEn,
      imageUrl,
      normalizeBoolean(payload.activo, true)
    );
  } else {
    rows = await prisma.$queryRawUnsafe(
      `INSERT INTO sellos_productos
        (clave_normalizada, nombre_es, nombre_en, image_url, activo, eliminado)
       VALUES ($1, $2, $3, $4, $5, FALSE)
       RETURNING *`,
      key,
      nombreEs,
      nombreEn,
      imageUrl,
      normalizeBoolean(payload.activo, true)
    );
  }

  await writeLegacyCatalog();
  return rowToPublic(rows[0], 0);
}

async function updateSeal(idValue, payload = {}) {
  const id = parseSealId(idValue);
  const current = await getRowById(id);
  if (!current) throw createHttpError('Sello no encontrado.', 404);

  const nombreEs = String(
    payload.nombreEs ?? payload.valueEs ?? current.nombre_es
  ).trim();
  const nombreEn = String(
    payload.nombreEn ?? payload.valueEn ?? current.nombre_en ?? nombreEs
  ).trim() || nombreEs;
  if (!nombreEs) throw createHttpError('El sello necesita un nombre.', 400);

  const key = normalizeTextKey(nombreEs);
  const requestedImage = Object.prototype.hasOwnProperty.call(payload, 'imageUrl')
    ? payload.imageUrl
    : current.image_url;
  const imageUrl = await materializeImageUrl(requestedImage, current.image_url);
  if (!imageUrl) throw createHttpError('El sello necesita una imagen.', 400);

  const duplicate = await findDuplicate({ key, imageUrl, excludeId: id });
  if (duplicate) {
    throw Object.assign(
      createHttpError('Otro sello ya usa ese nombre o imagen.', 409),
      { seal: rowToPublic(duplicate) }
    );
  }

  const active = normalizeBoolean(payload.activo, current.activo !== false);
  const rows = await prisma.$queryRawUnsafe(
    `UPDATE sellos_productos
     SET clave_normalizada = $2, nombre_es = $3, nombre_en = $4,
         image_url = $5, activo = $6, actualizado_en = CURRENT_TIMESTAMP
     WHERE id = $1 AND eliminado = FALSE RETURNING *`,
    id,
    key,
    nombreEs,
    nombreEn,
    imageUrl,
    active
  );
  const nextRow = rows[0];

  await rewriteProductsForSeal(current, active ? nextRow : null);
  await writeLegacyCatalog();
  const usage = await calculateUsage([nextRow]);
  return rowToPublic(nextRow, usage.get(id) || 0);
}

async function deleteSeal(idValue) {
  const id = parseSealId(idValue);
  const current = await getRowById(id);
  if (!current) throw createHttpError('Sello no encontrado.', 404);

  const affectedProducts = await rewriteProductsForSeal(current, null);
  await prisma.$executeRawUnsafe(
    `UPDATE sellos_productos
     SET activo = FALSE, eliminado = TRUE, actualizado_en = CURRENT_TIMESTAMP
     WHERE id = $1`,
    id
  );
  await writeLegacyCatalog();
  await destroyCloudinaryImage(current.image_url);
  return { ok: true, id, affectedProducts };
}

module.exports = {
  PRODUCT_SEAL_FIELDS,
  auditCatalog,
  calculateUsage,
  canonicalizeProductSealBody,
  createSeal,
  deleteSeal,
  ensureSealTable,
  getRowById,
  getRows,
  normalizeImageKey,
  normalizeTextKey,
  parseSealId,
  reconcileProducts,
  rowToPublic,
  syncExistingSourcesAndReconcile,
  updateSeal,
  writeLegacyCatalog,
};
