import type { RecentOrder } from '@/lib/queries';

const statusTone: Record<string, string> = {
  pendiente_pago: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  confirmado: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  en_preparacion: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  en_ruta: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  entregado: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  completado: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  cancelado: 'bg-red-500/15 text-red-300 border-red-500/30'
};

const channelLabel: Record<string, string> = {
  whatsapp: 'WhatsApp',
  shopify: 'Shopify',
  instagram: 'Instagram',
  manual: 'Manual'
};

const fmtUsd = (v: number | null) => v == null ? '—' : '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatWhen(iso: string) {
  const d = new Date(iso);
  const vz = new Date(d.getTime() - 4 * 3600 * 1000);
  const hh = String(vz.getUTCHours()).padStart(2, '0');
  const mm = String(vz.getUTCMinutes()).padStart(2, '0');
  const dd = String(vz.getUTCDate()).padStart(2, '0');
  const mo = String(vz.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mo} ${hh}:${mm}`;
}

export function OrdersTable({ orders }: { orders: RecentOrder[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-4">Pedidos recientes</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800">
              <th className="py-2 pr-4 font-medium">Fecha</th>
              <th className="py-2 pr-4 font-medium">Cliente</th>
              <th className="py-2 pr-4 font-medium">Canal</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={5} className="py-6 text-center text-slate-500">Sin pedidos</td></tr>
            ) : orders.map(o => (
              <tr key={o.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                <td className="py-2 pr-4 text-slate-400 whitespace-nowrap">{formatWhen(o.created_at)}</td>
                <td className="py-2 pr-4 text-slate-100">{o.client_name || <span className="opacity-50">—</span>}</td>
                <td className="py-2 pr-4 text-slate-400">{channelLabel[o.channel ?? ''] || o.channel || '—'}</td>
                <td className="py-2 pr-4">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${statusTone[o.status ?? ''] || 'bg-slate-700/30 text-slate-300 border-slate-600'}`}>
                    {o.status?.replace(/_/g, ' ') ?? '—'}
                  </span>
                </td>
                <td className="py-2 pr-4 text-right font-medium text-slate-100">{fmtUsd(o.total_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
