-- Add 'despachado' status to orders CHECK constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'pendiente_pago','confirmado','en_preparacion',
  'en_ruta','despachado','entregado','completado','cancelado'
));
