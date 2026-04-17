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

export type Kpis = {
  ordersToday: number;
  totalUsdToday: number;
  totalBsToday: number;
  newOrdersPending: number;
};

export async function getKpis(): Promise<Kpis> {
  const { start, end } = vzTodayRange();
  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select('id,status,total_usd,total_bs')
    .gte('created_at', start)
    .lt('created_at', end);
  if (error) throw error;
  const ordersToday = orders?.length ?? 0;
  const totalUsdToday = (orders ?? []).reduce((s, o) => s + (Number(o.total_usd) || 0), 0);
  const totalBsToday = (orders ?? []).reduce((s, o) => s + (Number(o.total_bs) || 0), 0);
  const newOrdersPending = (orders ?? []).filter(o => ['pendiente_pago', 'confirmado', 'en_preparacion'].includes(o.status ?? '')).length;
  return {
    ordersToday,
    totalUsdToday: Math.round(totalUsdToday * 100) / 100,
    totalBsToday: Math.round(totalBsToday * 100) / 100,
    newOrdersPending
  };
}

export type WalletBalances = {
  cash_usd: number;
  zelle: number;
  bolivares: number;
};

export async function getWalletBalances(): Promise<WalletBalances> {
  const { data, error } = await supabaseAdmin
    .from('cash_movements')
    .select('wallet,movement_type,amount');
  if (error) throw error;
  const bal: WalletBalances = { cash_usd: 0, zelle: 0, bolivares: 0 };
  for (const m of data ?? []) {
    const w = m.wallet as keyof WalletBalances;
    if (!(w in bal)) continue;
    const amt = Number(m.amount) || 0;
    if (m.movement_type === 'ingreso') bal[w] += amt;
    else if (m.movement_type === 'egreso') bal[w] -= amt;
  }
  return {
    cash_usd: Math.round(bal.cash_usd * 100) / 100,
    zelle: Math.round(bal.zelle * 100) / 100,
    bolivares: Math.round(bal.bolivares * 100) / 100
  };
}

export type RecentOrder = {
  id: string;
  created_at: string;
  client_name: string | null;
  channel: string | null;
  status: string | null;
  total_usd: number | null;
};

export async function getRecentOrders(limit = 15): Promise<RecentOrder[]> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('id,created_at,client_name,channel,status,total_usd')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

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
    orders: v.orders
  }));
}

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
