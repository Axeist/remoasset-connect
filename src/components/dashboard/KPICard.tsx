import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string;
  change: string;
  icon: LucideIcon;
  variant: 'primary' | 'success' | 'accent' | 'warning';
}

const variantStyles = {
  primary: 'gradient-primary',
  success: 'gradient-success',
  accent: 'gradient-accent',
  warning: 'bg-gradient-to-br from-amber-500 to-orange-500',
};

export function KPICard({ title, value, change, icon: Icon, variant }: KPICardProps) {
  const isPositive = change.startsWith('+');
  const isNeutral = change === '0';

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl p-6 text-white card-shadow-lg",
      variantStyles[variant]
    )}>
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-white/20 rounded-lg">
            <Icon className="h-5 w-5" />
          </div>
          <span className={cn(
            "text-sm font-medium px-2 py-1 rounded-full",
            isNeutral ? "bg-white/20" : isPositive ? "bg-white/20" : "bg-white/20"
          )}>
            {change}
          </span>
        </div>
        
        <div>
          <p className="text-3xl font-display font-bold">{value}</p>
          <p className="text-white/80 text-sm mt-1">{title}</p>
        </div>
      </div>
    </div>
  );
}
