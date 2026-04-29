const prisma = require('../../lib/prisma');
const { toPublicProduct, toPublicRestaurant, toPublicNews, toPublicEvent } = require('../common/mappers');

const PAYLOAD_VERSION = {
  productos: 'v2-bilingual-fields',
  restaurantes: 'v3-contact-channels',
  noticias: 'v1',
  eventos: 'v1',
};

function makeEtag(key, lastUpdatedAt, count, version = '') {
  return `${key}:${lastUpdatedAt || '0'}:${count || 0}${version ? `:${version}` : ''}`;
}

async function buildMeta(model, where, maxField, key) {
  const aggregate = await model.aggregate({ where, _count: { id: true }, _max: { [maxField]: true } });
  const count = aggregate?._count?.id || 0;
  const last = aggregate?._max?.[maxField] || null;
  return {
    count,
    lastUpdatedAt: last,
    etag: makeEtag(key, last?.toISOString?.() || last, count, PAYLOAD_VERSION[key]),
  };
}

exports.getManifest = async () => {
  const [productos, noticias, eventos, restaurantes] = await Promise.all([
    buildMeta(prisma.producto, {}, 'actualizadoEn', 'productos'),
    buildMeta(prisma.noticia, { activo: true }, 'actualizadoEn', 'noticias'),
    buildMeta(prisma.evento, {}, 'actualizadoEn', 'eventos'),
    buildMeta(prisma.restauranteComercio, { activo: true }, 'actualizadoEn', 'restaurantes'),
  ]);

  return { generatedAt: new Date().toISOString(), productos, noticias, eventos, restaurantes };
};

async function delta({ key, model, where, since, orderBy, include, mapItem }) {
  const rows = await model.findMany({ where: since ? { ...where, actualizadoEn: { gt: new Date(since) } } : where, include, orderBy });
  const items = rows.map(mapItem);
  const lastUpdatedAt = items.length ? items[items.length - 1].actualizadoEn || rows[rows.length - 1].actualizadoEn : null;
  return { key, since: since || null, items, deletedIds: [], lastUpdatedAt, payloadVersion: PAYLOAD_VERSION[key] };
}

exports.syncProducts = async (lang = 'es', since = null) => delta({
  key: 'productos', model: prisma.producto, where: {}, since, orderBy: [{ actualizadoEn: 'asc' }, { id: 'asc' }], include: undefined, mapItem: (item) => toPublicProduct(item, lang),
});

exports.syncRestaurants = async (lang = 'es', since = null) => delta({
  key: 'restaurantes', model: prisma.restauranteComercio, where: { activo: true }, since, orderBy: [{ actualizadoEn: 'asc' }, { id: 'asc' }], include: undefined, mapItem: (item) => toPublicRestaurant(item, lang),
});

exports.syncNews = async (_lang = 'es', since = null) => delta({
  key: 'noticias', model: prisma.noticia, where: { activo: true }, since, orderBy: [{ actualizadoEn: 'asc' }, { id: 'asc' }], include: { restaurante: true }, mapItem: toPublicNews,
});

exports.syncEvents = async (_lang = 'es', since = null) => delta({
  key: 'eventos', model: prisma.evento, where: {}, since, orderBy: [{ actualizadoEn: 'asc' }, { id: 'asc' }], include: undefined, mapItem: toPublicEvent,
});
