import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Lead } from '@/pages/Leads';
import { format } from 'date-fns';

interface LeadsTableProps {
  leads: Lead[];
  loading: boolean;
  onRefresh: () => void;
}

export function LeadsTable({ leads, loading }: LeadsTableProps) {
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
    <Card className="card-shadow overflow-hidden">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/30 transition-colors">
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
                    <Badge 
                      style={{ backgroundColor: lead.status.color }} 
                      className="text-white border-0"
                    >
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
                <TableCell className="text-muted-foreground">
                  {format(new Date(lead.created_at), 'MMM d, yyyy')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
