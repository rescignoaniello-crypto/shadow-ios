import type { Movement } from '@/lib/queries';

const walletLabel: Record<string, string> = {
  cash_usd: 'Cash',
  zelle: 'Zelle',
  bolivares: 'Bs',
  binance: 'Binance',
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const vz = new Date(d.getTime() - 4 * 3600 * 1000);
  const hh = String(vz.getUTCHours()).padStart(2, '0');
  const mm = String(vz.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function MovementsFeed({ movements }: { movements: Movement[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Movimientos de hoy</h2>
        <span className="text-xs opacity-60">{movements.length} movimientos</span>
      </div>
      {movements.length === 0 ? (
        <div className="text-center text-slate-500 py-6 text-sm">Sin movimientos hoy</div>
      ) : (
        <div className="space-y-1">
          {movements.map(m => {
            const isIngreso = m.movement_type === 'ingreso';
            return (
              <div key={m.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-800/40 transition-colors">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isIngreso ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <div className="text-xs text-slate-500 w-12 flex-shrink-0">{formatTime(m.created_at)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-200 truncate">
                    {m.concept || (isIngreso ? 'Ingreso' : 'Egreso')}
                  </div>
                  {m.order_number && (
                    <div className="text-xs text-slate-500">#{m.order_number} {m.client_name}</div>
                  )}
                </div>
                <div className={`text-sm font-medium flex-shrink-0 ${isIngreso ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isIngreso ? '+' : '-'}
                  {m.wallet === 'bolivares' ? 'Bs ' + Math.round(m.amount).toLocaleString('es-VE') : '$' + m.amount.toFixed(2)}
                </div>
                <div className="text-xs text-slate-600 w-12 text-right flex-shrink-0">
                  {walletLabel[m.wallet] || m.wallet}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
