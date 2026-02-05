import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import type { StatusChartItem, CountryChartItem, ActivityChartItem } from '@/hooks/useDashboardData';

const defaultStatusData: StatusChartItem[] = [];
const defaultCountryData: CountryChartItem[] = [];
const defaultActivityData: ActivityChartItem[] = [];

interface LeadsChartProps {
  isAdmin: boolean;
  statusData?: StatusChartItem[];
  countryData?: CountryChartItem[];
  activityData?: ActivityChartItem[];
  loading?: boolean;
}

export function LeadsChart({
  isAdmin,
  statusData = defaultStatusData,
  countryData = defaultCountryData,
  activityData = defaultActivityData,
  loading = false,
}: LeadsChartProps) {
  const hasStatus = statusData.length > 0;
  const hasCountry = countryData.length > 0;

  return (
    <Card className="card-shadow h-full w-full flex flex-col rounded-xl border-border/80 animate-inner-card-hover">
      <CardHeader>
        <CardTitle className="font-display">Lead Analytics</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        {loading ? (
          <Skeleton className="h-[300px] w-full flex-1" />
        ) : (
        <Tabs defaultValue="status" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mb-4 shrink-0">
            <TabsTrigger value="status">By Status</TabsTrigger>
            <TabsTrigger value="country">By Country</TabsTrigger>
            {isAdmin && <TabsTrigger value="activity">Activity</TabsTrigger>}
          </TabsList>
          
          <TabsContent value="status" className="flex-1 min-h-[300px] mt-0 data-[state=inactive]:hidden flex flex-col">
            {hasStatus ? (
            <div className="flex-1 min-h-0 flex flex-col">
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
            </div>
            ) : (
              <div className="flex items-center justify-center flex-1 text-muted-foreground">No lead data yet</div>
            )}
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 mt-6 px-2 shrink-0">
              {statusData.map((item) => (
                <div key={item.name} className="flex items-center gap-2 min-w-0 shrink-0">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">{item.name}</span>
                </div>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="country" className="flex-1 min-h-[300px] mt-0 data-[state=inactive]:hidden flex flex-col">
            {hasCountry ? (
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
            ) : (
              <div className="flex items-center justify-center flex-1 text-muted-foreground">No country data yet</div>
            )}
          </TabsContent>
          
          {isAdmin && (
            <TabsContent value="activity" className="flex-1 min-h-[300px] mt-0 data-[state=inactive]:hidden flex flex-col">
              {activityData.length > 0 ? (
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
              ) : (
                <div className="flex items-center justify-center flex-1 text-muted-foreground">No activity data yet</div>
              )}
            </TabsContent>
          )}
        </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
