import type { ActiveOrder } from '@/lib/queries';

const statusTone: Record<string, string> = {
  pendiente_pago: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  confirmado: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  en_preparacion: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  en_ruta: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  despachado: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  entregado: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  completado: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  cancelado: 'bg-red-500/15 text-red-300 border-red-500/30',
};

const payLabel: Record<string, string> = {
  cash: 'Cash', zelle: 'Zelle', bolivares: 'Bs', binance: 'Binance', mixto: 'Mixto',
};

const fmtUsd = (v: number | null) => v == null ? '--' : '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function hoursAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
}

export function OrdersTable({ orders }: { orders: ActiveOrder[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Pedidos activos</h2>
        <span className="text-xs opacity-60">{orders.length} pedidos</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800">
              <th className="py-2 pr-3 font-medium">#</th>
              <th className="py-2 pr-3 font-medium">Cliente</th>
              <th className="py-2 pr-3 font-medium hidden sm:table-cell">Pago</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium text-right">Total</th>
              <th className="py-2 font-medium text-right hidden md:table-cell">Tiempo</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={6} className="py-6 text-center text-slate-500">Sin pedidos activos</td></tr>
            ) : orders.map(o => {
              const hrs = hoursAgo(o.created_at);
              const stale = hrs >= 24;
              return (
                <tr key={o.id} className={`border-b border-slate-800/60 hover:bg-slate-800/30 ${stale ? 'bg-red-500/5' : ''}`}>
                  <td className="py-2 pr-3 text-slate-400 font-mono text-xs">{o.order_number ? '#' + o.order_number : '--'}</td>
                  <td className="py-2 pr-3 text-slate-100">{o.client_name || <span className="opacity-50">--</span>}</td>
                  <td className="py-2 pr-3 text-slate-400 hidden sm:table-cell text-xs">{payLabel[o.payment_method ?? ''] || o.payment_method || '--'}</td>
                  <td className="py-2 pr-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${statusTone[o.status ?? ''] || 'bg-slate-700/30 text-slate-300 border-slate-600'}`}>
                      {o.status?.replace(/_/g, ' ') ?? '--'}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right font-medium text-slate-100">{fmtUsd(o.total_usd)}</td>
                  <td className={`py-2 text-right text-xs hidden md:table-cell ${stale ? 'text-red-400 font-medium' : 'text-slate-500'}`}>
                    {hrs < 1 ? '<1h' : hrs + 'h'}
                    {stale && ' !'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
