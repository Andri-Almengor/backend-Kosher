const service = require('./sync.service');

function normalizeLang(value) {
  return String(value || 'es').toLowerCase() === 'en' ? 'en' : 'es';
}

function parseSince(value) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

exports.getManifest = async (_req, res) => {
  try {
    const data = await service.getManifest();
    res.json(data);
  } catch (err) {
    console.error('GET /sync/manifest', err);
    res.status(500).json({ message: 'Error en sync manifest' });
  }
};

exports.syncProducts = async (req, res) => {
  try { res.json(await service.syncProducts(normalizeLang(req.query.lang), parseSince(req.query.since))); }
  catch (err) { console.error('GET /sync/productos', err); res.status(500).json({ message: 'Error en sync productos' }); }
};
exports.syncRestaurants = async (req, res) => {
  try { res.json(await service.syncRestaurants(normalizeLang(req.query.lang), parseSince(req.query.since))); }
  catch (err) { console.error('GET /sync/restaurantes', err); res.status(500).json({ message: 'Error en sync restaurantes' }); }
};
exports.syncNews = async (req, res) => {
  try { res.json(await service.syncNews(normalizeLang(req.query.lang), parseSince(req.query.since))); }
  catch (err) { console.error('GET /sync/noticias', err); res.status(500).json({ message: 'Error en sync noticias' }); }
};
exports.syncEvents = async (req, res) => {
  try { res.json(await service.syncEvents(normalizeLang(req.query.lang), parseSince(req.query.since))); }
  catch (err) { console.error('GET /sync/eventos', err); res.status(500).json({ message: 'Error en sync eventos' }); }
};
