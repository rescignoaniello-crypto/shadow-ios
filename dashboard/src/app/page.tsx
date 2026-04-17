import { getKpis, getCurrentRate, vzTodayRange, getWalletBalances, getRecentOrders, getPendingDeliveries, getMonthlySales } from '@/lib/queries';
import { KpiCard } from '@/components/KpiCard';
import { WalletPanel } from '@/components/WalletPanel';
import { OrdersTable } from '@/components/OrdersTable';
import { DeliveriesPanel } from '@/components/DeliveriesPanel';
import { SalesChart } from '@/components/SalesChart';

export const revalidate = 30;

const fmtUsd = (v: number) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtBs = (v: number) => 'Bs ' + Math.round(v).toLocaleString('es-VE');

export default async function DashboardPage() {
  const [kpis, rate, balances, orders, deliveries, monthly] = await Promise.all([
    getKpis(),
    getCurrentRate(),
    getWalletBalances(),
    getRecentOrders(15),
    getPendingDeliveries(),
    getMonthlySales(12)
  ]);

  const { dateStr } = vzTodayRange();
  const [y, m, d] = dateStr.split('-');
  const fmtDate = `${d}/${m}/${y}`;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold">Shadow iOS — Primal VZla</h1>
          <p className="mt-1 text-sm opacity-60">Dashboard · {fmtDate}</p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider opacity-60">Tasa hoy</div>
          <div className="text-xl font-semibold">
            {rate != null ? `Bs ${rate.toLocaleString('es-VE')}/USD` : '—'}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Ventas hoy" value={String(kpis.ordersToday)} sublabel="pedidos del día" accent="blue" />
        <KpiCard label="Total USD" value={fmtUsd(kpis.totalUsdToday)} sublabel="facturado hoy" accent="green" />
        <KpiCard label="Total Bs" value={fmtBs(kpis.totalBsToday)} sublabel="facturado hoy" accent="amber" />
        <KpiCard label="Pedidos abiertos" value={String(kpis.newOrdersPending)} sublabel="pendientes / en proceso" accent="violet" />
      </section>

      <section className="mb-6">
        <WalletPanel balances={balances} rate={rate} />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <OrdersTable orders={orders} />
        </div>
        <div>
          <DeliveriesPanel deliveries={deliveries} />
        </div>
      </section>

      <section className="mb-6">
        <SalesChart data={monthly} />
      </section>

      <footer className="mt-10 text-xs opacity-40">
        Datos en vivo desde Supabase · tasa desde n8n Data Table · revalida cada 30s
      </footer>
    </main>
  );
}
