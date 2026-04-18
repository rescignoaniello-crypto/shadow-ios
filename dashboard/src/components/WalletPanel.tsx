import type { WalletBalances } from '@/lib/queries';

const fmtUsd = (v: number) => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtBs = (v: number) => 'Bs ' + Math.round(v).toLocaleString('es-VE');

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

type Props = { balances: WalletBalances; rate: number | null };

export function WalletPanel({ balances, rate }: Props) {
  const bsInUsd = rate ? balances.bolivares / rate : 0;
  const totalUsd = balances.cash_usd + balances.zelle + balances.binance + bsInUsd;

  const wallets = [
    { label: 'Cash USD', value: fmtUsd(balances.cash_usd), tone: 'bg-emerald-500/10 border-emerald-500/20' },
    { label: 'Zelle', value: fmtUsd(balances.zelle), tone: 'bg-blue-500/10 border-blue-500/20' },
    { label: 'Bolivares', value: fmtBs(balances.bolivares), sub: rate ? `~ ${fmtUsd(bsInUsd)}` : null, tone: 'bg-amber-500/10 border-amber-500/20' },
    { label: 'Binance', value: fmtUsd(balances.binance), tone: 'bg-yellow-500/10 border-yellow-500/20' },
  ];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Caja</h2>
        <div className="flex items-center gap-3">
          {balances.lastMovement && (
            <span className="text-xs text-slate-500">Ultimo mov: {timeAgo(balances.lastMovement)}</span>
          )}
          <span className="text-xs opacity-60">Total ~ <span className="font-semibold text-slate-200">{fmtUsd(totalUsd)}</span></span>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {wallets.map(w => (
          <div key={w.label} className={`rounded-lg border p-4 ${w.tone}`}>
            <div className="text-xs opacity-70">{w.label}</div>
            <div className="mt-1 text-xl font-semibold text-white">{w.value}</div>
            {w.sub && <div className="mt-0.5 text-xs opacity-60">{w.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
