import { describe, it, expect } from 'vitest';
import { evaluateLeadSla, followupIntentForStatus, formatSlaPreview } from '@/lib/leadSla';

const now = new Date('2026-08-17T12:00:00.000Z');

describe('evaluateLeadSla', () => {
  it('breaches Contacted idle after 5 days without activity', () => {
    const r = evaluateLeadSla(
      {
        created_at: '2026-08-01T00:00:00.000Z',
        last_activity_at: '2026-08-10T00:00:00.000Z',
        status_changed_at: '2026-08-10T00:00:00.000Z',
        status: { name: 'Contacted', sla_idle_days: 5, sla_stage_days: 10 },
      },
      now
    );
    expect(r.idleBreached).toBe(true);
    expect(r.breached).toBe(true);
    expect(r.badge).toMatch(/Idle/);
  });

  it('does not highlight Won', () => {
    const r = evaluateLeadSla(
      {
        created_at: '2026-01-01T00:00:00.000Z',
        last_activity_at: '2026-01-02T00:00:00.000Z',
        status: { name: 'Won', sla_idle_days: 2, sla_stage_days: 2 },
      },
      now
    );
    expect(r.breached).toBe(false);
    expect(r.isTerminal).toBe(true);
  });

  it('marks approaching at 80% of SLA', () => {
    const r = evaluateLeadSla(
      {
        created_at: '2026-08-01T00:00:00.000Z',
        last_activity_at: '2026-08-13T12:00:00.000Z',
        status_changed_at: '2026-08-16T00:00:00.000Z',
        status: { name: 'Contacted', sla_idle_days: 5, sla_stage_days: 10 },
      },
      now
    );
    expect(r.idleDays).toBe(4);
    expect(r.idleBreached).toBe(false);
    expect(r.approaching).toBe(true);
  });
});

describe('followupIntentForStatus', () => {
  it('uses proposal playbook by default', () => {
    expect(followupIntentForStatus({ name: 'Proposal' })).toMatch(/NDA or contract/i);
  });
});

describe('formatSlaPreview', () => {
  it('renders idle and stage', () => {
    expect(formatSlaPreview(5, 10)).toBe('Idle 5d · Stage 10d');
    expect(formatSlaPreview(null, null)).toBe('No SLA');
  });
});
