/** Shared domain types. Kept free of Next/Supabase imports so a future mobile
 *  client can depend on this file directly. */

export type StarRating = 0 | 1 | 2 | 3 | 4 | 5;

/** ISO calendar date, `YYYY-MM-DD`, always in the user's local timezone. */
export type IsoDate = string;

export interface PillarTemplate {
  key: string;
  name: string;
  icon: string;
  color: string;
  tagline: string;
  definition: string;
  suggestedActions: { label: string; xp: number }[];
}

export interface Season {
  id: string;
  user_id: string;
  name: string;
  started_on: IsoDate;
  ended_on: IsoDate | null;
  is_current: boolean;
}

export interface UserPillar {
  id: string;
  user_id: string;
  season_id: string;
  slot: number;
  template_key: string | null;
  name: string;
  icon: string;
  color: string;
  definition: string;
  is_active: boolean;
  created_at: string;
}

export interface MicroAction {
  id: string;
  user_id: string;
  user_pillar_id: string;
  label: string;
  xp_value: number;
  sort_order: number;
  is_archived: boolean;
}

export interface DailyLog {
  id: string;
  user_id: string;
  user_pillar_id: string;
  log_date: IsoDate;
  stars: StarRating;
  note: string | null;
}

export interface ActionLog {
  id: string;
  user_id: string;
  micro_action_id: string;
  user_pillar_id: string;
  log_date: IsoDate;
}

export interface XpEvent {
  id: string;
  user_id: string;
  user_pillar_id: string | null;
  source: XpSource;
  amount: number;
  log_date: IsoDate;
}

export type XpSource =
  | 'daily_log'
  | 'micro_action'
  | 'five_star_day'
  | 'perfect_day'
  | 'streak_milestone'
  | 'quest'
  | 'badge';

export interface UserBadge {
  id: string;
  user_id: string;
  badge_key: string;
  earned_at: string;
}

export type QuestStatus = 'active' | 'completed' | 'expired';

export interface Quest {
  id: string;
  user_id: string;
  user_pillar_id: string | null;
  week_start: IsoDate;
  kind: 'focus' | 'balance';
  title: string;
  description: string;
  target_count: number;
  progress: number;
  status: QuestStatus;
  xp_reward: number;
}

export interface Profile {
  id: string;
  display_name: string | null;
  timezone: string;
  onboarded_at: string | null;
  freezes_available: number;
  freeze_granted_on: IsoDate | null;
}

/** One calendar day of ratings, keyed by `user_pillar.id`. */
export interface DayEntry {
  date: IsoDate;
  ratings: Record<string, StarRating>;
  notes?: Record<string, string | null>;
}

/** Everything the dashboard needs, assembled server-side. */
export interface PillarStats {
  pillar: UserPillar;
  xp: number;
  level: number;
  levelProgress: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  streak: number;
  bestStreak: number;
  avg7: number;
  avg30: number;
  trend: number;
  logCount: number;
  todayStars: StarRating;
}
