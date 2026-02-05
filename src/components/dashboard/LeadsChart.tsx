import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const statusData = [
  { name: 'New', value: 35, color: '#3B82F6' },
  { name: 'Contacted', value: 28, color: '#8B5CF6' },
  { name: 'Qualified', value: 22, color: '#F59E0B' },
  { name: 'Proposal', value: 18, color: '#06B6D4' },
  { name: 'Won', value: 15, color: '#10B981' },
  { name: 'Lost', value: 8, color: '#EF4444' },
];

const countryData = [
  { name: 'US', leads: 45 },
  { name: 'UK', leads: 32 },
  { name: 'AU', leads: 24 },
  { name: 'IN', leads: 28 },
  { name: 'CA', leads: 18 },
  { name: 'DE', leads: 12 },
];

const activityData = [
  { name: 'Mon', calls: 12, emails: 24, meetings: 4 },
  { name: 'Tue', calls: 18, emails: 32, meetings: 6 },
  { name: 'Wed', calls: 15, emails: 28, meetings: 5 },
  { name: 'Thu', calls: 22, emails: 35, meetings: 8 },
  { name: 'Fri', calls: 16, emails: 26, meetings: 3 },
];

interface LeadsChartProps {
  isAdmin: boolean;
}

export function LeadsChart({ isAdmin }: LeadsChartProps) {
  return (
    <Card className="card-shadow">
      <CardHeader>
        <CardTitle className="font-display">Lead Analytics</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="status">
          <TabsList className="mb-4">
            <TabsTrigger value="status">By Status</TabsTrigger>
            <TabsTrigger value="country">By Country</TabsTrigger>
            {isAdmin && <TabsTrigger value="activity">Activity</TabsTrigger>}
          </TabsList>
          
          <TabsContent value="status" className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {statusData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-muted-foreground">{item.name}</span>
                </div>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="country" className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={countryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
                <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </TabsContent>
          
          {isAdmin && (
            <TabsContent value="activity" className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Line type="monotone" dataKey="calls" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line type="monotone" dataKey="emails" stroke="hsl(var(--accent))" strokeWidth={2} />
                  <Line type="monotone" dataKey="meetings" stroke="hsl(var(--success))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}
