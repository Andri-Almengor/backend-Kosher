ALTER TABLE "restaurantes_comercios"
  ADD COLUMN IF NOT EXISTS "telefono" TEXT,
  ADD COLUMN IF NOT EXISTS "descrip_telefono_es" TEXT,
  ADD COLUMN IF NOT EXISTS "descrip_telefono_en" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsapp" TEXT,
  ADD COLUMN IF NOT EXISTS "descrip_whatsapp_es" TEXT,
  ADD COLUMN IF NOT EXISTS "descrip_whatsapp_en" TEXT,
  ADD COLUMN IF NOT EXISTS "correo" TEXT,
  ADD COLUMN IF NOT EXISTS "descrip_correo_es" TEXT,
  ADD COLUMN IF NOT EXISTS "descrip_correo_en" TEXT;
