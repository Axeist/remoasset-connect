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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const DOCUMENT_TYPE_OPTIONS = [
  { value: 'nda', label: 'NDA' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'custom', label: 'Custom' },
] as const;

interface UploadDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  onSuccess: () => void;
}

export function UploadDocumentDialog({
  open,
  onOpenChange,
  leadId,
  onSuccess,
}: UploadDocumentDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [docType, setDocType] = useState<'nda' | 'pricing' | 'custom'>('nda');
  const [customName, setCustomName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const resetForm = () => {
    setDocType('nda');
    setCustomName('');
    setFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !user) return;
    if (docType === 'custom' && !customName.trim()) {
      toast({ variant: 'destructive', title: 'Name required', description: 'Enter a name for the custom document.' });
      return;
    }
    setUploading(true);
    const ext = file.name.split('.').pop() ?? '';
    const path = `${leadId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('lead-documents').upload(path, file, { upsert: false });
    if (uploadError) {
      toast({ variant: 'destructive', title: 'Upload failed', description: uploadError.message });
      setUploading(false);
      return;
    }
    const { error: insertError } = await supabase.from('lead_documents').insert({
      lead_id: leadId,
      document_type: docType,
      custom_name: docType === 'custom' ? customName.trim() : null,
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      uploaded_by: user.id,
    });
    setUploading(false);
    if (insertError) {
      toast({ variant: 'destructive', title: 'Error', description: insertError.message });
      return;
    }
    toast({ title: 'Document uploaded' });
    resetForm();
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>Add an NDA, Pricing, or custom document for this lead.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doc-type">Document type</Label>
            <select
              id="doc-type"
              value={docType}
              onChange={(e) => setDocType(e.target.value as 'nda' | 'pricing' | 'custom')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {docType === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="doc-custom-name">Document name</Label>
              <Input
                id="doc-custom-name"
                type="text"
                placeholder="e.g. Contract draft"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="h-10"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="doc-file">File</Label>
            <Input
              id="doc-file"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="h-10 file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-primary-foreground"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!file || uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
