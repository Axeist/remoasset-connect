import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'framer-motion';

vi.mock('sonner', () => {
  const fn = Object.assign(vi.fn(() => 'id1'), { success: vi.fn(() => 'id2'), error: vi.fn(() => 'id3'), dismiss: vi.fn() });
  return { toast: fn, Toaster: () => null };
});

import { CelebrationHost } from '@/components/CelebrationHost';
import { celebrate, setCelebrationMode } from '@/lib/celebrate';
import { EmptyState } from '@/components/EmptyState';
import { toast as sonner } from 'sonner';
import { toast } from '@/hooks/use-toast';

describe('motion system', () => {
  it('plays the lead-created moment and respects the celebrations setting', () => {
    setCelebrationMode('full');
    render(<LazyMotion features={domAnimation}><CelebrationHost /></LazyMotion>);
    act(() => celebrate({ kind: 'lead', title: 'Lead created', subtitle: 'Acme Devices' }));
    expect(screen.getByText('Lead created')).toBeInTheDocument();
    expect(screen.getByText('Acme Devices')).toBeInTheDocument();
  });

  it('renders an empty state with copy', () => {
    render(<EmptyState illustration="tasks" title="Nothing due" description="Enjoy the quiet." />);
    expect(screen.getByText('Nothing due')).toBeInTheDocument();
  });

  it('routes the legacy toast API through Sonner', () => {
    toast({ title: 'Lead created', description: 'ok' });
    expect(sonner.success).toHaveBeenCalled();
    toast({ title: 'Oops', variant: 'destructive' });
    expect(sonner.error).toHaveBeenCalled();
  });
});
