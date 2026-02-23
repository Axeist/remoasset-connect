/**
 * Points added to lead_score when an activity is logged.
 * Higher-engagement activities (outbound call, client reply, meeting) get more points.
 */

export type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'whatsapp' | 'nda';

const BASE_POINTS: Record<ActivityType, number> = {
  call: 6,      // outbound call done
  email: 3,     // email sent / received
  meeting: 10,  // meeting held
  note: 1,      // general note
  whatsapp: 5,  // WhatsApp message / conversation
  nda: 8,       // NDA sent or received
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
