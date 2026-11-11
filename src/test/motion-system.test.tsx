import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'framer-motion';
import { MemoryRouter } from 'react-router-dom';

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
    render(<MemoryRouter><LazyMotion features={domAnimation}><CelebrationHost /></LazyMotion></MemoryRouter>);
    act(() => celebrate({ kind: 'lead', title: 'Lead created', subtitle: 'Acme Devices', leadId: 'l1', chips: ['New'] }));
    expect(screen.getByLabelText('Acme Devices')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view lead/i })).toBeInTheDocument();
    act(() => celebrate({ kind: 'followup', title: 'Follow-up scheduled', subtitle: '12 Nov 2026' }));
    expect(screen.getByText('Follow-up scheduled')).toBeInTheDocument();
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

import { fireEvent } from '@testing-library/react';
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ can: () => true, signOut: vi.fn(), user: { id: 'u' } }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: () => ({ select: () => ({ ilike: () => ({ limit: () => Promise.resolve({ data: [{ id: 'l1', company_name: 'Acme Devices' }] }) }) }) }) },
}));
import { CommandPalette } from '@/components/CommandPalette';

describe('command palette', () => {
  it('opens with Ctrl+K and lists destinations', () => {
    class RO { observe() {} unobserve() {} disconnect() {} }
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = RO;
    Element.prototype.scrollIntoView = vi.fn();
    render(<MemoryRouter><CommandPalette /></MemoryRouter>);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(screen.getByPlaceholderText(/search leads/i)).toBeInTheDocument();
    expect(screen.getByText('Leads')).toBeInTheDocument();
  });
});
