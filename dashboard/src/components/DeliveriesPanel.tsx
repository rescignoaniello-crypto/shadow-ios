import type { PendingDelivery } from '@/lib/queries';

const statusLabel: Record<string, string> = {
  pendiente: 'Pendiente',
  asignado: 'Asignado',
  en_ruta: 'En ruta'
};

export function DeliveriesPanel({ deliveries }: { deliveries: PendingDelivery[] }) {
  const byRider = new Map<string, PendingDelivery[]>();
  for (const d of deliveries) {
    const k = d.rider_name || 'sin asignar';
    const arr = byRider.get(k) ?? [];
    arr.push(d);
    byRider.set(k, arr);
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Deliveries pendientes</h2>
        <span className="text-xs opacity-60">{deliveries.length} activos</span>
      </div>
      {deliveries.length === 0 ? (
        <div className="text-center text-slate-500 py-6 text-sm">Ninguno pendiente</div>
      ) : (
        <div className="space-y-4">
          {Array.from(byRider.entries()).map(([rider, items]) => (
            <div key={rider}>
              <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">
                🏍 {rider} <span className="opacity-50">· {items.length}</span>
              </div>
              <ul className="space-y-1.5">
                {items.map(d => (
                  <li key={d.id} className="flex items-center justify-between text-sm bg-slate-800/40 rounded-md px-3 py-2">
                    <span className="text-slate-200">{d.destination || <span className="opacity-50">Sin destino</span>}</span>
                    <span className="flex items-center gap-3">
                      {d.cash_to_collect_usd ? (
                        <span className="text-amber-300 text-xs">cobra ${Number(d.cash_to_collect_usd).toFixed(2)}</span>
                      ) : null}
                      <span className="text-xs opacity-60">{statusLabel[d.status ?? ''] || d.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
