const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

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

async function main() {
  const adminRole = await prisma.rol.upsert({
    where: { nombre: 'admin' },
    update: { descripcion: 'Administrador del sistema' },
    create: { nombre: 'admin', descripcion: 'Administrador del sistema' },
  });

  await prisma.rol.upsert({
    where: { nombre: 'guest' },
    update: { descripcion: 'Usuario invitado' },
    create: { nombre: 'guest', descripcion: 'Usuario invitado' },
  });

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@kosher.local').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin12345!';
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.usuario.upsert({
    where: { email: adminEmail },
    update: {
      nombre: process.env.ADMIN_NAME || 'Administrador',
      passwordHash,
      rolId: adminRole.id,
      activo: true,
    },
    create: {
      nombre: process.env.ADMIN_NAME || 'Administrador',
      email: adminEmail,
      passwordHash,
      rolId: adminRole.id,
      activo: true,
    },
  });

  await prisma.uiSetting.upsert({
    where: { key: PRODUCTS_HOME_CARD_KEY },
    update: {},
    create: { key: PRODUCTS_HOME_CARD_KEY, value: DEFAULT_PRODUCTS_HOME_CARD, activo: true },
  });

  console.log('Seed completado correctamente.');
  console.log(`Admin: ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
