import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    role: 'admin',
    user: { id: 'u1', email: 'a@remoasset.com' },
    signOut: vi.fn(),
    isAdmin: true,
    can: () => true,
  }),
}));
vi.mock('@/hooks/useCurrentUserProfile', () => ({
  useCurrentUserProfile: () => ({ fullName: 'Asha Rao', designation: 'Procurement', avatarUrl: null }),
}));
vi.mock('@/hooks/useDeveloperMode', () => ({ useDeveloperMode: () => false }));

import { AppSidebar, MobileTabBar } from '@/components/layout/AppSidebar';

describe('AppSidebar', () => {
  it('renders the rail, pins on click, and marks the active route', () => {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
    render(
      <MemoryRouter initialEntries={['/leads']}>
        <AppSidebar />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /pin sidebar open/i })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /pin sidebar open/i })[0]);
    expect(screen.getByText('Leads')).toBeInTheDocument();
    expect(document.querySelector('[data-nav-active="true"]')).not.toBeNull();
  });

  it('renders the phone tab bar with More', () => {
    const onMore = vi.fn();
    render(
      <MemoryRouter initialEntries={['/tasks']}>
        <MobileTabBar onMore={onMore} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /tasks/i })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    expect(onMore).toHaveBeenCalled();
  });
});
