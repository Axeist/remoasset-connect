import { useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Upload, Link2 } from 'lucide-react';

// Predefined avatar URLs (DiceBear Avataaars – stable, free)
const PREDEFINED_AVATARS = [
  'Ava', 'Liam', 'Emma', 'Noah', 'Olivia', 'James', 'Sophia', 'Mason', 'Isabella', 'Ethan', 'Mia', 'Lucas',
].map((seed) => ({
  id: seed,
  url: `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(seed)}&size=128`,
}));

const MAX_FILE_MB = 2;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

interface ProfileAvatarPickerProps {
  value: string;
  onChange: (url: string) => void;
  initials: string;
  onUploadStart?: () => void;
  onUploadEnd?: () => void;
  uploadError?: (message: string) => void;
  supabaseUpload: (path: string, file: File) => Promise<{ publicUrl: string } | { error: string }>;
  userId: string;
  className?: string;
  showUrlField?: boolean;
}

export function ProfileAvatarPicker({
  value,
  onChange,
  initials,
  onUploadStart,
  onUploadEnd,
  uploadError,
  supabaseUpload,
  userId,
  className,
  showUrlField = true,
}: ProfileAvatarPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isPredefined = PREDEFINED_AVATARS.some((a) => value === a.url);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      uploadError?.(`Please use JPEG, PNG, GIF, or WebP. Got: ${file.type}`);
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      uploadError?.(`Image must be under ${MAX_FILE_MB} MB`);
      return;
    }
    onUploadStart?.();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${userId}/avatar.${ext}`;
    const result = await supabaseUpload(path, file);
    onUploadEnd?.();
    if ('error' in result) {
      uploadError?.(result.error);
      return;
    }
    onChange(result.publicUrl);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex flex-col items-center gap-2">
          <Avatar className="h-20 w-20 ring-2 ring-border">
            <AvatarImage src={value || undefined} alt="Profile" />
            <AvatarFallback className="text-lg bg-primary/10 text-primary font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground">Current</span>
        </div>

        <div className="flex-1 min-w-0">
          <Label className="text-sm text-muted-foreground">Choose a predefined avatar or upload your own</Label>
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 mt-2">
            {PREDEFINED_AVATARS.map((av) => (
              <button
                key={av.id}
                type="button"
                onClick={() => onChange(av.url)}
                className={cn(
                  'relative rounded-full overflow-hidden ring-2 transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                  value === av.url
                    ? 'ring-primary ring-offset-2 ring-offset-background'
                    : 'ring-transparent hover:ring-muted-foreground/30'
                )}
              >
                <img src={av.url} alt="" className="w-full aspect-square object-cover" />
                {value === av.url && (
                  <span className="absolute inset-0 flex items-center justify-center bg-primary/20 rounded-full">
                    <span className="h-4 w-4 rounded-full bg-primary" />
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload photo
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept={ALLOWED_TYPES.join(',')}
              className="hidden"
              onChange={handleFileChange}
            />
            <span className="text-xs text-muted-foreground">JPEG, PNG, GIF or WebP, max {MAX_FILE_MB} MB</span>
          </div>
        </div>
      </div>

      {showUrlField && (
        <div className="space-y-2">
          <Label htmlFor="avatar-url" className="flex items-center gap-1.5 text-muted-foreground">
            <Link2 className="h-3.5 w-3.5" />
            Or paste an image URL
          </Label>
          <Input
            id="avatar-url"
            type="url"
            value={value && isPredefined ? '' : value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://..."
          />
        </div>
      )}
    </div>
  );
}
