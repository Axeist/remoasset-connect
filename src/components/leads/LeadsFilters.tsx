import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Filters {
  search: string;
  status: string;
  country: string;
  scoreMin: number;
  scoreMax: number;
}

interface LeadsFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
}

export function LeadsFilters({ filters, onFiltersChange }: LeadsFiltersProps) {
  const [statuses, setStatuses] = useState<{ id: string; name: string; color: string }[]>([]);
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    const [statusRes, countryRes] = await Promise.all([
      supabase.from('lead_statuses').select('id, name, color').order('sort_order'),
      supabase.from('countries').select('id, name').order('name'),
    ]);

    if (statusRes.data) setStatuses(statusRes.data);
    if (countryRes.data) setCountries(countryRes.data);
  };

  return (
    <Card className="card-shadow">
      <CardContent className="p-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={filters.search}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              className="pl-10"
            />
          </div>

          {/* Status */}
          <Select 
            value={filters.status} 
            onValueChange={(value) => onFiltersChange({ ...filters, status: value === 'all' ? '' : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status.id} value={status.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color }} />
                    {status.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Country */}
          <Select 
            value={filters.country} 
            onValueChange={(value) => onFiltersChange({ ...filters, country: value === 'all' ? '' : value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {countries.map((country) => (
                <SelectItem key={country.id} value={country.id}>
                  {country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Score Range */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Score Range</span>
              <span className="font-medium">{filters.scoreMin} - {filters.scoreMax}</span>
            </div>
            <Slider
              value={[filters.scoreMin, filters.scoreMax]}
              min={0}
              max={100}
              step={5}
              onValueChange={([min, max]) => onFiltersChange({ ...filters, scoreMin: min, scoreMax: max })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
