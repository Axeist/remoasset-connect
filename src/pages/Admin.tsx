import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Edit2, Users, User, Sliders, BarChart3, Download, ExternalLink, FileDown, Activity } from 'lucide-react';
import { ProfileCard } from '@/components/settings/ProfileCard';
import { supabase } from '@/integrations/supabase/client';
import { EditUserRoleDialog } from '@/components/admin/EditUserRoleDialog';
import { AddUserDialog } from '@/components/admin/AddUserDialog';
import { StatusFormDialog } from '@/components/admin/StatusFormDialog';
import { CountryFormDialog } from '@/components/admin/CountryFormDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  full_name: string | null;
}

interface Status {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

interface Country {
  id: string;
  name: string;
  code: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [editUser, setEditUser] = useState<TeamMember | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [statusFormOpen, setStatusFormOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<Status | null>(null);
  const [countryFormOpen, setCountryFormOpen] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<Status | null>(null);
  const [deleteCountry, setDeleteCountry] = useState<Country | null>(null);
  const [analytics, setAnalytics] = useState<{
    byStatus: { name: string; value: number; color: string }[];
    byCountry: { name: string; leads: number }[];
    teamActivity: { name: string; activities: number }[];
  }>({ byStatus: [], byCountry: [], teamActivity: [] });

  const fetchData = async () => {
    const [rolesRes, statusRes, countryRes] = await Promise.all([
      supabase.from('user_roles').select('id, user_id, role'),
      supabase.from('lead_statuses').select('*').order('sort_order'),
      supabase.from('countries').select('*').order('name'),
    ]);

    if (rolesRes.data) {
      const userIds = rolesRes.data.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      const membersWithNames = rolesRes.data.map((r) => ({
        ...r,
        full_name: profiles?.find((p) => p.user_id === r.user_id)?.full_name ?? null,
      }));
      setTeamMembers(membersWithNames);
    }
    if (statusRes.data) setStatuses(statusRes.data);
    if (countryRes.data) setCountries(countryRes.data);
  };

  const fetchAnalytics = async () => {
    const { data: leadsWithStatus } = await supabase
      .from('leads')
      .select('status_id, lead_statuses(name, color)');
    const statusCounts: Record<string, { count: number; color: string }> = {};
    type Row = { lead_statuses: { name: string; color: string } | null };
    (leadsWithStatus ?? []).forEach((l: Row) => {
      const name = l.lead_statuses?.name ?? 'Unassigned';
      const color = l.lead_statuses?.color ?? '#6B7280';
      if (!statusCounts[name]) statusCounts[name] = { count: 0, color };
      statusCounts[name].count++;
    });
    const byStatus = Object.entries(statusCounts).map(([name, { count, color }]) => ({ name, value: count, color }));

    const { data: leadsWithCountry } = await supabase.from('leads').select('country_id, countries(code)');
    const countryCounts: Record<string, number> = {};
    type CountryRow = { countries: { code: string } | null };
    (leadsWithCountry ?? []).forEach((l: CountryRow) => {
      const code = l.countries?.code ?? 'Other';
      countryCounts[code] = (countryCounts[code] ?? 0) + 1;
    });
    const byCountry = Object.entries(countryCounts).map(([name, leads]) => ({ name, leads }));

    const { data: activities } = await supabase
      .from('lead_activities')
      .select('user_id');
    const activityCounts: Record<string, number> = {};
    (activities ?? []).forEach((a: { user_id: string }) => {
      activityCounts[a.user_id] = (activityCounts[a.user_id] ?? 0) + 1;
    });
    const userIds = Object.keys(activityCounts);
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
    const profileMap = (profiles ?? []).reduce(
      (acc, p) => {
        acc[p.user_id] = p.full_name ?? p.user_id;
        return acc;
      },
      {} as Record<string, string>
    );
    const teamActivity = userIds.map((uid) => ({
      name: profileMap[uid] ?? uid.slice(0, 8),
      activities: activityCounts[uid],
    }));

    setAnalytics({ byStatus, byCountry, teamActivity });
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [teamMembers.length, statuses.length, countries.length]);

  const handleDeleteStatus = async () => {
    if (!deleteStatus) return;
    const { error } = await supabase.from('lead_statuses').delete().eq('id', deleteStatus.id);
    setDeleteStatus(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    toast({ title: 'Status deleted' });
    fetchData();
    fetchAnalytics();
  };

  const handleDeleteCountry = async () => {
    if (!deleteCountry) return;
    const { error } = await supabase.from('countries').delete().eq('id', deleteCountry.id);
    setDeleteCountry(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    toast({ title: 'Country deleted' });
    fetchData();
    fetchAnalytics();
  };

  const exportAnalytics = () => {
    const rows = [
      ['Lead status', 'Count'],
      ...analytics.byStatus.map((s) => [s.name, String(s.value)]),
      [],
      ['Country', 'Leads'],
      ...analytics.byCountry.map((c) => [c.name, String(c.leads)]),
      [],
      ['Team member', 'Activities'],
      ...analytics.teamActivity.map((t) => [t.name, String(t.activities)]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Report exported' });
  };

  const generateSampleLeadsCSV = async () => {
    // Get all users from user_roles table with their names
    const { data: allRoles } = await supabase.from('user_roles').select('user_id');
    
    if (!allRoles || allRoles.length < 2) {
      toast({ variant: 'destructive', title: 'Error', description: 'Need at least 2 users in the system.' });
      return;
    }
    
    // Get profile names for the first 2 users
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', allRoles.slice(0, 2).map(r => r.user_id));
    
    const targetUsers = (profiles || []).slice(0, 2);

    const companies = [
      'Tech Solutions Inc', 'Global Ventures Ltd', 'Innovation Corp', 'Digital Systems', 'Cloud Services Inc',
      'Smart Tech LLC', 'Future Industries', 'Dynamic Solutions', 'Prime Technologies', 'Elite Enterprises',
      'Apex Solutions', 'Nexus Group', 'Vertex Systems', 'Quantum Labs', 'Stellar Corp',
      'Horizon Tech', 'Summit Solutions', 'Peak Innovations', 'Core Systems', 'Prime Digital',
      'Wave Technologies', 'Spark Ventures', 'Pulse Industries', 'Flow Systems', 'Bright Solutions',
      'Swift Tech', 'Bold Enterprises', 'Sharp Innovations', 'Clear Systems', 'Fast Solutions',
      'Blue Ocean Tech', 'Green Field Corp', 'Red Rock Systems', 'Silver Line Inc', 'Gold Standard LLC',
      'Crystal Solutions', 'Diamond Tech', 'Platinum Group', 'Bronze Industries', 'Iron Systems',
      'Steel Works Inc', 'Copper Solutions', 'Zinc Technologies', 'Titanium Corp', 'Aluminum Group',
      'Carbon Systems', 'Silicon Labs', 'Nitrogen Tech', 'Oxygen Solutions', 'Hydrogen Industries'
    ];

    const contacts = [
      { name: 'John Smith', designation: 'CEO' },
      { name: 'Jane Doe', designation: 'CTO' },
      { name: 'Michael Johnson', designation: 'VP Sales' },
      { name: 'Sarah Williams', designation: 'Director' },
      { name: 'David Brown', designation: 'Manager' },
      { name: 'Emily Davis', designation: 'COO' },
      { name: 'James Wilson', designation: 'CFO' },
      { name: 'Lisa Anderson', designation: 'VP Operations' },
      { name: 'Robert Taylor', designation: 'Head of IT' },
      { name: 'Maria Garcia', designation: 'Procurement Manager' },
    ];

    // Get statuses and countries with names
    const [statusesRes, countriesRes] = await Promise.all([
      supabase.from('lead_statuses').select('id, name'),
      supabase.from('countries').select('id, name, code'),
    ]);

    const statuses = statusesRes.data || [];
    const countries = countriesRes.data || [];

    // CSV headers matching import format
    const rows: string[][] = [
      ['company_name', 'contact_name', 'contact_designation', 'email', 'phone', 'website', 'country', 'status', 'lead_score', 'lead_owner', 'notes']
    ];

    // Generate 100 leads for each user
    targetUsers.forEach((user, userIdx) => {
      for (let i = 0; i < 100; i++) {
        const companyName = `${companies[i % companies.length]}`;
        const contact = contacts[i % contacts.length];
        const email = `${contact.name.toLowerCase().replace(' ', '.')}@${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
        const phone = `+1-${String(Math.floor(Math.random() * 900 + 100))}-${String(Math.floor(Math.random() * 900 + 100))}-${String(Math.floor(Math.random() * 9000 + 1000))}`;
        const website = `https://www.${companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
        const status = statuses[Math.floor(Math.random() * statuses.length)]?.name || 'New';
        const country = countries[Math.floor(Math.random() * countries.length)]?.name || 'United States';
        const leadScore = Math.floor(Math.random() * 70) + 30; // 30-100
        const notes = `Initial outreach completed. Interested in our enterprise solutions. Follow-up scheduled for next week.`;

        rows.push([
          companyName,
          contact.name,
          contact.designation,
          email,
          phone,
          website,
          country,
          status,
          String(leadScore),
          user.full_name || user.user_id,
          notes
        ]);
      }
    });

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sample-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ 
      title: 'Sample CSV generated', 
      description: `200 sample leads ready for import. After importing, use "Generate Activity Logs" to add simulated activities.` 
    });
  };

  const generateActivityLogs = async () => {
    try {
      // Get all leads owned by users (not unassigned)
      const { data: leads } = await supabase
        .from('leads')
        .select('id, company_name, owner_id')
        .not('owner_id', 'is', null)
        .limit(200);

      if (!leads || leads.length === 0) {
        toast({ variant: 'destructive', title: 'No leads found', description: 'Import leads first before generating activity logs.' });
        return;
      }

      const activityTypes = ['call', 'email', 'meeting', 'note'];
      const descriptions = {
        call: [
          'Initial discovery call completed. Discussed their current vendor management challenges.',
          'Follow-up call to address technical questions about our platform.',
          'Product demo call scheduled for next week.',
          'Called to discuss pricing and contract terms.',
          'Quick check-in call. They need more time to evaluate.',
        ],
        email: [
          'Sent introduction email with company overview and case studies.',
          'Forwarded product brochure and pricing information.',
          'Shared success story from similar industry client.',
          'Sent meeting invitation for product demonstration.',
          'Follow-up email with answers to their technical questions.',
        ],
        meeting: [
          'In-person meeting at their office. Met with procurement team.',
          'Virtual product demonstration completed. Very positive response.',
          'Stakeholder meeting with decision makers. Discussed implementation timeline.',
          'Contract negotiation meeting. Terms under review.',
          'Final presentation to executive board. Awaiting decision.',
        ],
        note: [
          'Lead shows strong interest. Budget approved for Q1.',
          'Competitor evaluation in progress. Following up next month.',
          'Requested additional references and case studies.',
          'Internal approval process started. Expected decision in 2 weeks.',
          'Positive feedback from technical team. Moving forward with POC.',
        ],
      };

      const activities = [];
      const now = new Date();

      for (const lead of leads) {
        // Generate 3-7 activities per lead
        const activityCount = Math.floor(Math.random() * 5) + 3;
        
        for (let i = 0; i < activityCount; i++) {
          const activityType = activityTypes[Math.floor(Math.random() * activityTypes.length)];
          const descArray = descriptions[activityType as keyof typeof descriptions];
          const description = descArray[Math.floor(Math.random() * descArray.length)];
          
          // Create activities spread over the last 30 days
          const daysAgo = Math.floor(Math.random() * 30);
          const createdAt = new Date(now);
          createdAt.setDate(createdAt.getDate() - daysAgo);
          createdAt.setHours(Math.floor(Math.random() * 9) + 9); // 9 AM - 6 PM
          createdAt.setMinutes(Math.floor(Math.random() * 60));

          activities.push({
            lead_id: lead.id,
            user_id: lead.owner_id,
            activity_type: activityType,
            description,
            created_at: createdAt.toISOString(),
          });
        }
      }

      // Insert activities in batches
      const BATCH_SIZE = 50;
      let inserted = 0;
      
      for (let i = 0; i < activities.length; i += BATCH_SIZE) {
        const batch = activities.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('lead_activities').insert(batch);
        
        if (error) {
          toast({ variant: 'destructive', title: 'Error', description: error.message });
          return;
        }
        inserted += batch.length;
      }

      toast({ 
        title: 'Activity logs generated', 
        description: `${inserted} activities created for ${leads.length} leads.` 
      });
    } catch (error) {
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to generate activities' 
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground mt-1">Manage users, settings, and system configuration</p>
        </div>

        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="configuration" className="gap-2">
              <Sliders className="h-4 w-4" />
              Configuration
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6 space-y-6 max-w-2xl">
            <ProfileCard />
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <Card className="card-shadow">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Team Members</CardTitle>
                <Button size="sm" className="gap-2 gradient-primary" onClick={() => setAddUserOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add user
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <p className="font-medium">{member.full_name || 'Unknown'}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                            {member.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditUser(member)}
                              title="Edit role"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/leads?owner=${member.user_id}`)}
                              className="gap-1"
                            >
                              <ExternalLink className="h-4 w-4" />
                              View leads
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="configuration" className="mt-6 space-y-6">
            <Card className="card-shadow">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Lead Statuses</CardTitle>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => { setEditingStatus(null); setStatusFormOpen(true); }}>
                  <Plus className="h-4 w-4" />
                  Add Status
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {statuses.map((status) => (
                    <Badge
                      key={status.id}
                      style={{ backgroundColor: status.color }}
                      className="text-white border-0 gap-2 pr-1"
                    >
                      {status.name}
                      <button
                        className="ml-1 hover:bg-white/20 rounded p-0.5"
                        onClick={() => { setEditingStatus(status); setStatusFormOpen(true); }}
                        title="Edit"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button
                        className="ml-1 hover:bg-white/20 rounded p-0.5"
                        onClick={() => setDeleteStatus(status)}
                        title="Delete"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="card-shadow">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Countries</CardTitle>
                <Button size="sm" variant="outline" className="gap-2" onClick={() => { setEditingCountry(null); setCountryFormOpen(true); }}>
                  <Plus className="h-4 w-4" />
                  Add Country
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {countries.map((country) => (
                    <Badge key={country.id} variant="secondary" className="gap-2 pr-1">
                      <span className="font-bold">{country.code}</span>
                      {country.name}
                      <button
                        className="ml-1 hover:bg-muted rounded p-0.5"
                        onClick={() => { setEditingCountry(country); setCountryFormOpen(true); }}
                        title="Edit"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button
                        className="ml-1 hover:bg-muted rounded p-0.5"
                        onClick={() => setDeleteCountry(country)}
                        title="Delete"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6 space-y-6">
            <div className="flex justify-end gap-2 flex-wrap">
              <Button variant="outline" size="sm" className="gap-2" onClick={generateSampleLeadsCSV}>
                <FileDown className="h-4 w-4" />
                Generate sample CSV
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={generateActivityLogs}>
                <Activity className="h-4 w-4" />
                Generate activity logs
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={exportAnalytics}>
                <Download className="h-4 w-4" />
                Export report
              </Button>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="card-shadow">
                <CardHeader>
                  <CardTitle>Leads by status</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.byStatus.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={analytics.byStatus}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label
                        >
                          {analytics.byStatus.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-muted-foreground text-sm py-8 text-center">No data</p>
                  )}
                </CardContent>
              </Card>
              <Card className="card-shadow">
                <CardHeader>
                  <CardTitle>Leads by country</CardTitle>
                </CardHeader>
                <CardContent>
                  {analytics.byCountry.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={analytics.byCountry}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-muted-foreground text-sm py-8 text-center">No data</p>
                  )}
                </CardContent>
              </Card>
            </div>
            <Card className="card-shadow">
              <CardHeader>
                <CardTitle>Team activity (lead activities count)</CardTitle>
              </CardHeader>
              <CardContent>
                {analytics.teamActivity.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={analytics.teamActivity} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={80} />
                      <Tooltip />
                      <Bar dataKey="activities" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-sm py-8 text-center">No activity yet</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <EditUserRoleDialog
          open={!!editUser}
          onOpenChange={(open) => !open && setEditUser(null)}
          userRoleId={editUser?.id ?? ''}
          userId={editUser?.user_id ?? ''}
          currentRole={editUser?.role ?? 'employee'}
          fullName={editUser?.full_name ?? null}
          onSuccess={fetchData}
        />
        <AddUserDialog open={addUserOpen} onOpenChange={setAddUserOpen} onSuccess={fetchData} />
        <StatusFormDialog
          open={statusFormOpen}
          onOpenChange={(open) => { setStatusFormOpen(open); if (!open) setEditingStatus(null); }}
          status={editingStatus}
          onSuccess={() => { fetchData(); fetchAnalytics(); }}
        />
        <CountryFormDialog
          open={countryFormOpen}
          onOpenChange={(open) => { setCountryFormOpen(open); if (!open) setEditingCountry(null); }}
          country={editingCountry}
          onSuccess={() => { fetchData(); fetchAnalytics(); }}
        />
        <AlertDialog open={!!deleteStatus} onOpenChange={(open) => !open && setDeleteStatus(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete status?</AlertDialogTitle>
              <AlertDialogDescription>
                Leads using this status may need to be updated. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteStatus} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={!!deleteCountry} onOpenChange={(open) => !open && setDeleteCountry(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete country?</AlertDialogTitle>
              <AlertDialogDescription>
                Leads using this country may need to be updated. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteCountry} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
