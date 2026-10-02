// Consistent page title block: icon chip, title, subtitle and optional actions on the right.
export default function PageHeader({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex items-center gap-4 min-w-0">
        {Icon && (
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
            <Icon className="w-6 h-6 text-accent" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex gap-2 sm:ml-auto shrink-0">{children}</div>}
    </div>
  );
}
