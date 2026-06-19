const router = require('express').Router();
const multer = require('multer');
const prisma = require('../../lib/prisma');
const { toPublicProduct, toPublicRestaurant, toPublicNews } = require('../common/mappers');
const { safeNotifyNewContent, shouldNotifyFromBody, sendPushToAll } = require('../../services/push.service');

const upload = multer({ storage: multer.memoryStorage() });
const PRODUCTS_HOME_CARD_KEY = 'products-home-card';
const DEFAULT_PRODUCTS_HOME_CARD = {
  activo: true,
  imageUrl: '',
  titleEs: 'Productos Kosher',
  titleEn: 'Kosher Products',
  subtitleEs: '',
  subtitleEn: '',
  primaryButtonEs: 'Ver productos',
  primaryButtonEn: 'View products',
  primaryUrl: '',
  secondaryButtonEs: '',
  secondaryButtonEn: '',
  secondaryUrl: '',
  visibleFilters: [],
  showImage: true,
  showTitle: true,
  showSubtitle: true,
  showPrimaryButton: true,
  showSecondaryButton: false,
};

const cloudinary = require('cloudinary').v2;

function getCloudinaryFolder(req) {
  const raw = String(req.body?.folder || process.env.CLOUDINARY_FOLDER || 'kosher-costa-rica').trim();
  return raw.replace(/^\/+|\.\.|\/+$/g, '').replace(/\\/g, '') || 'kosher-costa-rica';
}

function extractCloudinaryPublicId(url) {
  try {
    const value = String(url || '').trim();
    if (!value || !value.includes('res.cloudinary.com')) return '';
    const path = new URL(value).pathname;
    const uploadIndex = path.indexOf('/upload/');
    if (uploadIndex < 0) return '';
    let rest = path.slice(uploadIndex + '/upload/'.length);
    rest = rest.replace(/^v\d+\//, '');
    return rest.replace(/\.[a-zA-Z0-9]+$/, '');
  } catch {
    return '';
  }
}

function assertCloudinaryConfigured() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    const err = new Error('Cloudinary no está configurado. Agrega CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET en el .env del backend.');
    err.statusCode = 500;
    throw err;
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
}

function uploadBufferToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    stream.end(buffer);
  });
}

function parseId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    const err = new Error('ID inválido.');
    err.status = 400;
    throw err;
  }
  return id;
}

function compactObject(data) {
  const clean = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value === undefined) continue;
    clean[key] = value;
  }
  return clean;
}

function pickAllowed(body, allowed) {
  const clean = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(body || {}, key)) clean[key] = body[key];
  }
  return compactObject(clean);
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'si', 'sí', 'activo'].includes(v)) return true;
    if (['false', '0', 'no', 'inactivo'].includes(v)) return false;
  }
  return value;
}

function normalizeNullableInt(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}


function normalizeTextKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function normalizeSealPayload(body = {}) {
  const nombreEs = String(body.nombreEs ?? body.valueEs ?? body.sello ?? body.nombre ?? '').trim();
  const nombreEn = String(body.nombreEn ?? body.valueEn ?? body.selloEn ?? '').trim();
  const imageUrl = String(body.imageUrl ?? body.fotoSello1 ?? body.fotoSello ?? body.url ?? '').trim();

  return {
    id: body.id || `${normalizeTextKey(nombreEs || nombreEn).replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
    nombreEs,
    nombreEn: nombreEn || nombreEs,
    imageUrl,
    creadoEn: body.creadoEn || new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
  };
}

function sealToPublic(item = {}) {
  return {
    id: item.id || normalizeTextKey(item.nombreEs || item.nombreEn || item.imageUrl),
    nombreEs: String(item.nombreEs ?? item.valueEs ?? '').trim(),
    nombreEn: String(item.nombreEn ?? item.valueEn ?? item.nombreEs ?? '').trim(),
    valueEs: String(item.nombreEs ?? item.valueEs ?? '').trim(),
    valueEn: String(item.nombreEn ?? item.valueEn ?? item.nombreEs ?? '').trim(),
    imageUrl: String(item.imageUrl ?? '').trim(),
    creadoEn: item.creadoEn || null,
    actualizadoEn: item.actualizadoEn || null,
  };
}

async function getSealCatalog() {
  const row = await prisma.uiSetting.findUnique({ where: { key: 'product-seals' } });
  const raw = Array.isArray(row?.value) ? row.value : [];
  return raw.map(sealToPublic).filter((item) => (item.nombreEs || item.nombreEn) && item.imageUrl);
}

async function saveSealCatalog(items) {
  const normalized = [];
  const seen = new Set();

  for (const item of items || []) {
    const seal = sealToPublic(item);
    const key = normalizeTextKey(seal.nombreEs || seal.nombreEn);
    if (!key || !seal.imageUrl || seen.has(key)) continue;
    seen.add(key);
    normalized.push({
      id: seal.id || key.replace(/[^a-z0-9]+/g, '-'),
      nombreEs: seal.nombreEs || seal.nombreEn,
      nombreEn: seal.nombreEn || seal.nombreEs,
      imageUrl: seal.imageUrl,
      creadoEn: seal.creadoEn || new Date().toISOString(),
      actualizadoEn: seal.actualizadoEn || new Date().toISOString(),
    });
  }

  normalized.sort((a, b) => String(a.nombreEs || a.nombreEn).localeCompare(String(b.nombreEs || b.nombreEn), 'es', { sensitivity: 'base' }));

  await prisma.uiSetting.upsert({
    where: { key: 'product-seals' },
    create: { key: 'product-seals', value: normalized, activo: true },
    update: { value: normalized, activo: true },
  });

  return normalized.map(sealToPublic);
}

async function ensureProductSealInCatalog({ nombreEs, nombreEn, imageUrl }) {
  const seal = normalizeSealPayload({ nombreEs, nombreEn, imageUrl });
  const key = normalizeTextKey(seal.nombreEs || seal.nombreEn);
  if (!key || !seal.imageUrl) return null;

  const catalog = await getSealCatalog();
  const existing = catalog.find((item) => normalizeTextKey(item.nombreEs || item.nombreEn) === key);
  if (existing) return existing;

  const saved = await saveSealCatalog([seal, ...catalog]);
  return saved.find((item) => normalizeTextKey(item.nombreEs || item.nombreEn) === key) || null;
}

function buildProductData(body, { partial = true } = {}) {
  const allowed = [
    'catGeneral', 'catGeneralEn', 'categoria1', 'categoria1En', 'fabricanteMarca', 'fabricanteMarcaEn',
    'nombre', 'nombreEn', 'certifica', 'certificaEn', 'sello', 'selloEn', 'atributo1', 'atributo1En',
    'atributo2', 'atributo2En', 'atributo3', 'atributo3En', 'tienda', 'tiendaEn', 'fotoProducto',
    'fotoSello1', 'fotoSello2',
  ];
  const data = pickAllowed(body, allowed);

  // Compatibilidad con formularios que mandan campos públicos/localizados.
  if (body?.catGeneral && data.catGeneral === undefined) data.catGeneral = body.catGeneral;
  if (body?.categoria1 && data.categoria1 === undefined) data.categoria1 = body.categoria1;
  if (body?.fabricanteMarca && data.fabricanteMarca === undefined) data.fabricanteMarca = body.fabricanteMarca;
  if (body?.nombre && data.nombre === undefined) data.nombre = body.nombre;

  if (!partial) {
    data.catGeneral = data.catGeneral || 'Sin categoría';
    data.categoria1 = data.categoria1 || 'General';
    data.fabricanteMarca = data.fabricanteMarca || 'Sin marca';
    data.nombre = data.nombre || 'Producto sin nombre';
  }
  return data;
}

function buildRestaurantData(body, { partial = true } = {}) {
  const allowed = [
    'imageUrl', 'nombreEs', 'nombreEn', 'tipoEs', 'tipoEn', 'ubicacionEs', 'ubicacionEn', 'acercaDeEs',
    'acercaDeEn', 'horarioEs', 'horarioEn', 'telefono', 'descripTelefonoEs', 'descripTelefonoEn',
    'whatsapp', 'descripWhatsappEs', 'descripWhatsappEn', 'correo', 'descripCorreoEs', 'descripCorreoEn',
    'contactoEs', 'contactoEn', 'direccionEs', 'direccionEn', 'direccionLink', 'activo',
  ];
  const data = pickAllowed(body, allowed);

  // Compatibilidad con los objetos públicos que devuelve el admin/listado.
  if (body?.nombre && data.nombreEs === undefined) data.nombreEs = body.nombre;
  if (body?.tipo && data.tipoEs === undefined) data.tipoEs = body.tipo;
  if (body?.ubicacion && data.ubicacionEs === undefined) data.ubicacionEs = body.ubicacion;
  if (body?.acercaDe && data.acercaDeEs === undefined) data.acercaDeEs = body.acercaDe;
  if (body?.horario && data.horarioEs === undefined) data.horarioEs = body.horario;
  if (body?.contacto && data.contactoEs === undefined) data.contactoEs = body.contacto;
  if (body?.direccion && data.direccionEs === undefined) data.direccionEs = body.direccion;
  if (body?.telefonoRaw && data.telefono === undefined) data.telefono = body.telefonoRaw;
  if (body?.whatsappRaw && data.whatsapp === undefined) data.whatsapp = body.whatsappRaw;
  if (body?.correoRaw && data.correo === undefined) data.correo = body.correoRaw;
  if (data.activo !== undefined) data.activo = normalizeBoolean(data.activo);

  if (!partial) {
    data.nombreEs = data.nombreEs || 'Comercio sin nombre';
    data.tipoEs = data.tipoEs || 'Comercio';
  }
  return data;
}

function buildNewsData(body, { partial = true, defaultAutorId } = {}) {
  const allowed = ['titulo', 'contenido', 'imageUrl', 'fileUrl', 'destino', 'activo', 'notifyUsers', 'restauranteId', 'autorId'];
  const data = pickAllowed(body, allowed);
  if (data.activo !== undefined) data.activo = normalizeBoolean(data.activo);
  if (data.notifyUsers !== undefined) data.notifyUsers = normalizeBoolean(data.notifyUsers);
  if (Object.prototype.hasOwnProperty.call(data, 'restauranteId')) data.restauranteId = normalizeNullableInt(data.restauranteId);
  if (Object.prototype.hasOwnProperty.call(data, 'autorId')) data.autorId = normalizeNullableInt(data.autorId);
  if (!partial) {
    data.titulo = data.titulo || 'Novedad sin título';
    data.autorId = data.autorId || defaultAutorId;
  }
  return data;
}

async function buildUserData(body, { partial = true } = {}) {
  const data = pickAllowed(body, ['nombre', 'email', 'password', 'passwordHash', 'rolId', 'activo']);
  if (data.email) data.email = String(data.email).trim().toLowerCase();
  if (data.activo !== undefined) data.activo = normalizeBoolean(data.activo);
  if (data.rolId !== undefined) data.rolId = normalizeNullableInt(data.rolId);

  // Compatibilidad con formularios que mandan rol como texto: "admin", "usuario", etc.
  if (!data.rolId && body?.rol) {
    const rol = await prisma.rol.findFirst({ where: { nombre: String(body.rol).trim() } });
    if (rol) data.rolId = rol.id;
  }

  if (data.password) {
    const bcrypt = require('bcryptjs');
    data.passwordHash = await bcrypt.hash(String(data.password), 10);
    delete data.password;
  }

  if (!partial) {
    const adminRole = await prisma.rol.findFirst({ where: { nombre: 'admin' } });
    data.nombre = data.nombre || 'Usuario';
    data.email = data.email || `usuario-${Date.now()}@local.invalid`;
    data.rolId = data.rolId || adminRole?.id;
    data.activo = data.activo ?? true;
    if (!data.passwordHash) {
      const bcrypt = require('bcryptjs');
      data.passwordHash = await bcrypt.hash(String(body?.password || '123456'), 10);
    }
  }

  delete data.rol;
  return data;
}

function sendUser(item, res, status = 200) {
  return res.status(status).json({ id: item.id, nombre: item.nombre, email: item.email, rol: item.rol?.nombre || null, rolId: item.rolId, activo: item.activo });
}

// Respuesta explícita para preflight CORS en rutas admin.
router.options('*', (_req, res) => res.sendStatus(204));

router.post('/uploads/image', upload.single('file'), async (req, res, next) => {
  try {
    assertCloudinaryConfigured();

    if (!req.file?.buffer) {
      return res.status(400).json({ ok: false, message: 'No se recibió ninguna imagen.' });
    }

    const folder = getCloudinaryFolder(req);
    const result = await uploadBufferToCloudinary(req.file.buffer, {
      folder,
      resource_type: 'image',
      overwrite: false,
      use_filename: true,
      unique_filename: true,
      transformation: [
        { width: 1800, height: 1800, crop: 'limit' },
        { quality: 'auto:good', fetch_format: 'auto' },
      ],
    });

    const oldPublicId = extractCloudinaryPublicId(req.body?.oldUrl);
    if (oldPublicId && oldPublicId !== result.public_id) {
      cloudinary.uploader.destroy(oldPublicId, { resource_type: 'image' }).catch(() => {});
    }

    return res.status(201).json({
      ok: true,
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
    });
  } catch (error) {
    next(error);
  }
});


router.get('/push-tokens/stats', async (_req, res, next) => {
  try {
    const [total, enabled, android, ios, es, en] = await Promise.all([
      prisma.pushToken.count(),
      prisma.pushToken.count({ where: { enabled: true } }),
      prisma.pushToken.count({ where: { enabled: true, platform: 'android' } }),
      prisma.pushToken.count({ where: { enabled: true, platform: 'ios' } }),
      prisma.pushToken.count({ where: { enabled: true, language: 'es' } }),
      prisma.pushToken.count({ where: { enabled: true, language: 'en' } }),
    ]);
    res.json({ total, enabled, android, ios, es, en });
  } catch (error) {
    next(error);
  }
});

router.post('/push/send-test', async (req, res, next) => {
  try {
    const result = await sendPushToAll({
      title: req.body?.title || 'Kosher Costa Rica',
      body: req.body?.body || 'Notificación de prueba',
      data: { type: 'test', screen: 'home' },
    }, {
      language: req.body?.language,
      platform: req.body?.platform,
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});


router.get('/productos/sellos', async (_req, res, next) => {
  try {
    const [catalog, products] = await Promise.all([
      getSealCatalog(),
      prisma.producto.findMany({
        where: {
          OR: [
            { fotoSello1: { not: null } },
            { fotoSello2: { not: null } },
          ],
        },
        select: { sello: true, selloEn: true, fotoSello1: true, fotoSello2: true },
      }),
    ]);

    const merged = [...catalog];
    for (const product of products) {
      if (product.sello || product.selloEn) {
        merged.push(normalizeSealPayload({ nombreEs: product.sello, nombreEn: product.selloEn, imageUrl: product.fotoSello1 || product.fotoSello2 }));
      }
    }

    const saved = await saveSealCatalog(merged);
    res.json(saved);
  } catch (error) {
    next(error);
  }
});

router.post('/productos/sellos', async (req, res, next) => {
  try {
    const seal = normalizeSealPayload(req.body);

    if (!(seal.nombreEs || seal.nombreEn)) {
      return res.status(400).json({ ok: false, message: 'El sello necesita nombre.' });
    }
    if (!seal.imageUrl) {
      return res.status(400).json({ ok: false, message: 'El sello necesita imagen.' });
    }

    const key = normalizeTextKey(seal.nombreEs || seal.nombreEn);
    const catalog = await getSealCatalog();
    const duplicate = catalog.find((item) => normalizeTextKey(item.nombreEs || item.nombreEn) === key);

    if (duplicate) {
      return res.status(409).json({ ok: false, message: 'Ya existe un sello con ese nombre.', seal: duplicate });
    }

    await saveSealCatalog([seal, ...catalog]);
    res.status(201).json(sealToPublic(seal));
  } catch (error) {
    next(error);
  }
});

router.put('/productos/sellos/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();
    const catalog = await getSealCatalog();
    const index = catalog.findIndex((item) => String(item.id) === id);
    if (index < 0) return res.status(404).json({ ok: false, message: 'Sello no encontrado.' });

    const nextSeal = normalizeSealPayload({ ...catalog[index], ...req.body, id });
    if (!(nextSeal.nombreEs || nextSeal.nombreEn)) return res.status(400).json({ ok: false, message: 'El sello necesita nombre.' });
    if (!nextSeal.imageUrl) return res.status(400).json({ ok: false, message: 'El sello necesita imagen.' });

    const key = normalizeTextKey(nextSeal.nombreEs || nextSeal.nombreEn);
    const duplicate = catalog.find((item, i) => i !== index && normalizeTextKey(item.nombreEs || item.nombreEn) === key);
    if (duplicate) return res.status(409).json({ ok: false, message: 'Ya existe un sello con ese nombre.', seal: duplicate });

    catalog[index] = nextSeal;
    await saveSealCatalog(catalog);
    res.json(sealToPublic(nextSeal));
  } catch (error) {
    next(error);
  }
});

router.delete('/productos/sellos/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id || '').trim();
    const catalog = await getSealCatalog();
    const nextCatalog = catalog.filter((item) => String(item.id) !== id);
    await saveSealCatalog(nextCatalog);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/productos', async (req, res, next) => {
  try {
    const q = String(req.query?.q || '').trim();
    const items = await prisma.producto.findMany({
      where: q
        ? {
            OR: [
              { nombre: { contains: q, mode: 'insensitive' } },
              { nombreEn: { contains: q, mode: 'insensitive' } },
              { fabricanteMarca: { contains: q, mode: 'insensitive' } },
              { categoria1: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
    });
    res.json(items.map((item) => toPublicProduct(item, 'es')));
  } catch (error) {
    next(error);
  }
});

router.post('/productos', async (req, res, next) => {
  try {
    const data = buildProductData(req.body, { partial: false });
    const item = await prisma.producto.create({ data });
    if ((data.sello || data.selloEn) && data.fotoSello1) {
      await ensureProductSealInCatalog({ nombreEs: data.sello, nombreEn: data.selloEn, imageUrl: data.fotoSello1 });
    }
    if (shouldNotifyFromBody(req.body)) {
      await safeNotifyNewContent('producto', item);
    }
    res.status(201).json(toPublicProduct(item, 'es'));
  } catch (error) {
    next(error);
  }
});

async function updateProduct(req, res, next) {
  try {
    const data = buildProductData(req.body, { partial: true });
    const item = await prisma.producto.update({ where: { id: parseId(req) }, data });
    if ((data.sello || data.selloEn) && data.fotoSello1) {
      await ensureProductSealInCatalog({ nombreEs: data.sello, nombreEn: data.selloEn, imageUrl: data.fotoSello1 });
    }
    res.json(toPublicProduct(item, 'es'));
  } catch (error) {
    next(error);
  }
}
router.put('/productos/:id', updateProduct);
router.patch('/productos/:id', updateProduct);

router.delete('/productos/:id', async (req, res, next) => {
  try {
    await prisma.producto.delete({ where: { id: parseId(req) } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post('/productos/import-excel', upload.single('file'), async (_req, res) => {
  res.json({ ok: true, message: 'Importación manual no implementada en este backend refactorizado.' });
});

router.get('/restaurantes', async (_req, res, next) => {
  try {
    const items = await prisma.restauranteComercio.findMany({ orderBy: [{ nombreEs: 'asc' }, { id: 'asc' }] });
    res.json(items.map((item) => toPublicRestaurant(item, 'es')));
  } catch (error) {
    next(error);
  }
});

router.get('/restaurantes/options', async (_req, res, next) => {
  try {
    const [nombres, tipos] = await Promise.all([
      prisma.restauranteNombreOption.findMany({ orderBy: { nombreEs: 'asc' } }),
      prisma.tipoComercioOption.findMany({ orderBy: { nombreEs: 'asc' } }),
    ]);
    res.json({ nombres, tipos });
  } catch (error) {
    next(error);
  }
});

router.post('/restaurantes', async (req, res, next) => {
  try {
    const item = await prisma.restauranteComercio.create({ data: buildRestaurantData(req.body, { partial: false }) });
    if (shouldNotifyFromBody(req.body)) {
      await safeNotifyNewContent('restaurante', item);
    }
    res.status(201).json(toPublicRestaurant(item, 'es'));
  } catch (error) {
    next(error);
  }
});

async function updateRestaurant(req, res, next) {
  try {
    const item = await prisma.restauranteComercio.update({ where: { id: parseId(req) }, data: buildRestaurantData(req.body, { partial: true }) });
    res.json(toPublicRestaurant(item, 'es'));
  } catch (error) {
    next(error);
  }
}
router.put('/restaurantes/:id', updateRestaurant);
router.patch('/restaurantes/:id', updateRestaurant);

router.delete('/restaurantes/:id', async (req, res, next) => {
  try {
    const item = await prisma.restauranteComercio.update({ where: { id: parseId(req) }, data: { activo: false } });
    res.json(toPublicRestaurant(item, 'es'));
  } catch (error) {
    next(error);
  }
});

// Alias para frontends que usan "comercios" en vez de "restaurantes".
router.get('/comercios', async (_req, res, next) => {
  try {
    const items = await prisma.restauranteComercio.findMany({ orderBy: [{ nombreEs: 'asc' }, { id: 'asc' }] });
    res.json(items.map((item) => toPublicRestaurant(item, 'es')));
  } catch (error) {
    next(error);
  }
});
router.post('/comercios', async (req, res, next) => {
  try {
    const item = await prisma.restauranteComercio.create({ data: buildRestaurantData(req.body, { partial: false }) });
    if (shouldNotifyFromBody(req.body)) {
      await safeNotifyNewContent('restaurante', item);
    }
    res.status(201).json(toPublicRestaurant(item, 'es'));
  } catch (error) {
    next(error);
  }
});
router.put('/comercios/:id', updateRestaurant);
router.patch('/comercios/:id', updateRestaurant);
router.delete('/comercios/:id', async (req, res, next) => {
  try {
    const item = await prisma.restauranteComercio.update({ where: { id: parseId(req) }, data: { activo: false } });
    res.json(toPublicRestaurant(item, 'es'));
  } catch (error) {
    next(error);
  }
});

router.post('/restaurantes/options/nombres', async (req, res, next) => {
  try {
    const item = await prisma.restauranteNombreOption.create({ data: pickAllowed(req.body, ['nombreEs', 'nombreEn']) });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

router.post('/restaurantes/options/tipos', async (req, res, next) => {
  try {
    const item = await prisma.tipoComercioOption.create({ data: pickAllowed(req.body, ['nombreEs', 'nombreEn']) });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
});

router.get('/noticias', async (_req, res, next) => {
  try {
    const items = await prisma.noticia.findMany({
      include: { restaurante: true },
      orderBy: [{ actualizadoEn: 'desc' }, { id: 'desc' }],
    });
    res.json(items.map(toPublicNews));
  } catch (error) {
    next(error);
  }
});

router.post('/noticias', async (req, res, next) => {
  try {
    const firstAdmin = await prisma.usuario.findFirst({ where: { activo: true }, orderBy: { id: 'asc' } });
    const data = buildNewsData(req.body, { partial: false, defaultAutorId: firstAdmin?.id });
    const item = await prisma.noticia.create({ data, include: { restaurante: true } });
    if (data.notifyUsers || shouldNotifyFromBody(req.body)) {
      await safeNotifyNewContent('noticia', item);
    }
    res.status(201).json(toPublicNews(item));
  } catch (error) {
    next(error);
  }
});

async function updateNews(req, res, next) {
  try {
    const item = await prisma.noticia.update({ where: { id: parseId(req) }, data: buildNewsData(req.body, { partial: true }), include: { restaurante: true } });
    res.json(toPublicNews(item));
  } catch (error) {
    next(error);
  }
}
router.put('/noticias/:id', updateNews);
router.patch('/noticias/:id', updateNews);

router.delete('/noticias/:id', async (req, res, next) => {
  try {
    await prisma.noticia.delete({ where: { id: parseId(req) } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// Alias para frontends que usan "novedades" en vez de "noticias".
router.get('/novedades', async (_req, res, next) => {
  try {
    const items = await prisma.noticia.findMany({ include: { restaurante: true }, orderBy: [{ actualizadoEn: 'desc' }, { id: 'desc' }] });
    res.json(items.map(toPublicNews));
  } catch (error) {
    next(error);
  }
});
router.post('/novedades', async (req, res, next) => {
  try {
    const firstAdmin = await prisma.usuario.findFirst({ where: { activo: true }, orderBy: { id: 'asc' } });
    const data = buildNewsData(req.body, { partial: false, defaultAutorId: firstAdmin?.id });
    const item = await prisma.noticia.create({ data, include: { restaurante: true } });
    if (data.notifyUsers || shouldNotifyFromBody(req.body)) {
      await safeNotifyNewContent('noticia', item);
    }
    res.status(201).json(toPublicNews(item));
  } catch (error) {
    next(error);
  }
});
router.put('/novedades/:id', updateNews);
router.patch('/novedades/:id', updateNews);
router.delete('/novedades/:id', async (req, res, next) => {
  try {
    await prisma.noticia.delete({ where: { id: parseId(req) } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/usuarios', async (_req, res, next) => {
  try {
    const items = await prisma.usuario.findMany({ include: { rol: true }, orderBy: { id: 'asc' } });
    res.json(items.map((u) => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol?.nombre || null, rolId: u.rolId, activo: u.activo })));
  } catch (error) {
    next(error);
  }
});

router.post('/usuarios', async (req, res, next) => {
  try {
    const item = await prisma.usuario.create({ data: await buildUserData(req.body, { partial: false }), include: { rol: true } });
    sendUser(item, res, 201);
  } catch (error) {
    next(error);
  }
});

async function updateUser(req, res, next) {
  try {
    const item = await prisma.usuario.update({ where: { id: parseId(req) }, data: await buildUserData(req.body, { partial: true }), include: { rol: true } });
    sendUser(item, res);
  } catch (error) {
    next(error);
  }
}
router.put('/usuarios/:id', updateUser);
router.patch('/usuarios/:id', updateUser);

router.delete('/usuarios/:id', async (req, res, next) => {
  try {
    await prisma.usuario.delete({ where: { id: parseId(req) } });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/ui-settings/products-home-card', async (_req, res, next) => {
  try {
    const row = await prisma.uiSetting.findUnique({ where: { key: PRODUCTS_HOME_CARD_KEY } });
    res.json({ ...DEFAULT_PRODUCTS_HOME_CARD, ...(row?.value || {}) });
  } catch (error) {
    next(error);
  }
});

async function updateProductsHomeCard(req, res, next) {
  try {
    const value = { ...DEFAULT_PRODUCTS_HOME_CARD, ...(req.body || {}) };
    const row = await prisma.uiSetting.upsert({
      where: { key: PRODUCTS_HOME_CARD_KEY },
      create: { key: PRODUCTS_HOME_CARD_KEY, value, activo: true },
      update: { value, activo: true },
    });
    res.json({ ...DEFAULT_PRODUCTS_HOME_CARD, ...(row?.value || {}) });
  } catch (error) {
    next(error);
  }
}
router.put('/ui-settings/products-home-card', updateProductsHomeCard);
router.patch('/ui-settings/products-home-card', updateProductsHomeCard);

module.exports = router;
