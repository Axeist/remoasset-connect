import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import type { Lead } from '@/types/lead';
import { safeFormat } from '@/lib/date';
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type SortField = 'company_name' | 'created_at' | 'lead_score' | 'contact_name';
type SortOrder = 'asc' | 'desc';

interface LeadsTableProps {
  leads: Lead[];
  loading: boolean;
  onRefresh: () => void;
  sortBy?: SortField;
  sortOrder?: SortOrder;
  onSort?: (field: SortField) => void;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  page?: number;
  pageSize?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  /** When provided, clicking a row calls this instead of navigating to the detail page */
  onLeadClick?: (lead: Lead) => void;
  /** ID of the currently selected/active lead (highlights the row) */
  activeleadId?: string;
}

export function LeadsTable({
  leads,
  loading,
  sortBy = 'created_at',
  sortOrder = 'desc',
  onSort,
  selectedIds = new Set(),
  onSelectionChange,
  page = 1,
  pageSize = 10,
  totalCount = 0,
  onPageChange,
  onLeadClick,
  activeleadId,
}: LeadsTableProps) {
  const navigate = useNavigate();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const allSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.id));

  const toggleRow = (e: React.MouseEvent, leadId: string) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(leadId)) next.delete(leadId);
    else next.add(leadId);
    onSelectionChange?.(next);
  };

  const toggleAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (allSelected) onSelectionChange?.(new Set());
    else onSelectionChange?.(new Set(leads.map((l) => l.id)));
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => {
    const active = sortBy === field;
    return (
      <TableHead
        className={cn(onSort && 'cursor-pointer hover:bg-muted/50 select-none')}
        onClick={() => onSort?.(field)}
      >
        <div className="flex items-center gap-1">
          {children}
          {onSort && (active ? sortOrder === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" /> : null)}
        </div>
      </TableHead>
    );
  };

  if (loading) {
    return (
      <Card className="card-shadow">
        <CardContent className="p-0">
          <div className="space-y-4 p-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (leads.length === 0) {
    return (
      <Card className="card-shadow">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No leads found. Add your first lead to get started!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-shadow overflow-hidden rounded-xl border-border/80 animate-inner-card-hover">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {onSelectionChange && (
                <TableHead className="w-10" onClick={toggleAll}>
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => (allSelected ? onSelectionChange(new Set()) : onSelectionChange(new Set(leads.map((l) => l.id))))}
                    onClick={(e) => e.stopPropagation()}
                  />
                </TableHead>
              )}
              <SortHeader field="company_name">Company</SortHeader>
              <SortHeader field="contact_name">Contact</SortHeader>
              <TableHead>Status</TableHead>
              <SortHeader field="lead_score">Score</SortHeader>
              <TableHead>Owner</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Last Activity</TableHead>
              <SortHeader field="created_at">Created</SortHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow
                key={lead.id}
                className={cn(
                  'cursor-pointer hover:bg-muted/30 transition-colors',
                  activeleadId === lead.id && 'bg-primary/5 border-l-2 border-l-primary'
                )}
                onClick={() => onLeadClick ? onLeadClick(lead) : navigate(`/leads/${lead.id}`)}
              >
                {onSelectionChange && (
                  <TableCell onClick={(e) => toggleRow(e, lead.id)}>
                    <Checkbox
                      checked={selectedIds.has(lead.id)}
                      onCheckedChange={() => {}}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <div>
                    <p className="font-medium">{lead.company_name}</p>
                    <p className="text-sm text-muted-foreground">{lead.email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{lead.contact_name || '-'}</p>
                    <p className="text-sm text-muted-foreground">{lead.phone || '-'}</p>
                  </div>
                </TableCell>
                <TableCell>
                  {lead.status ? (
                    <Badge style={{ backgroundColor: lead.status.color }} className="text-white border-0">
                      {lead.status.name}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Unassigned</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-full max-w-[60px] h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full gradient-primary"
                        style={{ width: `${lead.lead_score || 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{lead.lead_score || 0}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {lead.owner?.full_name ?? '-'}
                </TableCell>
                <TableCell>
                  {lead.country ? (
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2 py-0.5 bg-muted rounded">
                        {lead.country.code}
                      </span>
                      {lead.country.name}
                    </span>
                  ) : '-'}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {safeFormat(lead.updated_at, 'MMM d, yyyy')}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {safeFormat(lead.created_at, 'MMM d, yyyy')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {onPageChange && totalCount > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalCount)} of {totalCount}
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                </PaginationItem>
                <PaginationItem>
                  <span className="px-2 text-sm">
                    Page {page} of {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
