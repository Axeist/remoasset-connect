import { useState, useRef, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AIAgentSettings } from '@/components/settings/AIAgentSettings';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import {
  Send, Bot, User, Loader2, ExternalLink, CheckCircle2,
  XCircle, Sparkles, Settings2, Play, RefreshCw, DollarSign, Zap, BarChart3,
  TrendingUp, Plus, Trash2, History, ChevronLeft, Clock,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  progress?: ProgressStep[];
  result?: DiscoveryResult | null;
  timestamp: Date;
}

interface ProgressStep {
  step: string;
  icon: string;
  done: boolean;
}

interface DiscoveryResult {
  leads_created: number;
  emails_sent: number;
  skipped: number;
  region?: string;
  vendor_types?: string[];
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  leads_created: number;
  emails_sent: number;
  last_message_at: string;
  created_at: string;
}

const SUGGESTED_PROMPTS = [
  { text: 'Find 10 refurbished device vendors in Southeast Asia', icon: '♻️' },
  { text: 'Discover 5 laptop rental companies in the US', icon: '💻' },
  { text: 'Search for warehouse partners in Germany', icon: '🏭' },
  { text: 'Find new IT hardware distributors in Australia', icon: '📦' },
  { text: 'Show me vendor agent status', icon: '📊' },
];

function formatRelativeTime(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function parseMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-muted px-1 rounded text-xs">$1</code>')
    .replace(/\n/g, '<br/>');
}

