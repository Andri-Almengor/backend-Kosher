const prisma = require('../../lib/prisma');
const { toPublicRestaurant } = require('../common/mappers');

exports.getAll = async (lang = 'es', query = {}) => {
  const q = String(query.q || '').trim();
  const tipo = String(query.tipo || '').trim();
  const where = {
    activo: true,
    ...(q ? {
      OR: [
        { nombreEs: { contains: q, mode: 'insensitive' } },
        { nombreEn: { contains: q, mode: 'insensitive' } },
        { tipoEs: { contains: q, mode: 'insensitive' } },
        { tipoEn: { contains: q, mode: 'insensitive' } },
        { ubicacionEs: { contains: q, mode: 'insensitive' } },
        { ubicacionEn: { contains: q, mode: 'insensitive' } },
      ],
    } : {}),
    ...(tipo ? { OR: [
      { tipoEs: { contains: tipo, mode: 'insensitive' } },
      { tipoEn: { contains: tipo, mode: 'insensitive' } },
    ] } : {}),
  };
  const items = await prisma.restauranteComercio.findMany({ where, orderBy: [{ nombreEs: 'asc' }, { id: 'asc' }] });
  return items.map((item) => toPublicRestaurant(item, lang));
};

exports.getById = async (id, lang = 'es') => {
  const item = await prisma.restauranteComercio.findUnique({ where: { id: Number(id) } });
  if (!item || item.activo === false) return null;
  return toPublicRestaurant(item, lang);
};
