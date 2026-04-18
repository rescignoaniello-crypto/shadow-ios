import { supabaseAdmin } from './supabase';

// Returns [startIso, endIso) for "today" in Venezuela time (UTC-4)
export function vzTodayRange(): { start: string; end: string; dateStr: string } {
  const now = new Date();
  const vz = new Date(now.getTime() - 4 * 3600 * 1000);
  const y = vz.getUTCFullYear();
  const m = String(vz.getUTCMonth() + 1).padStart(2, '0');
  const d = String(vz.getUTCDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;
  const start = `${dateStr}T04:00:00Z`;
  const next = new Date(Date.UTC(y, vz.getUTCMonth(), vz.getUTCDate() + 1));
  const nm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(next.getUTCDate()).padStart(2, '0');
  const end = `${next.getUTCFullYear()}-${nm}-${nd}T04:00:00Z`;
  return { start, end, dateStr };
}

// ── KPIs ──

export type Kpis = {
  ordersToday: number;
  totalUsdToday: number;
  totalBsToday: number;
  newOrdersPending: number;
  dispatchedToday: number;
  expensesToday: number;
};

export async function getKpis(): Promise<Kpis> {
  const { start, end } = vzTodayRange();

  const [ordersRes, movementsRes] = await Promise.all([
    supabaseAdmin.from('orders').select('id,status,total_usd,total_bs').gte('created_at', start).lt('created_at', end),
    supabaseAdmin.from('cash_movements').select('movement_type,amount,wallet').gte('created_at', start).lt('created_at', end),
  ]);
  if (ordersRes.error) throw ordersRes.error;
  if (movementsRes.error) throw movementsRes.error;

  const orders = ordersRes.data ?? [];
  const movements = movementsRes.data ?? [];

  return {
    ordersToday: orders.length,
    totalUsdToday: Math.round(orders.reduce((s, o) => s + (Number(o.total_usd) || 0), 0) * 100) / 100,
    totalBsToday: Math.round(orders.reduce((s, o) => s + (Number(o.total_bs) || 0), 0) * 100) / 100,
    newOrdersPending: orders.filter(o => ['pendiente_pago', 'confirmado', 'en_preparacion'].includes(o.status ?? '')).length,
    dispatchedToday: orders.filter(o => o.status === 'despachado' || o.status === 'en_ruta').length,
    expensesToday: Math.round(movements.filter(m => m.movement_type === 'egreso').reduce((s, m) => s + (Number(m.amount) || 0), 0) * 100) / 100,
  };
}

// ── Wallet balances ──

export type WalletBalances = {
  cash_usd: number;
  zelle: number;
  bolivares: number;
  binance: number;
  lastMovement: string | null;
};

export async function getWalletBalances(): Promise<WalletBalances> {
  const { data, error } = await supabaseAdmin
    .from('cash_movements')
    .select('wallet,movement_type,amount,created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const bal = { cash_usd: 0, zelle: 0, bolivares: 0, binance: 0 };
  let lastMovement: string | null = null;

  for (const m of data ?? []) {
    if (!lastMovement) lastMovement = m.created_at;
    const w = m.wallet as keyof typeof bal;
    if (!(w in bal)) continue;
    const amt = Number(m.amount) || 0;
    if (m.movement_type === 'ingreso') bal[w] += amt;
    else if (m.movement_type === 'egreso') bal[w] -= amt;
    else bal[w] += amt; // cambio, transferencia
  }

  return {
    cash_usd: Math.round(bal.cash_usd * 100) / 100,
    zelle: Math.round(bal.zelle * 100) / 100,
    bolivares: Math.round(bal.bolivares * 100) / 100,
    binance: Math.round(bal.binance * 100) / 100,
    lastMovement,
  };
}

// ── Today's movements feed ──

export type Movement = {
  id: string;
  created_at: string;
  movement_type: string;
  wallet: string;
  amount: number;
  concept: string | null;
  order_id: string | null;
  order_number: string | null;
  client_name: string | null;
};

export async function getTodayMovements(): Promise<Movement[]> {
  const { start, end } = vzTodayRange();
  const { data, error } = await supabaseAdmin
    .from('cash_movements')
    .select('id,created_at,movement_type,wallet,amount,concept,order_id')
    .gte('created_at', start)
    .lt('created_at', end)
    .order('created_at', { ascending: false });
  if (error) throw error;

  // Fetch order numbers for movements that have order_id
  const orderIds = (data ?? []).map(m => m.order_id).filter(Boolean) as string[];
  let orderMap = new Map<string, { order_number: string; client_name: string }>();

  if (orderIds.length > 0) {
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('id,order_number,client_name')
      .in('id', Array.from(new Set(orderIds)));
    for (const o of orders ?? []) {
      orderMap.set(o.id, { order_number: o.order_number, client_name: o.client_name });
    }
  }

  return (data ?? []).map(m => ({
    id: m.id,
    created_at: m.created_at,
    movement_type: m.movement_type,
    wallet: m.wallet,
    amount: Number(m.amount),
    concept: m.concept,
    order_id: m.order_id,
    order_number: m.order_id ? orderMap.get(m.order_id)?.order_number ?? null : null,
    client_name: m.order_id ? orderMap.get(m.order_id)?.client_name ?? null : null,
  }));
}

// ── Active orders ──

export type ActiveOrder = {
  id: string;
  created_at: string;
  order_number: string | null;
  client_name: string | null;
  channel: string | null;
  status: string | null;
  total_usd: number | null;
  payment_method: string | null;
  delivery_type: string | null;
  carrier: string | null;
};

export async function getActiveOrders(): Promise<ActiveOrder[]> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id,created_at,order_number,client_name,channel,status,total_usd,payment_method,delivery_type,carrier')
    .not('status', 'in', '("completado","cancelado")')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

// ── Deliveries ──

export type PendingDelivery = {
  id: string;
  rider_name: string | null;
  destination: string | null;
  status: string | null;
  cash_to_collect_usd: number | null;
};

export async function getPendingDeliveries(): Promise<PendingDelivery[]> {
  const { data, error } = await supabaseAdmin
    .from('deliveries')
    .select('id,rider_name,destination,status,cash_to_collect_usd')
    .in('status', ['pendiente', 'asignado', 'en_ruta'])
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

// ── Monthly sales ──

export type MonthlySales = { month: string; total_usd: number; orders: number };

export async function getMonthlySales(months = 12): Promise<MonthlySales[]> {
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - (months - 1));
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('created_at,total_usd')
    .gte('created_at', since.toISOString());
  if (error) throw error;
  const buckets = new Map<string, { total_usd: number; orders: number }>();
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    buckets.set(key, { total_usd: 0, orders: 0 });
  }
  for (const o of data ?? []) {
    const d = new Date(o.created_at);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    const b = buckets.get(key);
    if (!b) continue;
    b.total_usd += Number(o.total_usd) || 0;
    b.orders += 1;
  }
  return Array.from(buckets.entries()).map(([month, v]) => ({
    month,
    total_usd: Math.round(v.total_usd * 100) / 100,
    orders: v.orders,
  }));
}

// ── Rate ──

export async function getCurrentRate(): Promise<number | null> {
  const url = process.env.N8N_RATE_WEBHOOK;
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.Bs != null ? Number(data.Bs) : null;
  } catch {
    return null;
  }
}
