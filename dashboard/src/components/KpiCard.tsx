type Props = {
  label: string;
  value: string;
  sublabel?: string;
  accent?: 'blue' | 'green' | 'amber' | 'violet';
};

const accentMap = {
  blue: 'from-blue-500/10 to-blue-500/0 border-blue-500/20 text-blue-300',
  green: 'from-emerald-500/10 to-emerald-500/0 border-emerald-500/20 text-emerald-300',
  amber: 'from-amber-500/10 to-amber-500/0 border-amber-500/20 text-amber-300',
  violet: 'from-violet-500/10 to-violet-500/0 border-violet-500/20 text-violet-300'
};

export function KpiCard({ label, value, sublabel, accent = 'blue' }: Props) {
  return (
    <div className={`rounded-xl border bg-gradient-to-br ${accentMap[accent]} p-5 backdrop-blur`}>
      <div className="text-xs uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
      {sublabel && <div className="mt-1 text-xs opacity-60">{sublabel}</div>}
    </div>
  );
}
