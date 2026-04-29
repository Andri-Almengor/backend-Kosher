const service = require('./restaurants.service');

function normalizeLang(value) {
  return String(value || 'es').toLowerCase() === 'en' ? 'en' : 'es';
}

exports.getAll = async (req, res) => {
  try {
    res.json(await service.getAll(normalizeLang(req.query.lang), req.query));
  } catch (err) {
    console.error('GET /restaurantes', err);
    res.status(500).json({ message: 'Error obteniendo restaurantes' });
  }
};

exports.getById = async (req, res) => {
  try {
    const data = await service.getById(req.params.id, normalizeLang(req.query.lang));
    if (!data) return res.status(404).json({ message: 'No encontrado' });
    res.json(data);
  } catch (err) {
    console.error('GET /restaurantes/:id', err);
    res.status(500).json({ message: 'Error obteniendo restaurante' });
  }
};
