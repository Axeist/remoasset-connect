import { useCallback, useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { cn } from '@/lib/utils';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Link as LinkIcon,
  RemoveFormatting,
  Indent,
  Outdent,
  type LucideIcon,
} from 'lucide-react';

// ─── Toolbar button ───

function TBtn({
  icon: Icon,
  active,
  disabled,
  onClick,
  title,
}: {
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'p-1.5 rounded transition-colors',
        active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        disabled && 'opacity-30 cursor-not-allowed'
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-border mx-0.5" />;
}

// ─── Color picker ───

const TEXT_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#cccccc',
  '#d32f2f', '#e65100', '#f9a825', '#2e7d32', '#1565c0',
  '#6a1b9a', '#ad1457',
];

function ColorPicker({ editor }: { editor: Editor }) {
  return (
    <div className="relative group">
      <button
        type="button"
        title="Text color"
        className="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex items-center gap-0.5"
      >
        <span className="text-xs font-bold" style={{ color: editor.getAttributes('textStyle').color || 'currentColor' }}>A</span>
        <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-50"><path d="M3 4l2 2 2-2" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>
      <div className="absolute top-full left-0 mt-1 hidden group-hover:flex flex-wrap gap-1 p-2 bg-popover border rounded-md shadow-md z-50 w-[156px]">
        {TEXT_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className="w-5 h-5 rounded-sm border border-border hover:scale-110 transition-transform"
            style={{ backgroundColor: c }}
            onClick={() => editor.chain().focus().setColor(c).run()}
          />
        ))}
        <button
          type="button"
          className="w-full mt-1 text-xs text-center text-muted-foreground hover:text-foreground"
          onClick={() => editor.chain().focus().unsetColor().run()}
        >
          Reset
        </button>
      </div>
    </div>
  );
}

// ─── Toolbar ───

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = useCallback(() => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('Enter URL', prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [editor]);

  return (
    <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 border-t bg-muted/30">
      {/* Undo / Redo */}
      <TBtn icon={Undo2} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo" />
      <TBtn icon={Redo2} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo" />

      <Divider />

      {/* Text formatting */}
      <TBtn icon={Bold} active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)" />
      <TBtn icon={Italic} active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)" />
      <TBtn icon={UnderlineIcon} active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline (Ctrl+U)" />
      <TBtn icon={Strikethrough} active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough" />

      <Divider />

      {/* Color */}
      <ColorPicker editor={editor} />

      <Divider />

      {/* Alignment */}
      <TBtn icon={AlignLeft} active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Align left" />
      <TBtn icon={AlignCenter} active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align center" />
      <TBtn icon={AlignRight} active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Align right" />

      <Divider />

      {/* Lists */}
      <TBtn icon={List} active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list" />
      <TBtn icon={ListOrdered} active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list" />
      <TBtn icon={Indent} onClick={() => editor.chain().focus().sinkListItem('listItem').run()} disabled={!editor.can().sinkListItem('listItem')} title="Indent" />
      <TBtn icon={Outdent} onClick={() => editor.chain().focus().liftListItem('listItem').run()} disabled={!editor.can().liftListItem('listItem')} title="Outdent" />

      <Divider />

      {/* Link */}
      <TBtn icon={LinkIcon} active={editor.isActive('link')} onClick={setLink} title="Insert link" />

      {/* Remove formatting */}
      <TBtn icon={RemoveFormatting} onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Remove formatting" />
    </div>
  );
}

// ─── Editor Component ───

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  autoFocus?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Compose email...',
  className,
  minHeight = '200px',
  autoFocus = false,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    autofocus: autoFocus,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none outline-none px-3 py-2',
          'prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5',
          'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        ),
        style: `min-height: ${minHeight}`,
      },
    },
  });

  // Sync external value changes (e.g. form reset)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && (value === '' || value === '<p></p>')) {
      editor.commands.clearContent();
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className={cn('rounded-md border bg-background overflow-hidden', className)}>
      <EditorContent editor={editor} />
      <Toolbar editor={editor} />
    </div>
  );
}

/** Extract plain text from HTML for previews / activity descriptions */
export function htmlToPlainText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').trim();
}
