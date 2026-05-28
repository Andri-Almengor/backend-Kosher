const prisma = require('../lib/prisma');
const { logger } = require('../utils/logger');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const MAX_CHUNK_SIZE = 100;

function isExpoPushToken(token) {
  const value = String(token || '').trim();
  return /^ExponentPushToken\[[\w-]+\]$/.test(value) || /^ExpoPushToken\[[\w-]+\]$/.test(value);
}

function normalizeLanguage(language) {
  const value = String(language || 'es').trim().toLowerCase();
  if (value.startsWith('en')) return 'en';
  return 'es';
}

function chunkArray(items, size = MAX_CHUNK_SIZE) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function compactData(data = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value !== undefined && value !== null) clean[key] = value;
  }
  return clean;
}

async function registerPushToken(payload = {}) {
  const token = String(payload.token || '').trim();
  if (!isExpoPushToken(token)) {
    const err = new Error('Token push inválido. Debe ser un Expo Push Token válido.');
    err.status = 400;
    throw err;
  }

  const language = normalizeLanguage(payload.language || payload.locale);
  const platform = payload.platform ? String(payload.platform).trim().toLowerCase() : null;
  const deviceId = payload.deviceId ? String(payload.deviceId).trim() : null;
  const appVersion = payload.appVersion ? String(payload.appVersion).trim() : null;

  return prisma.pushToken.upsert({
    where: { token },
    create: {
      token,
      platform,
      language,
      deviceId,
      appVersion,
      enabled: true,
      lastSeenAt: new Date(),
    },
    update: {
      platform,
      language,
      deviceId,
      appVersion,
      enabled: true,
      lastSeenAt: new Date(),
    },
  });
}

async function unregisterPushToken(token) {
  const value = String(token || '').trim();
  if (!value) return null;
  return prisma.pushToken.updateMany({
    where: { token: value },
    data: { enabled: false, lastSeenAt: new Date() },
  });
}

async function deleteInvalidTokens(tokens = []) {
  const cleanTokens = tokens.map((t) => String(t || '').trim()).filter(Boolean);
  if (!cleanTokens.length) return;
  await prisma.pushToken.updateMany({
    where: { token: { in: cleanTokens } },
    data: { enabled: false },
  });
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!response.ok) {
    const err = new Error(`Expo Push API respondió ${response.status}`);
    err.status = response.status;
    err.details = json;
    throw err;
  }
  return json;
}

async function checkReceipts(receiptIds = []) {
  const ids = receiptIds.filter(Boolean);
  if (!ids.length) return { checked: 0, invalidTokens: [] };

  const invalidTokens = [];
  for (const chunk of chunkArray(ids, 300)) {
    try {
      const json = await fetchJson(EXPO_RECEIPTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: chunk }),
      });

      for (const receipt of Object.values(json?.data || {})) {
        if (receipt?.status === 'error' && receipt?.details?.error === 'DeviceNotRegistered' && receipt?.details?.expoPushToken) {
          invalidTokens.push(receipt.details.expoPushToken);
        }
      }
    } catch (error) {
      logger.warn(`No se pudieron consultar receipts de Expo: ${error.message}`);
    }
  }

  if (invalidTokens.length) await deleteInvalidTokens(invalidTokens);
  return { checked: ids.length, invalidTokens };
}

async function sendPushToTokens(tokens = [], notification = {}) {
  const validTokens = [...new Set(tokens.map((t) => String(t || '').trim()).filter(isExpoPushToken))];
  if (!validTokens.length) return { sent: 0, tickets: [], invalidTokens: [] };

  const messages = validTokens.map((token) => ({
    to: token,
    sound: notification.sound || 'default',
    title: notification.title || 'Kosher Costa Rica',
    body: notification.body || '',
    data: compactData(notification.data),
    priority: 'high',
    channelId: notification.channelId || notification.channel || 'news',
  }));

  const tickets = [];
  const invalidTokens = [];

  for (const chunk of chunkArray(messages)) {
    const json = await fetchJson(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Accept-encoding': 'gzip, deflate',
      },
      body: JSON.stringify(chunk),
    });

    const data = Array.isArray(json?.data) ? json.data : [];
    data.forEach((ticket, index) => {
      const originalToken = chunk[index]?.to;
      tickets.push(ticket);
      if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
        invalidTokens.push(originalToken);
      }
    });
  }

  if (invalidTokens.length) await deleteInvalidTokens(invalidTokens);

  const receiptIds = tickets.map((ticket) => ticket?.id).filter(Boolean);
  checkReceipts(receiptIds).catch((error) => logger.warn(`Error consultando receipts push: ${error.message}`));

  return { sent: validTokens.length, tickets, invalidTokens };
}

async function sendPushToAll(notification = {}, options = {}) {
  const where = { enabled: true };
  if (options.language) where.language = normalizeLanguage(options.language);
  if (options.platform) where.platform = String(options.platform).trim().toLowerCase();

  const rows = await prisma.pushToken.findMany({ where, select: { token: true } });
  return sendPushToTokens(rows.map((row) => row.token), notification);
}

function getLocalizedTitle(item = {}, fallback = 'Kosher Costa Rica') {
  return item.titulo || item.nombre || item.nombreEs || item.nombreEn || item.nombreEn || fallback;
}

function shouldNotifyFromBody(body = {}) {
  return body.notifyUsers === true || body.notifyUsers === 'true' || body.sendNotification === true || body.sendNotification === 'true';
}

async function notifyNewContent(type, item = {}, options = {}) {
  const id = item.id;
  const titleByType = {
    noticia: 'Nueva novedad',
    producto: 'Nuevo producto kosher',
    restaurante: 'Nuevo comercio kosher',
  };
  const screenByType = {
    noticia: 'news-detail',
    producto: 'product-detail',
    restaurante: 'restaurant-detail',
  };
  const channelByType = {
    noticia: 'news',
    producto: 'products',
    restaurante: 'restaurants',
  };

  const body = getLocalizedTitle(item, titleByType[type] || 'Nueva publicación');
  return sendPushToAll({
    title: options.title || titleByType[type] || 'Nueva publicación',
    body,
    channelId: options.channelId || channelByType[type] || 'news',
    data: {
      type,
      screen: options.screen || screenByType[type] || 'home',
      id,
      resourceId: id,
    },
  }, options);
}

async function safeNotifyNewContent(type, item = {}, options = {}) {
  try {
    return await notifyNewContent(type, item, options);
  } catch (error) {
    logger.warn(`No se pudo enviar notificación push (${type} ${item?.id || ''}): ${error.message}`);
    return { sent: 0, error: error.message };
  }
}

module.exports = {
  isExpoPushToken,
  normalizeLanguage,
  registerPushToken,
  unregisterPushToken,
  sendPushToTokens,
  sendPushToAll,
  notifyNewContent,
  safeNotifyNewContent,
  shouldNotifyFromBody,
};
