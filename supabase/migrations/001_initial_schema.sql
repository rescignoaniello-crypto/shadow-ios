-- Shadow iOS — Initial schema
-- Project: Primal VZla automation
-- Run once in Supabase SQL Editor

-- =====================================================
-- 1. orders
-- =====================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  shopify_order_id TEXT UNIQUE,
  order_number TEXT,
  client_name TEXT,
  client_phone TEXT,
  client_city TEXT,
  client_cedula TEXT,
  channel TEXT CHECK (channel IN ('whatsapp','shopify','instagram','manual')),
  status TEXT DEFAULT 'pendiente_pago' CHECK (status IN (
    'pendiente_pago','confirmado','en_preparacion',
    'en_ruta','entregado','completado','cancelado'
  )),
  delivery_type TEXT CHECK (delivery_type IN ('delivery','envio','pickup')),
  carrier TEXT,
  tracking_number TEXT,
  delivery_address TEXT,
  subtotal_usd DECIMAL(10,2),
  delivery_cost_usd DECIMAL(10,2) DEFAULT 0,
  total_usd DECIMAL(10,2),
  total_bs DECIMAL(10,2),
  exchange_rate DECIMAL(10,4),
  payment_method TEXT CHECK (payment_method IN ('cash','zelle','bolivares','binance','mixto')),
  amount_paid_usd DECIMAL(10,2),
  amount_paid_bs DECIMAL(10,2),
  change_given DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  kira_conversation_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_client_phone ON orders(client_phone);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================
-- 2. order_items
-- =====================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  sku TEXT,
  product_name TEXT NOT NULL,
  size TEXT,
  color TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price_usd DECIMAL(10,2),
  unit_cost_usd DECIMAL(10,2),
  total_price_usd DECIMAL(10,2)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sku ON order_items(sku);

-- =====================================================
-- 3. cash_movements
-- =====================================================
CREATE TABLE IF NOT EXISTS cash_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  date DATE DEFAULT CURRENT_DATE,
  movement_type TEXT CHECK (movement_type IN ('ingreso','egreso','cambio','transferencia')),
  wallet TEXT CHECK (wallet IN ('cash_usd','bolivares','zelle')),
  amount DECIMAL(10,2) NOT NULL,
  exchange_rate DECIMAL(10,4),
  amount_usd_equivalent DECIMAL(10,2),
  concept TEXT,
  order_id UUID REFERENCES orders(id),
  balance_after DECIMAL(10,2)
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_date ON cash_movements(date DESC);
CREATE INDEX IF NOT EXISTS idx_cash_movements_wallet ON cash_movements(wallet);
CREATE INDEX IF NOT EXISTS idx_cash_movements_order_id ON cash_movements(order_id);

-- =====================================================
-- 4. deliveries
-- =====================================================
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  date DATE DEFAULT CURRENT_DATE,
  order_id UUID REFERENCES orders(id),
  rider_name TEXT,
  destination TEXT,
  delivery_cost DECIMAL(10,2),
  status TEXT DEFAULT 'pendiente' CHECK (status IN (
    'pendiente','asignado','en_ruta','entregado','cobrado','fallido'
  )),
  is_cash_on_delivery BOOLEAN DEFAULT FALSE,
  cash_to_collect_usd DECIMAL(10,2),
  cash_to_collect_bs DECIMAL(10,2),
  cash_collected BOOLEAN DEFAULT FALSE,
  cash_collected_amount DECIMAL(10,2),
  notes TEXT,
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deliveries_date ON deliveries(date DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_rider_name ON deliveries(rider_name);
CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON deliveries(order_id);

-- =====================================================
-- 5. exchange_rates
-- =====================================================
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE UNIQUE DEFAULT CURRENT_DATE,
  rate_binance DECIMAL(10,4),
  rate_bcv DECIMAL(10,4),
  rate_used DECIMAL(10,4),
  source TEXT DEFAULT 'binance',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON exchange_rates(date DESC);

-- =====================================================
-- 6. inventory_movements
-- =====================================================
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  date DATE DEFAULT CURRENT_DATE,
  movement_type TEXT CHECK (movement_type IN ('entrada','salida','ajuste')),
  sku TEXT,
  product_name TEXT,
  size TEXT,
  color TEXT,
  quantity INTEGER,
  order_id UUID REFERENCES orders(id),
  reason TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_date ON inventory_movements(date DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_sku ON inventory_movements(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_order_id ON inventory_movements(order_id);

-- =====================================================
-- Seed: initial exchange rate for testing
-- =====================================================
INSERT INTO exchange_rates (date, rate_binance, rate_used, source)
VALUES (CURRENT_DATE, 40.0000, 40.0000, 'binance')
ON CONFLICT (date) DO NOTHING;

-- =====================================================
-- Enable RLS (tables locked by default; service_role bypasses RLS)
-- =====================================================
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
