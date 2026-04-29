const router = require('express').Router();
const bcrypt = require('bcryptjs');
const prisma = require('../../lib/prisma');

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ message: 'Credenciales incompletas' });

    const user = await prisma.usuario.findFirst({
      where: { email, activo: true },
      include: { rol: true },
    });

    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    const hash = String(user.passwordHash || '');
    let valid = false;
    try {
      valid = hash.startsWith('$2') ? await bcrypt.compare(password, hash) : password === hash;
    } catch {
      valid = password === hash;
    }
    if (!valid) return res.status(401).json({ message: 'Credenciales inválidas' });

    return res.json({
      token: `demo-token-${user.id}-${Date.now()}`,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol?.nombre === 'admin' ? 'admin' : user.rol?.nombre || 'guest',
      },
    });
  } catch (error) {
    console.error('POST /auth/login', error);
    res.status(500).json({ message: 'Error en login' });
  }
});

module.exports = router;
