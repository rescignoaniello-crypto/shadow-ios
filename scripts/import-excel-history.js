#!/usr/bin/env node
// Shadow iOS — Excel historical import
// File: PRIMAL-INVENTORY&SALES-2026.xlsx (sheets: VENTAS, CAJA)
//
// Usage:
//   node scripts/import-excel-history.js --inspect
//   node scripts/import-excel-history.js --dry-run
//   node scripts/import-excel-history.js
//   node scripts/import-excel-history.js --file="PRIMAL-INVENTORY&SALES-2026.xlsx"
//   node scripts/import-excel-history.js --only=ventas,caja

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
const BATCH_SIZE = 200;

const args = process.argv.slice(2);
const flag = (k) => args.includes(`--${k}`);
const opt = (k, d) => {
  const a = args.find(x => x.startsWith(`--${k}=`));
  return a ? a.split('=').slice(1).join('=').replace(/^"|"$/g, '') : d;
};
const INSPECT = flag('inspect');
const DRY = flag('dry-run');
const FILE = opt('file', 'PRIMAL-INVENTORY&SALES-2026.xlsx');
const ONLY = (opt('only', '') || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

// ---------- helpers ----------
const excelDateToJs = (serial) => {
  if (serial == null || serial === '') return null;
  if (serial instanceof Date) return serial;
  if (typeof serial === 'string') {
    const d = new Date(serial);
    return isNaN(d) ? null : d;
  }
  if (typeof serial !== 'number') return null;
  return new Date(Math.round((serial - 25569) * 86400) * 1000);
};
const toIsoDate = (v) => {
  const d = excelDateToJs(v);
  return d ? d.toISOString().slice(0, 10) : null;
};
const num = (v) => {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
};
const str = (v) => (v == null || v === '') ? null : String(v).trim();
const lower = (v) => { const s = str(v); return s ? s.toLowerCase() : null; };

const normalizePayment = (v) => {
  const s = lower(v);
  if (!s) return null;
  if (s.includes('zelle')) return 'zelle';
  if (s.includes('cash') || s.includes('efectivo')) return 'cash';
  if (s.includes('binance')) return 'binance';
  if (s.includes('mixto')) return 'mixto';
  if (s.includes('bolivar') || s.includes('movil') || s.includes('móvil') || s.includes('bs')) return 'bolivares';
  return null;
};

async function supabaseInsert(table, rows, opts = {}) {
  if (!rows.length) return { inserted: 0, data: [] };
  const prefer = opts.returnRows ? 'return=representation' : 'return=minimal';
  let inserted = 0;
  const all = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': prefer
      },
      body: JSON.stringify(batch)
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${table} batch ${i}/${rows.length} → ${res.status} ${body.slice(0, 600)}`);
    }
    if (opts.returnRows) {
      const data = await res.json();
      all.push(...data);
    }
    inserted += batch.length;
    process.stdout.write(`\r  ${table}: ${inserted}/${rows.length}`);
  }
  process.stdout.write('\n');
  return { inserted, data: all };
}

// ---------- VENTAS ----------
// Headers: DATE, CODE, ITEM, SIZE, COLOR, QUANTITY, PRICE, NET TO, CLIENT, CITY,
//          PHONE, PAYMENT METHOD, NET AMOUNT, CHANGE, TASA, DELIVERY, DELIVERY COST
// Grouping: each row that has CLIENT non-empty starts a new order. Rows with empty
// CLIENT are additional line items of the previous order.
function parseVentas(rows) {
  const orders = [];
  let cur = null;
  for (const r of rows) {
    const date = toIsoDate(r['DATE']);
    const client = str(r['CLIENT']);
    const itemName = str(r['ITEM']);
    const startsNew = !!client || (!cur && date && itemName);
    if (startsNew) {
      if (cur) orders.push(cur);
      const paymentMethod = normalizePayment(r['PAYMENT METHOD']);
      const tasa = num(r['TASA']);
      const deliveryCost = num(r['DELIVERY COST']) || 0;
      const change = num(r['CHANGE']) || 0;
      const deliveryRaw = str(r['DELIVERY']);
      cur = {
        date,
        order: {
          created_at: date ? date + 'T12:00:00Z' : null,
          updated_at: date ? date + 'T12:00:00Z' : null,
          client_name: client,
          client_city: str(r['CITY']),
          client_phone: str(r['PHONE']),
          channel: 'manual',
          status: 'completado',
          delivery_type: deliveryRaw ? 'delivery' : null,
          delivery_address: deliveryRaw,
          delivery_cost_usd: deliveryCost,
          exchange_rate: tasa,
          payment_method: paymentMethod,
          change_given: change,
          notes: null
        },
        items: []
      };
    }
    if (!cur) continue;
    if (itemName) {
      const qty = Math.max(1, Math.round(num(r['QUANTITY']) || 1));
      const unitPrice = num(r['NET TO']);
      const unitCost = num(r['PRICE']);
      const lineAmount = num(r['NET AMOUNT']);
      cur.items.push({
        sku: str(r['CODE']),
        product_name: itemName,
        size: str(r['SIZE']),
        color: lower(r['COLOR']),
        quantity: qty,
        unit_price_usd: unitPrice,
        unit_cost_usd: unitCost,
        total_price_usd: lineAmount != null ? lineAmount : (unitPrice != null ? Math.round(unitPrice * qty * 100) / 100 : null)
      });
    }
  }
  if (cur) orders.push(cur);

  // Compute order totals
  for (const o of orders) {
    const subtotal = o.items.reduce((s, it) => s + (it.total_price_usd || 0), 0);
    o.order.subtotal_usd = Math.round(subtotal * 100) / 100;
    const total = Math.round((subtotal + (o.order.delivery_cost_usd || 0)) * 100) / 100;
    o.order.total_usd = total;
    if (o.order.exchange_rate) o.order.total_bs = Math.round(total * o.order.exchange_rate * 100) / 100;
  }
  // Drop orders with no date or no items
  return orders.filter(o => o.date && o.items.length);
}

// ---------- CAJA ----------
// Raw array-of-arrays. Row 0 = section headers, row 1 = sub-headers, rows 2+ = data.
// CASH:      cols 0=date, 1=ingresos, 2=egresos, 3=otros_egresos, 4=pagos, 5=cambios
// BOLIVARES: cols 8=date, 9=ingresos, 10=egresos, 11=otros_egresos, 12=cambios, 13=otros_ingresos
// ZELLE:     cols 16=date, 17=ingresos, 18=egresos
// DELIVERIES section also in this sheet (starts around col 23). We process separately.
function parseCajaMovements(rawRows) {
  const data = rawRows.slice(2);
  const out = [];
  for (const row of data) {
    // CASH
    const dCash = toIsoDate(row[0]);
    if (dCash) {
      const push = (col, type, concept) => {
        const v = num(row[col]);
        if (v && v !== 0) out.push({
          created_at: dCash + 'T12:00:00Z',
          date: dCash,
          movement_type: type,
          wallet: 'cash_usd',
          amount: Math.abs(v),
          amount_usd_equivalent: Math.abs(v),
          concept
        });
      };
      push(1, 'ingreso', 'Ingreso cash');
      push(2, 'egreso', 'Egreso cash');
      push(3, 'egreso', 'Otros egresos');
      push(4, 'egreso', 'Pagos');
      push(5, 'cambio', 'Cambio');
    }
    // BOLIVARES (cols 9-14)
    const dBs = toIsoDate(row[9]);
    if (dBs) {
      const push = (col, type, concept) => {
        const v = num(row[col]);
        if (v && v !== 0) out.push({
          created_at: dBs + 'T12:00:00Z',
          date: dBs,
          movement_type: type,
          wallet: 'bolivares',
          amount: Math.abs(v),
          amount_usd_equivalent: null,
          concept
        });
      };
      push(10, 'ingreso', 'Ingreso bolivares');
      push(11, 'egreso', 'Egreso bolivares');
      push(12, 'egreso', 'Otros egresos');
      push(13, 'cambio', 'Cambio');
      push(14, 'ingreso', 'Otros ingresos');
    }
    // ZELLE (cols 18-24)
    const dZ = toIsoDate(row[18]);
    if (dZ) {
      const push = (col, type, concept) => {
        const v = num(row[col]);
        if (v && v !== 0) out.push({
          created_at: dZ + 'T12:00:00Z',
          date: dZ,
          movement_type: type,
          wallet: 'zelle',
          amount: Math.abs(v),
          amount_usd_equivalent: Math.abs(v),
          concept
        });
      };
      push(19, 'ingreso', 'Ingreso zelle');
      push(20, 'egreso', 'Egreso zelle');
      push(21, 'egreso', 'Operativos');
      push(22, 'egreso', 'Compras mercancía');
      push(23, 'cambio', 'Cambio');
      push(24, 'egreso', 'Dividendos');
    }
  }
  return out;
}

// DELIVERIES within CAJA sheet. User described cols:
//   date col (" deliverys "), rider1, destino1, rider2, destino2, monto.
// Approx indices (user): rider1=24, destino1=25, rider2=28, destino2=29, monto=31.
// Date col = last non-section col before the rider block; best guess = col 23.
// DELIVERIES in CAJA: col 27=fecha, 28=motociclista, 29=destino, 30=acumulado
// "acumulado" is cumulative running total, not per-delivery cost. Leave delivery_cost null.
function parseCajaDeliveries(rawRows) {
  const data = rawRows.slice(2);
  const out = [];
  for (const row of data) {
    const d = toIsoDate(row[27]);
    if (!d) continue;
    const rider = lower(row[28]);
    const dest = str(row[29]);
    if (!rider && !dest) continue;
    out.push({
      created_at: d + 'T12:00:00Z',
      date: d,
      rider_name: rider,
      destination: dest,
      status: 'entregado'
    });
  }
  return out;
}

// ---------- main ----------
async function main() {
  const path = resolve(FILE);
  let wb;
  try {
    wb = XLSX.read(readFileSync(path), { cellDates: false });
  } catch (e) {
    console.error(`No se pudo leer ${path}. Error: ${e.message}`);
    process.exit(1);
  }

  console.log(`📂 ${path}`);
  console.log(`Sheets: ${wb.SheetNames.join(', ')}\n`);

  if (INSPECT) {
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null });
      console.log(`--- ${name} (${rows.length} rows) ---`);
      if (rows.length) {
        console.log('Headers:', Object.keys(rows[0]));
        console.log('Sample 1:', rows[0]);
        if (rows[1]) console.log('Sample 2:', rows[1]);
      }
      console.log();
    }
    return;
  }

  const shouldRun = (name) => !ONLY.length || ONLY.includes(name.toLowerCase());
  const findSheetExact = (target) => wb.SheetNames.find(n => n.trim().toLowerCase() === target.toLowerCase());

  // VENTAS
  const ventasSheet = findSheetExact('VENTAS');
  if (ventasSheet && shouldRun('ventas')) {
    console.log(`\n🛒 VENTAS (${ventasSheet})`);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[ventasSheet], { defval: null });
    const orders = parseVentas(rows);
    const totalItems = orders.reduce((s, o) => s + o.items.length, 0);
    console.log(`  parsed: ${orders.length} órdenes, ${totalItems} line_items (de ${rows.length} filas)`);
    if (orders.length) {
      console.log('  sample order:', JSON.stringify(orders[0].order).slice(0, 400));
      console.log('  sample items (1st order):', orders[0].items.length);
    }
    if (!DRY && orders.length) {
      const orderPayloads = orders.map(o => o.order);
      const { data: inserted } = await supabaseInsert('orders', orderPayloads, { returnRows: true });
      // Attach order_ids to items (1:1 by position)
      const itemsToInsert = [];
      for (let i = 0; i < inserted.length; i++) {
        for (const it of orders[i].items) itemsToInsert.push({ ...it, order_id: inserted[i].id });
      }
      if (itemsToInsert.length) await supabaseInsert('order_items', itemsToInsert);
    }
  }

  // CAJA — cash_movements + deliveries section
  const cajaSheet = findSheetExact('CAJA');
  if (cajaSheet && shouldRun('caja')) {
    console.log(`\n💵 CAJA (${cajaSheet})`);
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[cajaSheet], { header: 1, defval: null });
    // Diagnostic: print row 0 (section headers) with indices so we can locate deliveries col
    if (DRY || INSPECT) {
      const r0 = raw[0] || [];
      const r1 = raw[1] || [];
      console.log('  row0 (section headers) non-empty:');
      r0.forEach((v, i) => { if (v != null && v !== '') console.log(`    [${i}] ${JSON.stringify(v)}`); });
      console.log('  row1 (sub-headers) non-empty:');
      r1.forEach((v, i) => { if (v != null && v !== '') console.log(`    [${i}] ${JSON.stringify(v)}`); });
    }
    const movements = parseCajaMovements(raw);
    const deliveries = parseCajaDeliveries(raw);
    console.log(`  cash_movements: ${movements.length}`);
    console.log(`  deliveries: ${deliveries.length}`);
    if (movements[0]) console.log('  sample movement:', JSON.stringify(movements[0]));
    if (deliveries[0]) console.log('  sample delivery:', JSON.stringify(deliveries[0]));
    if (!DRY) {
      if (movements.length) await supabaseInsert('cash_movements', movements);
      if (deliveries.length) await supabaseInsert('deliveries', deliveries);
    }
  }

  console.log('\n✅ Done.');
}

main().catch(e => { console.error('\n❌', e); process.exit(1); });
