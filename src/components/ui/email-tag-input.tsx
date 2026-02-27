import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailTagInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Gmail-style email tag input.
 * Stores value as a comma-separated string for API compatibility.
 * Displays confirmed emails as removable tags; the current input
 * is committed on Enter, Tab, comma, or blur.
 */
export function EmailTagInput({ value, onChange, placeholder, className }: EmailTagInputProps) {
  const tags = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const commitDraft = useCallback((raw: string) => {
    const trimmed = raw.trim().replace(/,+$/, '').trim();
    if (!trimmed) return;
    const newEmails = trimmed.split(/[,;\s]+/).map(s => s.trim()).filter(s => s && EMAIL_RE.test(s));
    if (newEmails.length === 0) return;
    const existing = new Set(tags.map(t => t.toLowerCase()));
    const unique = newEmails.filter(e => !existing.has(e.toLowerCase()));
    if (unique.length === 0) { setDraft(''); return; }
    const next = [...tags, ...unique].join(', ');
    onChange(next);
    setDraft('');
  }, [tags, onChange]);

  const removeTag = useCallback((index: number) => {
    const next = tags.filter((_, i) => i !== index);
    onChange(next.join(', '));
  }, [tags, onChange]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === ',') {
      e.preventDefault();
      commitDraft(draft);
    }
    if (e.key === 'Backspace' && !draft && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1 rounded-md border bg-background px-2 py-1 text-sm min-h-[32px] cursor-text',
        'focus-within:ring-1 focus-within:ring-ring',
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((email, i) => (
        <span
          key={`${email}-${i}`}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs max-w-[200px]"
        >
          <span className="truncate">{email}</span>
          <button
            type="button"
            className="shrink-0 rounded-full hover:bg-primary/20 p-0.5 transition-colors"
            onClick={(e) => { e.stopPropagation(); removeTag(i); }}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => commitDraft(draft)}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData('text');
          if (pasted.includes(',') || pasted.includes(';') || pasted.includes(' ')) {
            e.preventDefault();
            commitDraft(pasted);
          }
        }}
        placeholder={tags.length === 0 ? (placeholder || 'Add email addresses') : ''}
        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder:text-muted-foreground py-0.5"
      />
    </div>
  );
}
