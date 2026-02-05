import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { LeadsTable } from '@/components/leads/LeadsTable';
import { LeadsFilters } from '@/components/leads/LeadsFilters';
import { Button } from '@/components/ui/button';
import { Plus, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Lead {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  lead_score: number | null;
  status: { name: string; color: string } | null;
  country: { name: string; code: string } | null;
  created_at: string;
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    country: '',
    scoreMin: 0,
    scoreMax: 100,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchLeads();
  }, [filters]);

  const fetchLeads = async () => {
    setLoading(true);
    let query = supabase
      .from('leads')
      .select(`
        id,
        company_name,
        contact_name,
        email,
        phone,
        lead_score,
        created_at,
        status:lead_statuses(name, color),
        country:countries(name, code)
      `)
      .order('created_at', { ascending: false });

    if (filters.search) {
      query = query.or(`company_name.ilike.%${filters.search}%,contact_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
    }

    if (filters.status) {
      query = query.eq('status_id', filters.status);
    }

    if (filters.country) {
      query = query.eq('country_id', filters.country);
    }

    query = query.gte('lead_score', filters.scoreMin).lte('lead_score', filters.scoreMax);

    const { data, error } = await query;

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch leads' });
    } else {
      setLeads(data as Lead[]);
    }
    setLoading(false);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Leads</h1>
            <p className="text-muted-foreground mt-1">Manage and track your sales leads</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button className="gap-2 gradient-primary">
              <Plus className="h-4 w-4" />
              Add Lead
            </Button>
          </div>
        </div>

        {/* Filters */}
        <LeadsFilters filters={filters} onFiltersChange={setFilters} />

        {/* Table */}
        <LeadsTable leads={leads} loading={loading} onRefresh={fetchLeads} />
      </div>
    </AppLayout>
  );
}
