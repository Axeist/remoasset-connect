import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { AddActivityDialog } from '@/components/leads/AddActivityDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { safeFormat } from '@/lib/date';
import {
  X,
  Maximize2,
  Phone,
  Mail,
  Calendar,
  FileText,
  Building2,
  Globe,
  MapPin,
  User,
  Link as LinkIcon,
  Paperclip,
  Trash2,
  MessageCircle,
  ExternalLink,
  ShieldCheck,
  Linkedin,
} from 'lucide-react';
import type { Lead } from '@/types/lead';

interface LeadActivity {
  id: string;
  activity_type: string;
  description: string;
  created_at: string;
  user_id: string;
  profile?: { full_name: string | null };
  attachments?: { type: 'url' | 'file'; url: string; name?: string }[];
}

const activityTypeConfig = {
  call: { icon: Phone, label: 'Call', color: 'bg-primary/10 text-primary' },
  email: { icon: Mail, label: 'Email', color: 'bg-accent/10 text-accent' },
  meeting: { icon: Calendar, label: 'Meeting', color: 'bg-success/10 text-success' },
  note: { icon: FileText, label: 'Note', color: 'bg-warning/10 text-warning' },
  whatsapp: { icon: MessageCircle, label: 'WhatsApp', color: 'bg-green-500/10 text-green-600' },
  linkedin: { icon: Linkedin, label: 'LinkedIn', color: 'bg-sky-500/10 text-sky-600' },
  nda: { icon: ShieldCheck, label: 'NDA', color: 'bg-blue-500/10 text-blue-600' },
};

interface LeadSidePanelProps {
  lead: Lead;
  onClose: () => void;
  onLeadUpdated: () => void;
}

