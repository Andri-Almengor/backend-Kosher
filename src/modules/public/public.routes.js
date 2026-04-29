const router = require('express').Router();
const prisma = require('../../lib/prisma');

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

router.get('/ui-settings/products-home-card', async (_req, res) => {
  const row = await prisma.uiSetting.findUnique({ where: { key: PRODUCTS_HOME_CARD_KEY } });
  res.json({ ...DEFAULT_PRODUCTS_HOME_CARD, ...(row?.value || {}) });
});

module.exports = router;
