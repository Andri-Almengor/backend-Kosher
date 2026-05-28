const router = require('express').Router();
const prisma = require('../../lib/prisma');
const {
  registerPushToken,
  unregisterPushToken,
  sendPushToAll,
  isExpoPushToken,
} = require('../../services/push.service');

router.options('*', (_req, res) => res.sendStatus(204));

router.post('/register', async (req, res, next) => {
  try {
    const item = await registerPushToken(req.body || {});
    res.status(201).json({ ok: true, token: item.token, language: item.language, platform: item.platform });
  } catch (error) {
    next(error);
  }
});

router.post('/unregister', async (req, res, next) => {
  try {
    await unregisterPushToken(req.body?.token);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.get('/stats', async (_req, res, next) => {
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

router.post('/send-test', async (req, res, next) => {
  try {
    const title = req.body?.title || 'Kosher Costa Rica';
    const body = req.body?.body || 'Notificación de prueba';
    const language = req.body?.language || undefined;
    const token = req.body?.token;

    let result;
    if (token && isExpoPushToken(token)) {
      const { sendPushToTokens } = require('../../services/push.service');
      result = await sendPushToTokens([token], { title, body, data: { type: 'test', screen: 'home' } });
    } else {
      result = await sendPushToAll({ title, body, data: { type: 'test', screen: 'home' } }, { language });
    }

    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
