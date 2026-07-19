import { Card } from '@/components/ui/card';

export default function StatCard({ title, value, icon: Icon, accentClass = 'text-slate-600', subtitle }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold mt-2 tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Icon className={`w-5 h-5 ${accentClass}`} />
          </div>
        )}
      </div>
    </Card>
  );
}