export function LeadSidePanel({ lead, onClose, onLeadUpdated }: LeadSidePanelProps) {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === 'admin';
  const isOwner = lead.owner_id === user?.id;
  const canEdit = isAdmin || isOwner;

  const [fullLead, setFullLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loadingLead, setLoadingLead] = useState(true);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [addActivityOpen, setAddActivityOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchFullLead = async () => {
    const { data, error } = await supabase
      .from('leads')
      .select(`*, status:lead_statuses(name, color), country:countries(name, code)`)
      .eq('id', lead.id)
      .single();
    if (error || !data) return;
    setFullLead(data as unknown as Lead);
    setLoadingLead(false);
  };

  const fetchActivities = async () => {
    setLoadingActivities(true);
    const { data } = await supabase
      .from('lead_activities')
      .select('id, activity_type, description, created_at, user_id, attachments')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false });

    if (data?.length) {
      const userIds = [...new Set(data.map((a) => a.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      const profileMap = (profiles ?? []).reduce(
        (acc, p) => { acc[p.user_id] = p; return acc; },
        {} as Record<string, { full_name: string | null }>
      );
      setActivities(
        data.map((a) => ({
          ...a,
          profile: profileMap[a.user_id] ? { full_name: profileMap[a.user_id].full_name } : undefined,
        }))
      );
    } else {
      setActivities([]);
    }
    setLoadingActivities(false);
  };

  useEffect(() => {
    setLoadingLead(true);
    setLoadingActivities(true);
    setFullLead(null);
    setActivities([]);
    setActiveTab('overview');
    fetchFullLead();
    fetchActivities();
  }, [lead.id]);

  const handleDeleteActivity = async (activityId: string) => {
    const { error } = await supabase.from('lead_activities').delete().eq('id', activityId);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    toast({ title: 'Activity removed' });
    fetchActivities();
  };

  const displayLead = fullLead ?? lead;

  return (
    <div className="flex flex-col h-full bg-background border-l border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 border-b bg-muted/30 shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            <h2 className="font-display font-bold text-base text-foreground truncate">
              {displayLead.company_name}
            </h2>
            {displayLead.status && (
              <Badge
                className="border-0 text-white text-xs shrink-0"
                style={{ backgroundColor: displayLead.status.color }}
              >
                {displayLead.status.name}
              </Badge>
            )}
          </div>
          {displayLead.contact_name && (
            <p className="text-sm text-muted-foreground mt-0.5 ml-6 truncate">
              {displayLead.contact_name}
              {(displayLead as any).contact_designation && ` · ${(displayLead as any).contact_designation}`}
            </p>
          )}
          {/* Score bar */}
          <div className="flex items-center gap-2 mt-2 ml-6">
            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full gradient-primary rounded-full"
                style={{ width: `${displayLead.lead_score ?? 0}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">Score {displayLead.lead_score ?? 0}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate(`/leads/${lead.id}`)}
            title="Open full page"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} title="Close panel">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick-action links */}
      <div className="flex items-center gap-1 px-4 py-2 border-b bg-muted/10 shrink-0 flex-wrap">
        {displayLead.phone && (
          <a
            href={`tel:${displayLead.phone}`}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <Phone className="h-3 w-3" />
            {displayLead.phone}
          </a>
        )}
        {displayLead.email && (
          <a
            href={`mailto:${displayLead.email}`}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <Mail className="h-3 w-3" />
            {displayLead.email}
          </a>
        )}
        {displayLead.phone && (
          <a
            href={`https://wa.me/${displayLead.phone.replace(/[^0-9]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md hover:bg-green-50 transition-colors text-green-700 border border-green-500/20"
          >
            <MessageCircle className="h-3 w-3" />
            WhatsApp
          </a>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-7 text-xs gap-1"
          onClick={() => navigate(`/leads/${lead.id}`)}
        >
          <ExternalLink className="h-3 w-3" />
          Full page
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
          <TabsList className="mx-4 mt-3 mb-0 grid grid-cols-2 shrink-0">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="activity">
              Activity
              {activities.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                  {activities.length > 99 ? '99+' : activities.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex-1 overflow-y-auto px-4 py-3 mt-0 min-h-0">
            {loadingLead ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <div className="space-y-3">
                <InfoRow label="Company" value={displayLead.company_name} />
                {displayLead.email && <InfoRow label="Email" value={displayLead.email} href={`mailto:${displayLead.email}`} />}
                {displayLead.phone && <InfoRow label="Phone" value={displayLead.phone} href={`tel:${displayLead.phone}`} />}
                {(displayLead as any).website && (
                  <InfoRow label="Website" value={(displayLead as any).website} href={(displayLead as any).website} external />
                )}
                {displayLead.country && (
                  <InfoRow label="Country" value={`${displayLead.country.name} (${displayLead.country.code})`} />
                )}
                {(displayLead as any).contact_designation && (
                  <InfoRow label="Designation" value={(displayLead as any).contact_designation} />
                )}
                {Array.isArray((displayLead as any).vendor_types) && (displayLead as any).vendor_types.length > 0 && (
                  <InfoRow
                    label="Vendor Types"
                    value={(displayLead as any).vendor_types.map((t: string) => t.replace(/_/g, ' ')).join(', ')}
                  />
                )}
                {(displayLead as any).warehouse_available && (
                  <>
                    {(displayLead as any).warehouse_location && (
                      <InfoRow label="Warehouse" value={(displayLead as any).warehouse_location} />
                    )}
                    {(displayLead as any).warehouse_price && (
                      <InfoRow
                        label="Warehouse Price"
                        value={`${(displayLead as any).warehouse_currency || 'USD'} ${parseFloat((displayLead as any).warehouse_price).toFixed(2)}`}
                      />
                    )}
                  </>
                )}
                {(displayLead as any).notes && (
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm whitespace-pre-wrap">{(displayLead as any).notes}</p>
                  </div>
                )}
                <InfoRow label="Created" value={safeFormat((displayLead as any).created_at, 'PPp')} />
                <InfoRow label="Updated" value={safeFormat((displayLead as any).updated_at, 'PPp')} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="activity" className="flex-1 overflow-hidden flex flex-col min-h-0 mt-0">
            <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
              <p className="text-sm font-medium text-muted-foreground">
                {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
              </p>
              {canEdit && (
                <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setAddActivityOpen(true)}>
                  Add activity
                </Button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
              {loadingActivities ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : activities.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No activities yet. Log your first interaction above.
                </p>
              ) : (
                <div className="space-y-2">
                  {activities.map((a) => {
                    const config = activityTypeConfig[a.activity_type as keyof typeof activityTypeConfig] ?? activityTypeConfig.note;
                    const Icon = config.icon;
                    const attachments = (a.attachments ?? []) as { type: 'url' | 'file'; url: string; name?: string }[];
                    return (
                      <div key={a.id} className="flex gap-2.5 rounded-lg border bg-card p-2.5 shadow-sm hover:shadow-md transition-shadow group">
                        <div
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                            config.color
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  {config.label}
                                </span>
                              </div>
                              <p className="text-xs text-foreground leading-relaxed">{a.description}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {a.profile?.full_name ?? 'Unknown'} · {safeFormat(a.created_at, 'MMM d, h:mm a')}
                              </p>
                              {attachments.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {attachments.map((att, i) => {
                                    let label = att.name ?? (att.type === 'file' ? 'Attachment' : 'Link');
                                    if (att.type === 'url' && !att.name) {
                                      try { label = new URL(att.url).hostname; } catch { /* keep */ }
                                    }
                                    return (
                                      <a
                                        key={i}
                                        href={att.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                                      >
                                        {att.type === 'file' ? <Paperclip className="h-3 w-3" /> : <LinkIcon className="h-3 w-3" />}
                                        {label}
                                      </a>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-70 hover:!opacity-100 hover:text-destructive transition-opacity"
                                onClick={() => handleDeleteActivity(a.id)}
                                title="Delete activity"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AddActivityDialog
        open={addActivityOpen}
        onOpenChange={setAddActivityOpen}
        leadId={lead.id}
        currentLeadScore={displayLead.lead_score ?? 0}
        onSuccess={() => {
          fetchActivities();
          fetchFullLead();
          onLeadUpdated();
        }}
        leadEmail={displayLead.email}
        leadContactName={displayLead.contact_name}
        leadCompanyName={displayLead.company_name}
        leadPhone={displayLead.phone}
        leadStatusName={displayLead.status?.name ?? null}
      />
    </div>
  );
}

function InfoRow({
  label,
  value,
  href,
  external,
}: {
  label: string;
  value: string;
  href?: string;
  external?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground w-24 shrink-0 pt-0.5">{label}</span>
      {href ? (
        <a
          href={href}
          target={external ? '_blank' : undefined}
          rel={external ? 'noopener noreferrer' : undefined}
          className="text-sm text-primary hover:underline font-medium break-all"
        >
          {value}
        </a>
      ) : (
        <span className="text-sm font-medium break-words">{value}</span>
      )}
    </div>
  );
}
