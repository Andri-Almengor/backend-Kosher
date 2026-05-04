const router = require('express').Router();
const multer = require('multer');
const prisma = require('../../lib/prisma');
const { toPublicProduct, toPublicRestaurant, toPublicNews } = require('../common/mappers');

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
  return raw.replace(/^\/+|\.\.|\/+$|\\/g, '') || 'kosher-costa-rica';
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

router.get('/productos', async (req, res) => {
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
});

router.post('/productos', async (req, res) => {
  const item = await prisma.producto.create({ data: req.body || {} });
  res.status(201).json(toPublicProduct(item, 'es'));
});

router.put('/productos/:id', async (req, res) => {
  const item = await prisma.producto.update({ where: { id: Number(req.params.id) }, data: req.body || {} });
  res.json(toPublicProduct(item, 'es'));
});

router.delete('/productos/:id', async (req, res) => {
  await prisma.producto.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

router.post('/productos/import-excel', upload.single('file'), async (_req, res) => {
  res.json({ ok: true, message: 'Importación manual no implementada en este backend refactorizado.' });
});

router.get('/restaurantes', async (_req, res) => {
  const items = await prisma.restauranteComercio.findMany({ orderBy: [{ nombreEs: 'asc' }, { id: 'asc' }] });
  res.json(items.map((item) => toPublicRestaurant(item, 'es')));
});

router.get('/restaurantes/options', async (_req, res) => {
  const [nombres, tipos] = await Promise.all([
    prisma.restauranteNombreOption.findMany({ orderBy: { nombreEs: 'asc' } }),
    prisma.tipoComercioOption.findMany({ orderBy: { nombreEs: 'asc' } }),
  ]);
  res.json({ nombres, tipos });
});

router.post('/restaurantes', async (req, res) => {
  const item = await prisma.restauranteComercio.create({ data: req.body || {} });
  res.status(201).json(toPublicRestaurant(item, 'es'));
});

router.put('/restaurantes/:id', async (req, res) => {
  const item = await prisma.restauranteComercio.update({ where: { id: Number(req.params.id) }, data: req.body || {} });
  res.json(toPublicRestaurant(item, 'es'));
});

router.delete('/restaurantes/:id', async (req, res) => {
  const item = await prisma.restauranteComercio.update({ where: { id: Number(req.params.id) }, data: { activo: false } });
  res.json(toPublicRestaurant(item, 'es'));
});

router.post('/restaurantes/options/nombres', async (req, res) => {
  const item = await prisma.restauranteNombreOption.create({ data: req.body || {} });
  res.status(201).json(item);
});

router.post('/restaurantes/options/tipos', async (req, res) => {
  const item = await prisma.tipoComercioOption.create({ data: req.body || {} });
  res.status(201).json(item);
});

router.get('/noticias', async (_req, res) => {
  const items = await prisma.noticia.findMany({
    include: { restaurante: true },
    orderBy: [{ actualizadoEn: 'desc' }, { id: 'desc' }],
  });
  res.json(items.map(toPublicNews));
});

router.post('/noticias', async (req, res) => {
  const firstAdmin = await prisma.usuario.findFirst({ where: { activo: true }, orderBy: { id: 'asc' } });
  const data = { ...(req.body || {}), autorId: req.body?.autorId || firstAdmin?.id };
  const item = await prisma.noticia.create({ data, include: { restaurante: true } });
  res.status(201).json(toPublicNews(item));
});

router.put('/noticias/:id', async (req, res) => {
  const item = await prisma.noticia.update({ where: { id: Number(req.params.id) }, data: req.body || {}, include: { restaurante: true } });
  res.json(toPublicNews(item));
});

router.delete('/noticias/:id', async (req, res) => {
  await prisma.noticia.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

router.get('/usuarios', async (_req, res) => {
  const items = await prisma.usuario.findMany({ include: { rol: true }, orderBy: { id: 'asc' } });
  res.json(items.map((u) => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol?.nombre || null })));
});

router.post('/usuarios', async (req, res) => {
  const bcrypt = require('bcryptjs');
  const adminRole = await prisma.rol.findFirst({ where: { nombre: 'admin' } });
  const passwordHash = await bcrypt.hash(String(req.body?.password || '123456'), 10);
  const item = await prisma.usuario.create({
    data: {
      nombre: req.body?.nombre,
      email: String(req.body?.email || '').trim().toLowerCase(),
      passwordHash,
      rolId: adminRole?.id,
      activo: true,
    },
    include: { rol: true },
  });
  res.status(201).json({ id: item.id, nombre: item.nombre, email: item.email, rol: item.rol?.nombre || null });
});

router.put('/usuarios/:id', async (req, res) => {
  const data = { ...req.body };
  if (data.password) {
    const bcrypt = require('bcryptjs');
    data.passwordHash = await bcrypt.hash(String(data.password), 10);
    delete data.password;
  }
  if (data.email) data.email = String(data.email).trim().toLowerCase();
  const item = await prisma.usuario.update({ where: { id: Number(req.params.id) }, data, include: { rol: true } });
  res.json({ id: item.id, nombre: item.nombre, email: item.email, rol: item.rol?.nombre || null });
});

router.delete('/usuarios/:id', async (req, res) => {
  await prisma.usuario.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
});

router.get('/ui-settings/products-home-card', async (_req, res) => {
  const row = await prisma.uiSetting.findUnique({ where: { key: PRODUCTS_HOME_CARD_KEY } });
  res.json({ ...DEFAULT_PRODUCTS_HOME_CARD, ...(row?.value || {}) });
});

router.put('/ui-settings/products-home-card', async (req, res) => {
  const value = { ...DEFAULT_PRODUCTS_HOME_CARD, ...(req.body || {}) };
  const row = await prisma.uiSetting.upsert({
    where: { key: PRODUCTS_HOME_CARD_KEY },
    create: { key: PRODUCTS_HOME_CARD_KEY, value, activo: true },
    update: { value, activo: true },
  });
  res.json({ ...DEFAULT_PRODUCTS_HOME_CARD, ...(row?.value || {}) });
});

module.exports = router;
