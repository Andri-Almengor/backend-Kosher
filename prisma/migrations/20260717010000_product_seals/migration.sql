CREATE TABLE IF NOT EXISTS "sellos_productos" (
  "id" SERIAL NOT NULL,
  "clave_normalizada" TEXT NOT NULL,
  "nombre_es" TEXT NOT NULL,
  "nombre_en" TEXT,
  "image_url" TEXT,
  "activo" BOOLEAN NOT NULL DEFAULT TRUE,
  "eliminado" BOOLEAN NOT NULL DEFAULT FALSE,
  "creado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actualizado_en" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sellos_productos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sellos_productos_clave_normalizada_key" UNIQUE ("clave_normalizada")
);

CREATE INDEX IF NOT EXISTS "sellos_productos_activo_idx"
  ON "sellos_productos" ("activo");

CREATE INDEX IF NOT EXISTS "sellos_productos_image_url_idx"
  ON "sellos_productos" ("image_url");
