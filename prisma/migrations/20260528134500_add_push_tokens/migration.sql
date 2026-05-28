-- CreateTable
CREATE TABLE IF NOT EXISTS "push_tokens" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "language" TEXT NOT NULL DEFAULT 'es',
    "device_id" TEXT,
    "app_version" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "push_tokens_token_key" ON "push_tokens"("token");
CREATE INDEX IF NOT EXISTS "push_tokens_enabled_idx" ON "push_tokens"("enabled");
CREATE INDEX IF NOT EXISTS "push_tokens_language_idx" ON "push_tokens"("language");
CREATE INDEX IF NOT EXISTS "push_tokens_platform_idx" ON "push_tokens"("platform");
CREATE INDEX IF NOT EXISTS "push_tokens_device_id_idx" ON "push_tokens"("device_id");
