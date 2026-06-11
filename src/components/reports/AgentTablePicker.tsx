import { useMemo } from 'react';
import { Users, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface AgentOption {
  userId: string;
  name: string;
  leadCount: number;
}

interface AgentTablePickerProps {
  agents: AgentOption[];
  selectedIds: string[] | null;
  onChange: (ids: string[] | null) => void;
  disabled?: boolean;
}

export function AgentTablePicker({ agents, selectedIds, onChange, disabled }: AgentTablePickerProps) {
  const label = useMemo(() => {
    if (!selectedIds) return 'All agents';
    if (selectedIds.length === 0) return 'No agents selected';
    if (selectedIds.length === 1) {
      return agents.find((a) => a.userId === selectedIds[0])?.name ?? '1 agent';
    }
    return `${selectedIds.length} agents`;
  }, [selectedIds, agents]);

  const toggleAgent = (userId: string) => {
    const current = selectedIds ?? agents.map((a) => a.userId);
    const next = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId];
    if (next.length === agents.length) {
      onChange(null);
    } else {
      onChange(next);
    }
  };

  const selectAll = () => onChange(null);
  const clearAll = () => onChange([]);

  const isChecked = (userId: string) => {
    if (!selectedIds) return true;
    return selectedIds.includes(userId);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || agents.length === 0}
          className="h-9 text-sm gap-2 font-normal justify-start min-w-[160px]"
        >
          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="flex items-center justify-between px-3 py-2.5 border-b bg-muted/30">
          <p className="text-sm font-medium">Agents in table</p>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={selectAll}>
              All
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={clearAll}>
              None
            </Button>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-2 space-y-0.5">
          {agents.map((agent) => (
            <label
              key={agent.userId}
              className={cn(
                'flex items-center gap-3 rounded-md px-2.5 py-2 cursor-pointer transition-colors',
                'hover:bg-muted/50',
                isChecked(agent.userId) && 'bg-primary/5',
              )}
            >
              <Checkbox
                checked={isChecked(agent.userId)}
                onCheckedChange={() => toggleAgent(agent.userId)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{agent.name}</p>
                <p className="text-xs text-muted-foreground">{agent.leadCount} leads</p>
              </div>
              {isChecked(agent.userId) && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
