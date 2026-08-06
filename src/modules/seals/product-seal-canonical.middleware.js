const router = require('express').Router();
const prisma = require('../../lib/prisma');
const { canonicalizeProductSealBody } = require('./seal-catalog.service');

async function canonicalizeCreate(req, _res, next) {
  try {
    req.body = await canonicalizeProductSealBody(req.body, {
      currentProduct: null,
      partial: false,
    });
    next();
  } catch (error) {
    next(error);
  }
}

async function canonicalizeUpdate(req, _res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return next();

    const currentProduct = await prisma.producto.findUnique({
      where: { id },
      select: { sello: true, selloEn: true, fotoSello1: true, fotoSello2: true },
    });
    if (!currentProduct) return next();

    req.body = await canonicalizeProductSealBody(req.body, {
      currentProduct,
      partial: true,
    });
    next();
  } catch (error) {
    next(error);
  }
}

// Solo intercepta el alta y la edición de productos. Las rutas /sellos,
// /import-excel y demás continúan hacia sus controladores normales.
router.post('/', canonicalizeCreate);
router.put('/:id', canonicalizeUpdate);
router.patch('/:id', canonicalizeUpdate);

module.exports = router;