function ResultCard({ result, onViewLeads }: { result: DiscoveryResult; onViewLeads: () => void }) {
  return (
    <Card className="mt-3 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="font-semibold text-sm text-green-700 dark:text-green-400">Discovery Complete</span>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{result.leads_created}</div>
            <div className="text-xs text-muted-foreground">Leads Created</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">{result.emails_sent}</div>
            <div className="text-xs text-muted-foreground">Emails Sent</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-muted-foreground">{result.skipped}</div>
            <div className="text-xs text-muted-foreground">Skipped (dup)</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {result.region && <Badge variant="secondary">{result.region}</Badge>}
          {result.vendor_types?.map((t) => (
            <Badge key={t} variant="outline" className="text-xs">{t.replace('_', ' ')}</Badge>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={onViewLeads} className="w-full">
          <ExternalLink className="h-3.5 w-3.5 mr-2" />
          View Leads
        </Button>
      </CardContent>
    </Card>
  );
}

function AssistantMessage({ message, onViewLeads }: { message: ChatMessage; onViewLeads: () => void }) {
  return (
    <div className="flex gap-3 max-w-[85%]">
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1">
        <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
          {message.progress && message.progress.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {message.progress.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{p.icon}</span>
                  <span className={cn(p.done ? 'line-through opacity-50' : '')}>{p.step}</span>
                  {p.done && <CheckCircle2 className="h-3 w-3 text-green-500 ml-auto" />}
                </div>
              ))}
            </div>
          )}
          {message.content && (
            <p
              className="text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content) }}
            />
          )}
          {!message.content && !message.progress?.length && (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Thinking...</span>
            </div>
          )}
        </div>
        {message.result && (
          <ResultCard result={message.result} onViewLeads={onViewLeads} />
        )}
        <span className="text-xs text-muted-foreground mt-1 ml-1 block">
          {formatRelativeTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex gap-3 max-w-[85%] ml-auto flex-row-reverse">
      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
        <User className="h-4 w-4 text-primary-foreground" />
      </div>
      <div>
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3">
          <p className="text-sm">{message.content}</p>
        </div>
        <span className="text-xs text-muted-foreground mt-1 mr-1 block text-right">
          {formatRelativeTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
}

export default function VendorAgent() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isAdmin = role === 'admin';

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: "Hi! I'm the **RemoAsset Vendor Discovery Agent**. I can find potential vendor partners across the globe — refurbished device suppliers, new hardware distributors, rental companies, and warehouse partners.\n\nTell me what you're looking for, or pick a suggestion below.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [runNowLoading, setRunNowLoading] = useState(false);
  const [conversation, setConversation] = useState<Array<{ role: string; content: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Session management
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savingSession, setSavingSession] = useState(false);

  // Token usage stats
  const [usageStats, setUsageStats] = useState<{
    totalCostAllTime: number;
    totalCostThisMonth: number;
    totalTokensAllTime: number;
    totalApiCalls: number;
    costByFn: Array<{ fn_name: string; total_cost_usd: number; api_calls: number; total_tokens: number }>;
    dailyBreakdown: Array<{ day: string; total_cost_usd: number; total_tokens: number; api_calls: number }>;
    emailsSentAllTime: number;
    leadsCreatedAllTime: number;
    costPerLead: number;
  } | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadUsageStats() {
    setUsageLoading(true);
    try {
      const [usageRes, logRes, logEmailRes] = await Promise.all([
        supabase.from('ai_token_usage').select('fn_name, input_tokens, output_tokens, input_cost_usd, output_cost_usd, total_cost_usd, created_at'),
        supabase.from('vendor_discovery_log').select('id', { count: 'exact', head: true }),
        supabase.from('vendor_discovery_log').select('id', { count: 'exact', head: true }).eq('email_sent', true),
      ]);

      const rows = usageRes.data || [];
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const totalCostAllTime = rows.reduce((s, r) => s + Number(r.total_cost_usd || 0), 0);
      const totalCostThisMonth = rows
        .filter((r) => new Date(r.created_at) >= monthStart)
        .reduce((s, r) => s + Number(r.total_cost_usd || 0), 0);
      const totalTokensAllTime = rows.reduce((s, r) => s + (r.input_tokens || 0) + (r.output_tokens || 0), 0);
      const totalApiCalls = rows.length;

      // Cost by function
      const fnMap: Record<string, { total_cost_usd: number; api_calls: number; total_tokens: number }> = {};
      rows.forEach((r) => {
        if (!fnMap[r.fn_name]) fnMap[r.fn_name] = { total_cost_usd: 0, api_calls: 0, total_tokens: 0 };
        fnMap[r.fn_name].total_cost_usd += Number(r.total_cost_usd || 0);
        fnMap[r.fn_name].api_calls += 1;
        fnMap[r.fn_name].total_tokens += (r.input_tokens || 0) + (r.output_tokens || 0);
      });
      const costByFn = Object.entries(fnMap).map(([fn_name, v]) => ({ fn_name, ...v }))
        .sort((a, b) => b.total_cost_usd - a.total_cost_usd);

      // Daily breakdown (last 14 days)
      const dayMap: Record<string, { total_cost_usd: number; total_tokens: number; api_calls: number }> = {};
      rows.forEach((r) => {
        const day = new Date(r.created_at).toISOString().slice(0, 10);
        if (!dayMap[day]) dayMap[day] = { total_cost_usd: 0, total_tokens: 0, api_calls: 0 };
        dayMap[day].total_cost_usd += Number(r.total_cost_usd || 0);
        dayMap[day].total_tokens += (r.input_tokens || 0) + (r.output_tokens || 0);
        dayMap[day].api_calls += 1;
      });
      const dailyBreakdown = Object.entries(dayMap)
        .map(([day, v]) => ({ day, ...v }))
        .sort((a, b) => b.day.localeCompare(a.day))
        .slice(0, 14);

      const leadsCreatedAllTime = (logRes.count as number) || 0;
      const emailsSentAllTime = (logEmailRes.count as number) || 0;
      const costPerLead = leadsCreatedAllTime > 0 ? totalCostAllTime / leadsCreatedAllTime : 0;

      setUsageStats({
        totalCostAllTime,
        totalCostThisMonth,
        totalTokensAllTime,
        totalApiCalls,
        costByFn,
        dailyBreakdown,
        emailsSentAllTime,
        leadsCreatedAllTime,
        costPerLead,
      });
    } finally {
      setUsageLoading(false);
    }
  }

  // ── Session helpers ──────────────────────────────────────

  const WELCOME_MSG: ChatMessage = {
    id: '0',
    role: 'assistant',
    content: "Hi! I'm the **RemoAsset Vendor Discovery Agent**. I can find potential vendor partners across the globe — refurbished device suppliers, new hardware distributors, rental companies, and warehouse partners.\n\nTell me what you're looking for, or pick a suggestion below.",
    timestamp: new Date(),
  };

  function serializeMessages(msgs: ChatMessage[]) {
    return msgs.map((m) => ({
      ...m,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
    }));
  }

  function deserializeMessages(msgs: any[]): ChatMessage[] {
    return msgs.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
  }

  async function saveCurrentSession(finalMessages: ChatMessage[], sessionIdOverride?: string) {
    if (!user || finalMessages.filter((m) => m.role === 'user').length === 0) return;
    setSavingSession(true);
    const sid = sessionIdOverride ?? currentSessionId;
    const firstUserMsg = finalMessages.find((m) => m.role === 'user')?.content || 'Session';
    const title = firstUserMsg.length > 60 ? firstUserMsg.slice(0, 57) + '...' : firstUserMsg;
    const totalLeads = finalMessages.reduce((s, m) => s + (m.result?.leads_created ?? 0), 0);
    const totalEmails = finalMessages.reduce((s, m) => s + (m.result?.emails_sent ?? 0), 0);

    if (sid) {
      await supabase.from('agent_chat_sessions').update({
        messages: serializeMessages(finalMessages),
        last_message_at: new Date().toISOString(),
        leads_created: totalLeads,
        emails_sent: totalEmails,
      }).eq('id', sid);
    } else {
      const { data } = await supabase.from('agent_chat_sessions').insert({
        user_id: user.id,
        title,
        messages: serializeMessages(finalMessages),
        leads_created: totalLeads,
        emails_sent: totalEmails,
        last_message_at: new Date().toISOString(),
      }).select('id').single();
      if (data?.id) setCurrentSessionId(data.id);
    }
    setSavingSession(false);
  }

  async function loadSessions() {
    setSessionsLoading(true);
    const { data } = await supabase
      .from('agent_chat_sessions')
      .select('id, title, leads_created, emails_sent, last_message_at, created_at, messages')
      .order('last_message_at', { ascending: false })
      .limit(50);
    setSessions((data || []) as ChatSession[]);
    setSessionsLoading(false);
  }

  async function openSession(session: ChatSession) {
    const msgs = deserializeMessages(session.messages as any[]);
    setMessages(msgs);
    setConversation(
      msgs
        .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content))
        .map((m) => ({ role: m.role, content: m.content }))
    );
    setCurrentSessionId(session.id);
    setHistoryOpen(false);
  }

  async function deleteSession(id: string) {
    await supabase.from('agent_chat_sessions').delete().eq('id', id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (currentSessionId === id) startNewSession();
  }

  function startNewSession() {
    setMessages([WELCOME_MSG]);
    setConversation([]);
    setCurrentSessionId(null);
    setInput('');
  }

  async function clearCurrentSession() {
    if (currentSessionId) {
      await supabase.from('agent_chat_sessions').delete().eq('id', currentSessionId);
    }
    startNewSession();
    toast({ title: 'Chat cleared', description: 'Started a new session.' });
  }

  function formatSessionDate(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return 'Today ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  async function sendMessage(text: string) {
    if (!text.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      progress: [],
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setConversation((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setIsStreaming(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/vendor-agent-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          message: text,
          conversation: conversation.slice(-6),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      let progressSteps: ProgressStep[] = [];
      let result: DiscoveryResult | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'text') {
              assistantText = assistantText
                ? assistantText + '\n' + event.content
                : event.content;
            } else if (event.type === 'progress') {
              // Mark previous steps as done
              progressSteps = progressSteps.map((s) => ({ ...s, done: true }));
              progressSteps = [...progressSteps, { step: event.step, icon: event.icon || '⚙️', done: false }];
            } else if (event.type === 'result') {
              result = event as DiscoveryResult;
              progressSteps = progressSteps.map((s) => ({ ...s, done: true }));
            } else if (event.type === 'error') {
              assistantText = `Sorry, something went wrong: ${event.message}`;
            }

            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId
                  ? { ...m, content: assistantText, progress: [...progressSteps], result }
                  : m
              )
            );
          } catch {
            // Ignore parse errors in stream
          }
        }
      }

      setConversation((prev) => [...prev, { role: 'assistant', content: assistantText }]);

      // Auto-save session to Supabase after each complete exchange
      setMessages((prev) => {
        const updated = prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: assistantText, progress: [], result }
            : m
        );
        saveCurrentSession(updated, currentSessionId ?? undefined);
        return updated;
      });
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: `Error: ${String(err)}. Please try again.` }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }

  async function handleRunNow() {
    setRunNowLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('vendor-discovery-cron');
      if (error) throw error;

      if (data?.ok) {
        toast({
          title: 'Cron run complete',
          description: `${data.total_created} leads created, ${data.total_emailed} emails sent.`,
        });
      } else {
        toast({
          title: 'Cron run skipped',
          description: data?.reason || 'Check settings.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Failed to run cron',
        description: String(err),
        variant: 'destructive',
      });
    } finally {
      setRunNowLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Admin access required.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Vendor Discovery Agent</h1>
            <p className="text-sm text-muted-foreground">AI-powered vendor sourcing — find, outreach, and track globally</p>
          </div>
        </div>

        <Tabs defaultValue="chat">
          <TabsList>
            <TabsTrigger value="chat" className="gap-2">
              <Bot className="h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="usage" className="gap-2" onClick={loadUsageStats}>
              <BarChart3 className="h-4 w-4" />
              Usage & Cost
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Automation Settings
            </TabsTrigger>
          </TabsList>

          {/* Chat Tab */}
          <TabsContent value="chat" className="mt-4">
            <div className="flex gap-3 h-[calc(100vh-260px)] min-h-[500px]">

              {/* History Sidebar */}
              {historyOpen && (
                <div className="w-64 flex-shrink-0 border rounded-xl bg-background flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2.5 border-b">
                    <span className="text-sm font-semibold flex items-center gap-1.5">
                      <History className="h-4 w-4" /> History
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setHistoryOpen(false)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {sessionsLoading && (
                      <div className="flex justify-center pt-4">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {!sessionsLoading && sessions.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center pt-4 px-2">No saved sessions yet. Start chatting!</p>
                    )}
                    {sessions.map((s) => (
                      <div
                        key={s.id}
                        className={cn(
                          'group relative rounded-lg px-2.5 py-2 cursor-pointer hover:bg-muted transition-colors',
                          currentSessionId === s.id && 'bg-muted'
                        )}
                        onClick={() => openSession(s)}
                      >
                        <p className="text-xs font-medium truncate pr-5">{s.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{formatSessionDate(s.last_message_at)}</span>
                        </div>
                        {(s.leads_created > 0 || s.emails_sent > 0) && (
                          <div className="flex gap-1 mt-1">
                            {s.leads_created > 0 && <Badge variant="secondary" className="text-xs px-1 py-0">{s.leads_created} leads</Badge>}
                            {s.emails_sent > 0 && <Badge variant="outline" className="text-xs px-1 py-0">{s.emails_sent} emails</Badge>}
                          </div>
                        )}
                        <button
                          className="absolute top-2 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="p-2 border-t">
                    <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={() => { startNewSession(); setHistoryOpen(false); }}>
                      <Plus className="h-3.5 w-3.5" />
                      New Session
                    </Button>
                  </div>
                </div>
              )}

              {/* Main chat panel */}
              <div className="flex-1 flex flex-col border rounded-xl bg-background overflow-hidden min-w-0">

                {/* Chat toolbar */}
                <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => { setHistoryOpen((o) => !o); if (!historyOpen) loadSessions(); }}
                    >
                      <History className="h-3.5 w-3.5" />
                      {historyOpen ? 'Hide History' : 'History'}
                    </Button>
                    {currentSessionId && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        {savingSession
                          ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</>
                          : <><CheckCircle2 className="h-3 w-3 text-green-500" /> Saved</>
                        }
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => { startNewSession(); }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      New
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                          Clear
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Clear this chat?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will delete the current session and all its messages. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={clearCurrentSession} className="bg-destructive hover:bg-destructive/90">
                            Clear Chat
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) =>
                  msg.role === 'user'
                    ? <UserMessage key={msg.id} message={msg} />
                    : <AssistantMessage
                        key={msg.id}
                        message={msg}
                        onViewLeads={() => navigate('/leads')}
                      />
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggested prompts — show only when no user messages yet */}
              {messages.filter((m) => m.role === 'user').length === 0 && (
                <div className="px-4 pb-3 flex flex-wrap gap-2">
                  {SUGGESTED_PROMPTS.map((p) => (
                    <button
                      key={p.text}
                      onClick={() => sendMessage(p.text)}
                      className="flex items-center gap-1.5 text-xs bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full transition-colors border border-border"
                    >
                      <span>{p.icon}</span>
                      <span>{p.text}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="border-t p-3">
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Find vendors in APAC, check status, ask anything..."
                    disabled={isStreaming}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || isStreaming}
                    size="icon"
                  >
                    {isStreaming
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Send className="h-4 w-4" />
                    }
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 px-1">
                  Vendors are AI-discovered via Google Search. Verify credentials before closing deals.
                </p>
              </div>
              </div>{/* end main chat panel */}
            </div>{/* end outer flex */}
          </TabsContent>

          {/* Usage & Cost Tab */}
          <TabsContent value="usage" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">AI Usage & Cost Tracking</h2>
                <Button variant="outline" size="sm" onClick={loadUsageStats} disabled={usageLoading}>
                  {usageLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Refresh
                </Button>
              </div>

              {usageLoading && !usageStats && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {usageStats && (
                <>
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="pt-5">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <span className="text-xs text-muted-foreground">This Month</span>
                        </div>
                        <div className="text-2xl font-bold">${usageStats.totalCostThisMonth.toFixed(4)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Claude API spend</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-5">
                        <div className="flex items-center gap-2 mb-1">
                          <TrendingUp className="h-4 w-4 text-blue-600" />
                          <span className="text-xs text-muted-foreground">All Time</span>
                        </div>
                        <div className="text-2xl font-bold">${usageStats.totalCostAllTime.toFixed(4)}</div>
                        <p className="text-xs text-muted-foreground mt-1">Total API cost</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-5">
                        <div className="flex items-center gap-2 mb-1">
                          <Zap className="h-4 w-4 text-yellow-600" />
                          <span className="text-xs text-muted-foreground">Tokens Used</span>
                        </div>
                        <div className="text-2xl font-bold">{(usageStats.totalTokensAllTime / 1000).toFixed(1)}K</div>
                        <p className="text-xs text-muted-foreground mt-1">{usageStats.totalApiCalls} API calls</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-5">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className="h-4 w-4 text-purple-600" />
                          <span className="text-xs text-muted-foreground">Cost per Lead</span>
                        </div>
                        <div className="text-2xl font-bold">${usageStats.costPerLead.toFixed(4)}</div>
                        <p className="text-xs text-muted-foreground mt-1">avg across all leads</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Discovery Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Vendor Pipeline</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Total leads created</span>
                          <span className="font-semibold">{usageStats.leadsCreatedAllTime}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Outreach emails sent</span>
                          <span className="font-semibold">{usageStats.emailsSentAllTime}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Email coverage</span>
                          <span className="font-semibold">
                            {usageStats.leadsCreatedAllTime > 0
                              ? `${Math.round((usageStats.emailsSentAllTime / usageStats.leadsCreatedAllTime) * 100)}%`
                              : '—'}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Cost by Function</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {usageStats.costByFn.length === 0 && (
                          <p className="text-sm text-muted-foreground">No data yet</p>
                        )}
                        {usageStats.costByFn.map((fn) => {
                          const label = fn.fn_name === 'vendor-discovery' ? 'Discovery'
                            : fn.fn_name === 'vendor-outreach-email' ? 'Email Drafting'
                            : fn.fn_name === 'vendor-agent-chat' ? 'Chat'
                            : fn.fn_name;
                          const pct = usageStats.totalCostAllTime > 0
                            ? (fn.total_cost_usd / usageStats.totalCostAllTime) * 100
                            : 0;
                          return (
                            <div key={fn.fn_name}>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-muted-foreground">{label}</span>
                                <span className="font-medium">${fn.total_cost_usd.toFixed(4)}</span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Daily Breakdown */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Daily Breakdown (last 14 days)</CardTitle>
                      <CardDescription>API cost and token usage per day</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {usageStats.dailyBreakdown.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No usage data yet. Run a discovery to start tracking.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Date</th>
                                <th className="text-right py-2 pr-4 font-medium text-muted-foreground">Tokens</th>
                                <th className="text-right py-2 pr-4 font-medium text-muted-foreground">API Calls</th>
                                <th className="text-right py-2 font-medium text-muted-foreground">Cost (USD)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {usageStats.dailyBreakdown.map((d) => (
                                <tr key={d.day} className="border-b last:border-0 hover:bg-muted/30">
                                  <td className="py-2 pr-4 font-mono text-xs">{d.day}</td>
                                  <td className="py-2 pr-4 text-right">{(d.total_tokens / 1000).toFixed(1)}K</td>
                                  <td className="py-2 pr-4 text-right">{d.api_calls}</td>
                                  <td className="py-2 text-right font-medium">${d.total_cost_usd.toFixed(5)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Haiku model note */}
                  <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start gap-3">
                        <Zap className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-300">Cost-efficiency note</p>
                          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                            Using <strong>claude-haiku-4-5-20251001</strong> — the most cost-efficient Claude model.
                            At $0.80/M input + $4.00/M output tokens, typical daily cron (60 vendors) costs ~$0.15–0.20/day.
                            Haiku matches Sonnet accuracy for structured data extraction and email drafting tasks.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {!usageStats && !usageLoading && (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>Click Refresh to load usage statistics</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-4">
            <AIAgentSettings onRunNow={handleRunNow} runNowLoading={runNowLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
