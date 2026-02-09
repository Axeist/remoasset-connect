import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getActivityScorePoints, clampLeadScore } from '@/lib/leadScore';
import { Loader2, Plus, Trash2, Link as LinkIcon, Paperclip, Mail } from 'lucide-react';

export type ActivityType = 'call' | 'email' | 'meeting' | 'note';

export interface ActivityAttachment {
  type: 'url' | 'file';
  url: string;
  name?: string;
}

const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'note', label: 'Note' },
];

const URL_REGEX = /^https?:\/\/.+/i;
const MAX_FILES = 10;
const MAX_FILE_SIZE_MB = 10;

interface AddActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  currentLeadScore: number;
  onSuccess: () => void;
  /** Lead email for mailto draft when activity type is email */
  leadEmail?: string | null;
  leadContactName?: string | null;
  leadCompanyName?: string;
}

export function AddActivityDialog({
  open,
  onOpenChange,
  leadId,
  currentLeadScore,
  onSuccess,
  leadEmail,
  leadContactName,
  leadCompanyName,
}: AddActivityDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [type, setType] = useState<ActivityType>('call');
  const [description, setDescription] = useState('');
  const [urls, setUrls] = useState<string[]>(['']);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const addUrlRow = () => setUrls((u) => [...u, '']);
  const removeUrlRow = (i: number) => setUrls((u) => u.filter((_, idx) => idx !== i));
  const setUrlAt = (i: number, v: string) =>
    setUrls((u) => {
      const next = [...u];
      next[i] = v;
      return next;
    });

  const validUrls = urls.map((u) => u.trim()).filter((u) => u && URL_REGEX.test(u));
  const hasInvalidUrl = urls.some((u) => u.trim() && !URL_REGEX.test(u.trim()));

  const canDraftEmail = type === 'email' && leadEmail?.trim();
  const mailtoUrl = canDraftEmail
    ? (() => {
        const to = encodeURIComponent(leadEmail!.trim());
        const subject = encodeURIComponent(
          leadCompanyName ? `Re: ${leadCompanyName}` : 'Follow-up'
        );
        const greeting = leadContactName?.trim()
          ? `Hi ${leadContactName.trim()},\n\n`
          : '';
        const body = encodeURIComponent(greeting);
        return `mailto:${to}?subject=${subject}&body=${body}`;
      })()
    : null;

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const allowed = selected.filter(
      (f) => f.size <= MAX_FILE_SIZE_MB * 1024 * 1024 && (f.type.startsWith('image/') || f.type === 'application/pdf')
    );
    if (allowed.length < selected.length) {
      toast({ variant: 'destructive', title: 'Some files skipped', description: `Max ${MAX_FILE_SIZE_MB}MB each; images and PDF only.` });
    }
    setFiles((prev) => [...prev, ...allowed].slice(0, MAX_FILES));
    e.target.value = '';
  };

  const removeFile = (index: number) => setFiles((f) => f.filter((_, i) => i !== index));

  const resetForm = () => {
    setType('call');
    setDescription('');
    setUrls(['']);
    setFiles([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast({ variant: 'destructive', title: 'Description required' });
      return;
    }
    if (hasInvalidUrl) {
      toast({ variant: 'destructive', title: 'Invalid URL', description: 'Please enter valid URLs (e.g. https://...).' });
      return;
    }
    if (!user) return;
    setSubmitting(true);

    const attachments: ActivityAttachment[] = [];

    // Upload files to storage
    for (const file of files) {
      const path = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { data, error } = await supabase.storage.from('activity-files').upload(path, file, { upsert: false });
      if (error) {
        toast({ variant: 'destructive', title: 'Upload failed', description: error.message });
        setSubmitting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('activity-files').getPublicUrl(data.path);
      attachments.push({ type: 'file', url: urlData.publicUrl, name: file.name });
    }

    validUrls.forEach((url) => attachments.push({ type: 'url', url }));

    const { error } = await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: type,
      description: description.trim(),
      attachments: attachments.length ? attachments : [],
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      setSubmitting(false);
      return;
    }

    const points = getActivityScorePoints(type, description.trim());
    const newScore = clampLeadScore(currentLeadScore + points);
    await supabase.from('leads').update({ lead_score: newScore }).eq('id', leadId);

    resetForm();
    setSubmitting(false);
    onOpenChange(false);
    toast({ title: 'Activity added', description: points > 0 ? `Lead score +${points} (now ${newScore})` : undefined });
    onSuccess();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add activity</DialogTitle>
          <DialogDescription>
            Log a call, email, meeting, or note. Add links (e.g. email threads) and attach screenshots or files.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type === 'email' && (
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-2">
              {canDraftEmail ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    To: <span className="font-medium text-foreground">{leadEmail}</span>
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => { window.location.href = mailtoUrl!; }}
                  >
                    <Mail className="h-4 w-4" />
                    Compose email
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Add the lead&apos;s email in the lead details to quickly compose from here.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="desc">Description *</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Had a call with customer willing to proceed..."
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <LinkIcon className="h-4 w-4" />
              Links (email threads, docs, etc.)
            </Label>
            {urls.map((url, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  type="url"
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => setUrlAt(i, e.target.value)}
                  className="flex-1"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeUrlRow(i)} disabled={urls.length <= 1}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addUrlRow} className="gap-1">
              <Plus className="h-4 w-4" />
              Add URL
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Paperclip className="h-4 w-4" />
              Attach files (screenshots, images, PDF)
            </Label>
            <div className="flex flex-wrap gap-2">
            <Input
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={onFileChange}
              className="max-w-[200px]"
            />
            {files.length > 0 && (
              <ul className="text-sm text-muted-foreground list-disc list-inside">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <span className="truncate max-w-[180px]">{f.name}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(i)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            </div>
            <p className="text-xs text-muted-foreground">Up to {MAX_FILES} files, {MAX_FILE_SIZE_MB}MB each. Images and PDF.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!description.trim() || submitting} className="gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Add activity
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
