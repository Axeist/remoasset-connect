/** Success moments: a short animation for things worth noticing (lead created, RFQ sent, deal won, ...). */
export type CelebrateKind = 'lead' | 'rfq' | 'won' | 'followup' | 'transfer' | 'upload' | 'request' | 'nda';
export interface CelebrateDetail {
  kind: CelebrateKind;
  title: string;
  subtitle?: string;
  /** lead: id for the "View lead" button. */
  leadId?: string;
  /** lead: small tags shown on the card (status, country, ...). */
  chips?: string[];
  /** transfer: names shown on the two avatars. */
  from?: string;
  to?: string;
}

export const CELEBRATE_EVENT = 'remoasset:celebrate';
const MODE_KEY = 'remoasset:celebrations';
export type CelebrationMode = 'full' | 'quick' | 'off';

export function getCelebrationMode(): CelebrationMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === 'full' || v === 'quick' || v === 'off') return v;
  } catch { /* ignore */ }
  return 'full';
}

export function setCelebrationMode(mode: CelebrationMode) {
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
}

export function celebrate(detail: CelebrateDetail) {
  window.dispatchEvent(new CustomEvent<CelebrateDetail>(CELEBRATE_EVENT, { detail }));
}
