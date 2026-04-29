const router = require('express').Router();
const controller = require('./sync.controller');

router.get('/manifest', controller.getManifest);
router.get('/productos', controller.syncProducts);
router.get('/restaurantes', controller.syncRestaurants);
router.get('/noticias', controller.syncNews);
router.get('/eventos', controller.syncEvents);

module.exports = router;
