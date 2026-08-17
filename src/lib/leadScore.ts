/**
 * Points added to lead_score when an activity is logged.
 * Higher-engagement activities (outbound call, client reply, meeting) get more points.
 */

export type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'whatsapp' | 'nda' | 'linkedin' | 'quotation';

const BASE_POINTS: Record<ActivityType, number> = {
  call: 6,       // outbound call done
  email: 3,      // email sent / received
  meeting: 10,   // meeting held
  note: 1,       // general note
  whatsapp: 5,   // WhatsApp message / conversation
  nda: 8,        // NDA sent or received
  linkedin: 4,   // LinkedIn outreach
  quotation: 7,  // quotation received from vendor/warehouse
};

/** Bonus when description suggests client replied / positive response */
const CLIENT_REPLY_BONUS = 8;
const CLIENT_REPLY_KEYWORDS = /replied|reply|responded|response|interested|confirmed|agreed|scheduled|booked/i;

/**
 * Returns the number of points to add to lead_score for this activity.
 * Used when a new lead_activity is created.
 */
export function getActivityScorePoints(
  activityType: ActivityType,
  description: string
): number {
  const base = BASE_POINTS[activityType] ?? 1;
  if (activityType === 'email' && CLIENT_REPLY_KEYWORDS.test(description)) {
    return base + CLIENT_REPLY_BONUS;
  }
  return base;
}

export const ACTIVITY_SCORE_MAX = 100;
export const ACTIVITY_SCORE_MIN = 0;

export function clampLeadScore(score: number): number {
  return Math.max(ACTIVITY_SCORE_MIN, Math.min(ACTIVITY_SCORE_MAX, Math.round(score)));
}

export interface ScoreWhyLine {
  type: string;
  count: number;
  points: number;
}

/** Reconstruct score mix from logged activities (capped at 100). */
export function explainLeadScore(
  activities: { activity_type: string; description?: string | null }[],
): { lines: ScoreWhyLine[]; rawTotal: number; capped: number; summary: string } {
  const byType = new Map<string, { count: number; points: number }>();
  let rawTotal = 0;
  for (const a of activities) {
    const type = (a.activity_type as ActivityType) in BASE_POINTS ? (a.activity_type as ActivityType) : 'note';
    const pts = getActivityScorePoints(type, a.description ?? '');
    rawTotal += pts;
    const prev = byType.get(type) ?? { count: 0, points: 0 };
    prev.count += 1;
    prev.points += pts;
    byType.set(type, prev);
  }
  const lines = [...byType.entries()]
    .map(([type, v]) => ({ type, count: v.count, points: v.points }))
    .sort((a, b) => b.points - a.points);
  const capped = clampLeadScore(rawTotal);
  const top = lines.slice(0, 3).map((l) => `${l.count} ${l.type}${l.count === 1 ? '' : 's'} (+${l.points})`);
  const summary = lines.length
    ? `${capped}/100 from ${activities.length} logged ${activities.length === 1 ? 'activity' : 'activities'}${top.length ? `: ${top.join(', ')}` : ''}.`
    : 'No logged activities yet — score stays at the starting value.';
  return { lines, rawTotal, capped, summary };
}
