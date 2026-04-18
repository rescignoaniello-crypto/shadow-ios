import { getKpis, getCurrentRate, vzTodayRange, getWalletBalances, getActiveOrders, getPendingDeliveries, getMonthlySales, getTodayMovements } from '@/lib/queries';
import { KpiCard } from '@/components/KpiCard';
import { WalletPanel } from '@/components/WalletPanel';
import { OrdersTable } from '@/components/OrdersTable';
import { DeliveriesPanel } from '@/components/DeliveriesPanel';
import { SalesChart } from '@/components/SalesChart';
import { MovementsFeed } from '@/components/MovementsFeed';
import { AutoRefresh } from '@/components/AutoRefresh';

export const revalidate = 30;

const fmtUsd = (v: number) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtBs = (v: number) => 'Bs ' + Math.round(v).toLocaleString('es-VE');

export default async function DashboardPage() {
  const [kpis, rate, balances, orders, deliveries, monthly, movements] = await Promise.all([
    getKpis(),
    getCurrentRate(),
    getWalletBalances(),
    getActiveOrders(),
    getPendingDeliveries(),
    getMonthlySales(12),
    getTodayMovements(),
  ]);

  const { dateStr } = vzTodayRange();
  const [y, m, d] = dateStr.split('-');
  const fmtDate = `${d}/${m}/${y}`;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 max-w-7xl mx-auto">
      <AutoRefresh interval={30} />

      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Shadow iOS</h1>
          <p className="mt-0.5 text-sm opacity-50">{fmtDate}</p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider opacity-50">Tasa</div>
          <div className="text-lg font-semibold">
            {rate != null ? `Bs ${rate.toLocaleString('es-VE')}/USD` : '--'}
          </div>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
        <KpiCard label="Pedidos hoy" value={String(kpis.ordersToday)} sublabel="nuevos" accent="blue" />
        <KpiCard label="Facturado" value={fmtUsd(kpis.totalUsdToday)} sublabel="USD hoy" accent="green" />
        <KpiCard label="Facturado Bs" value={fmtBs(kpis.totalBsToday)} sublabel="hoy" accent="amber" />
        <KpiCard label="Pendientes" value={String(kpis.newOrdersPending)} sublabel="sin despachar" accent="violet" />
        <KpiCard label="Despachados" value={String(kpis.dispatchedToday)} sublabel="hoy" accent="blue" />
        <KpiCard label="Gastos" value={fmtUsd(kpis.expensesToday)} sublabel="egresos hoy" accent="amber" />
      </section>

      {/* Caja */}
      <section className="mb-5">
        <WalletPanel balances={balances} rate={rate} />
      </section>

      {/* Movimientos + Pedidos */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <MovementsFeed movements={movements} />
        <OrdersTable orders={orders} />
      </section>

      {/* Deliveries + Chart */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <DeliveriesPanel deliveries={deliveries} />
        <div className="lg:col-span-2">
          <SalesChart data={monthly} />
        </div>
      </section>

      <footer className="mt-8 text-xs opacity-30 text-center">
        Shadow iOS · Primal VZla · Datos en vivo · Auto-refresh 30s
      </footer>
    </main>
  );
}
