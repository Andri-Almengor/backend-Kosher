-- AlterTable
ALTER TABLE "noticias" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "restaurante_id" INTEGER;

-- AlterTable
ALTER TABLE "restaurantes_comercios" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ui_settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ui_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ui_settings_key_key" ON "ui_settings"("key");

-- CreateIndex
CREATE INDEX "noticias_restaurante_id_idx" ON "noticias"("restaurante_id");

-- CreateIndex
CREATE INDEX "restaurantes_comercios_activo_idx" ON "restaurantes_comercios"("activo");

-- AddForeignKey
ALTER TABLE "noticias" ADD CONSTRAINT "noticias_restaurante_id_fkey" FOREIGN KEY ("restaurante_id") REFERENCES "restaurantes_comercios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
