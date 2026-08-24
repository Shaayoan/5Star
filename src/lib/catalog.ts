import type { PillarTemplate } from './types';

/** The bank of pillars a user picks five of. Every field is editable after
 *  selection — these are starting points, not prescriptions. */
export const PILLAR_TEMPLATES: PillarTemplate[] = [
  {
    key: 'physical',
    name: 'Physical',
    icon: '💪',
    color: '#f97316',
    tagline: 'Body, energy, sleep',
    definition: 'Moved deliberately, ate like I respect myself, slept enough.',
    suggestedActions: [
      { label: 'Workout', xp: 8 },
      { label: '10k steps', xp: 5 },
      { label: '7h+ sleep', xp: 5 },
      { label: 'No junk food', xp: 4 },
      { label: 'Stretched', xp: 3 },
    ],
  },
  {
    key: 'mental',
    name: 'Mental',
    icon: '🧠',
    color: '#8b5cf6',
    tagline: 'Clarity, calm, focus',
    definition: 'Protected my attention and did something for my head, not just my inbox.',
    suggestedActions: [
      { label: 'Meditated', xp: 6 },
      { label: 'Journaled', xp: 5 },
      { label: 'Read 20 min', xp: 5 },
      { label: 'No doomscroll', xp: 6 },
      { label: 'Deep work block', xp: 8 },
    ],
  },
  {
    key: 'relational',
    name: 'Relational',
    icon: '🫂',
    color: '#ec4899',
    tagline: 'People who matter',
    definition: 'Gave real attention to someone I care about.',
    suggestedActions: [
      { label: 'Called someone', xp: 6 },
      { label: 'Quality time', xp: 8 },
      { label: 'Reached out first', xp: 5 },
      { label: 'Phone-free meal', xp: 5 },
    ],
  },
  {
    key: 'financial',
    name: 'Financial',
    icon: '📈',
    color: '#10b981',
    tagline: 'Runway and discipline',
    definition: 'Spent intentionally and moved a number in the right direction.',
    suggestedActions: [
      { label: 'Tracked spending', xp: 5 },
      { label: 'No impulse buy', xp: 5 },
      { label: 'Saved / invested', xp: 8 },
      { label: 'Reviewed budget', xp: 6 },
    ],
  },
  {
    key: 'craft',
    name: 'Craft',
    icon: '🛠️',
    color: '#3b82f6',
    tagline: 'The work you want to be known for',
    definition: 'Advanced the thing I actually care about building.',
    suggestedActions: [
      { label: 'Shipped something', xp: 10 },
      { label: 'Focused session', xp: 8 },
      { label: 'Learned a new skill', xp: 6 },
      { label: 'Reviewed my goals', xp: 4 },
    ],
  },
  {
    key: 'purpose',
    name: 'Purpose',
    icon: '🧭',
    color: '#eab308',
    tagline: 'Meaning and direction',
    definition: 'Acted in line with what I say I believe.',
    suggestedActions: [
      { label: 'Reflection', xp: 6 },
      { label: 'Prayer / practice', xp: 6 },
      { label: 'Time in nature', xp: 5 },
      { label: 'Said no to drift', xp: 5 },
    ],
  },
  {
    key: 'environment',
    name: 'Environment',
    icon: '🏡',
    color: '#14b8a6',
    tagline: 'The space you live in',
    definition: 'Left my space better than I found it.',
    suggestedActions: [
      { label: 'Tidied', xp: 5 },
      { label: 'Cleared inbox', xp: 4 },
      { label: 'Fixed something', xp: 6 },
      { label: 'Decluttered', xp: 5 },
    ],
  },
  {
    key: 'contribution',
    name: 'Contribution',
    icon: '🤝',
    color: '#f43f5e',
    tagline: 'Value given away',
    definition: 'Made someone else’s day measurably better.',
    suggestedActions: [
      { label: 'Helped someone', xp: 7 },
      { label: 'Volunteered', xp: 10 },
      { label: 'Gave / donated', xp: 6 },
      { label: 'Taught someone', xp: 7 },
    ],
  },
  {
    key: 'learning',
    name: 'Learning',
    icon: '📚',
    color: '#6366f1',
    tagline: 'Compounding knowledge',
    definition: 'Learned something I could explain to a friend tomorrow.',
    suggestedActions: [
      { label: 'Studied 30 min', xp: 7 },
      { label: 'Finished a chapter', xp: 6 },
      { label: 'Practiced a language', xp: 6 },
      { label: 'Took notes', xp: 4 },
    ],
  },
  {
    key: 'creative',
    name: 'Creative',
    icon: '🎨',
    color: '#a855f7',
    tagline: 'Making for its own sake',
    definition: 'Made something that did not have to be useful.',
    suggestedActions: [
      { label: 'Made something', xp: 8 },
      { label: 'Practiced instrument', xp: 7 },
      { label: 'Wrote freely', xp: 6 },
      { label: 'Sketched', xp: 5 },
    ],
  },
];

export const TEMPLATES_BY_KEY = Object.fromEntries(
  PILLAR_TEMPLATES.map((t) => [t.key, t]),
) as Record<string, PillarTemplate>;

/** Palette offered when a user creates a fully custom pillar. */
export const PILLAR_COLORS = [
  '#f97316', '#8b5cf6', '#ec4899', '#10b981', '#3b82f6',
  '#eab308', '#14b8a6', '#f43f5e', '#6366f1', '#a855f7',
];

export const PILLAR_ICONS = [
  '💪', '🧠', '🫂', '📈', '🛠️', '🧭', '🏡', '🤝', '📚', '🎨',
  '🔥', '⚡', '🌱', '🎯', '⛰️', '🕊️', '🧩', '🏆', '🎧', '🍎',
];
