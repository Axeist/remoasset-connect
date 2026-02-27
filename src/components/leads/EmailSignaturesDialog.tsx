import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PenLine, Plus, Trash2 } from 'lucide-react';
import type { EmailSignature } from '@/hooks/useEmailSignatures';

interface EmailSignaturesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signatures: EmailSignature[];
  onAdd: (name: string, content: string) => string | void;
  onUpdate: (id: string, updates: { name?: string; content?: string }) => void;
  onRemove: (id: string) => void;
  onRefresh: () => void;
}

export function EmailSignaturesDialog({
  open,
  onOpenChange,
  signatures,
  onAdd,
  onUpdate,
  onRemove,
  onRefresh,
}: EmailSignaturesDialogProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    if (open) onRefresh();
  }, [open, onRefresh]);

  const startAdd = () => {
    setAdding(true);
    setNewName('');
    setNewContent('');
  };
  const saveAdd = () => {
    if (newName.trim() || newContent.trim()) {
      onAdd(newName.trim() || 'Signature', newContent.trim());
      setAdding(false);
    }
  };
  const startEdit = (sig: EmailSignature) => {
    setEditingId(sig.id);
    setEditName(sig.name);
    setEditContent(sig.content);
  };
  const saveEdit = () => {
    if (editingId) {
      onUpdate(editingId, { name: editName, content: editContent });
      setEditingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" />
            Email signatures
          </DialogTitle>
          <DialogDescription>
            Add or edit signatures to insert when composing emails. Stored locally in your browser.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {signatures.map((sig) => (
            <div key={sig.id} className="rounded-lg border p-3 space-y-2">
              {editingId === sig.id ? (
                <>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Signature name"
                    className="h-9"
                  />
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Signature content (plain or HTML)"
                    rows={3}
                    className="resize-none text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{sig.name}</span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => startEdit(sig)}>Edit</Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => onRemove(sig.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{sig.content.replace(/<[^>]+>/g, ' ') || '—'}</p>
                </>
              )}
            </div>
          ))}

          {adding && (
            <div className="rounded-lg border border-dashed p-3 space-y-2">
              <Label>New signature</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Work, Personal"
                className="h-9"
              />
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Best regards,&#10;Your Name"
                rows={3}
                className="resize-none text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveAdd}>Add</Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {!adding && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={startAdd}>
              <Plus className="h-4 w-4" />
              Add signature
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
