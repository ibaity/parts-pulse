import { Card } from '@/components/ui/card';

const TONES = {
  primary: { chip: 'bg-primary/10 text-primary', bar: 'bg-primary' },
  warning: { chip: 'bg-warning/10 text-warning', bar: 'bg-warning' },
  critical: { chip: 'bg-critical/10 text-critical', bar: 'bg-critical' },
  info: { chip: 'bg-info/10 text-info', bar: 'bg-info' },
  success: { chip: 'bg-success/10 text-success', bar: 'bg-success' },
};

export default function StatCard({ title, value, icon: Icon, tone = 'primary', subtitle }) {
  const t = TONES[tone] || TONES.primary;
  return (
    <Card className="relative overflow-hidden p-5 shadow-sm hover:shadow-md transition-shadow">
      <span className={`absolute inset-x-0 top-0 h-1 ${t.bar}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold mt-2 tabular-nums tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${t.chip}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </Card>
  );
}
