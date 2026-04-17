-- Migracion: 002_system_alerts
-- Fecha: 2026-04-17
-- Descripcion: Tabla para registrar fallas operacionales de
--              workflows (retry failures, DNS errors, etc)
-- Rollback: DROP TABLE IF EXISTS system_alerts;

CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','error','critical')),
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_system_alerts_unresolved
  ON system_alerts(created_at DESC)
  WHERE resolved = FALSE;

CREATE INDEX IF NOT EXISTS idx_system_alerts_severity
  ON system_alerts(severity)
  WHERE resolved = FALSE;

CREATE INDEX IF NOT EXISTS idx_system_alerts_source
  ON system_alerts(source);

COMMENT ON TABLE system_alerts IS
  'Sistema de alertas para fallas operacionales de workflows.
   Se alimenta desde n8n cuando los retries fallan.';
