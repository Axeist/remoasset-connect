/** Success moments: a short full-screen animation for big wins (lead created, RFQ sent, deal won). */
export type CelebrateKind = 'lead' | 'rfq' | 'won';
export interface CelebrateDetail {
  kind: CelebrateKind;
  title: string;
  subtitle?: string;
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
