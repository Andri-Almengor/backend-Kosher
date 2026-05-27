
CREATE TABLE IF NOT EXISTS "restaurante_nombre_options" (
  "id" SERIAL PRIMARY KEY,
  "nombre_es" TEXT NOT NULL UNIQUE,
  "nombre_en" TEXT,
  "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "tipo_comercio_options" (
  "id" SERIAL PRIMARY KEY,
  "nombre_es" TEXT NOT NULL UNIQUE,
  "nombre_en" TEXT,
  "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "restaurantes_comercios" (
  "id" SERIAL PRIMARY KEY,
  "image_url" TEXT,
  "nombre_es" TEXT NOT NULL,
  "nombre_en" TEXT,
  "tipo_es" TEXT NOT NULL,
  "tipo_en" TEXT,
  "ubicacion_es" TEXT,
  "ubicacion_en" TEXT,
  "acerca_de_es" TEXT,
  "acerca_de_en" TEXT,
  "horario_es" TEXT,
  "horario_en" TEXT,
  "contacto_es" TEXT,
  "contacto_en" TEXT,
  "direccion_es" TEXT,
  "direccion_en" TEXT,
  "direccion_link" TEXT,
  "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "restaurantes_comercios_nombre_es_idx" ON "restaurantes_comercios"("nombre_es");
CREATE INDEX IF NOT EXISTS "restaurantes_comercios_tipo_es_idx" ON "restaurantes_comercios"("tipo_es");
