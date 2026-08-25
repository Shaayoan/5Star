import type Anthropic from '@anthropic-ai/sdk';
import type { StarRating } from '../types';

/**
 * The chat never writes to the database. It *proposes*, the user confirms, and
 * only then do the ordinary server actions run. Every tool here therefore
 * returns a proposal, not an effect — see docs/FORMULAS.md §12.
 */

export const CHAT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'propose_rating',
    description:
      'Propose a star rating for one pillar, based on what the user actually described. ' +
      'Only call this when the user has said something concrete about that pillar. ' +
      'Never guess to fill in a blank — use skip_pillar instead.',
    input_schema: {
      type: 'object',
      properties: {
        pillar_id: { type: 'string', description: 'The id of the pillar being rated.' },
        stars: {
          type: 'integer',
          minimum: 1,
          maximum: 5,
          description:
            '1 rough, 2 below par, 3 solid, 4 strong, 5 exceptional — judged against ' +
            "this user's own written definition of a good day for this pillar.",
        },
        evidence: {
          type: 'string',
          description:
            'The specific thing the user said that justifies this rating. Quote or ' +
            'closely paraphrase them. Required for every rating of 4 or 5.',
        },
        note: {
          type: 'string',
          description:
            "A one-sentence summary of the day for this pillar, written in the user's " +
            'own voice and saved alongside the rating. Keep it under 200 characters.',
        },
      },
      required: ['pillar_id', 'stars', 'evidence'],
    },
  },
  {
    name: 'propose_action',
    description:
      'Mark one of the pillar\'s quick-log actions as done, when the user clearly did it.',
    input_schema: {
      type: 'object',
      properties: {
        action_id: { type: 'string', description: 'The id of the micro-action.' },
      },
      required: ['action_id'],
    },
  },
  {
    name: 'skip_pillar',
    description:
      'Record that there is not enough information to rate a pillar. Unlogged and ' +
      'mediocre mean different things in this app, so leaving a pillar unrated is a ' +
      'valid and often correct outcome.',
    input_schema: {
      type: 'object',
      properties: {
        pillar_id: { type: 'string' },
        reason: { type: 'string', description: 'Why it cannot be rated yet.' },
      },
      required: ['pillar_id'],
    },
  },
];

/* ------------------------------------------------------------- proposals -- */

export interface RatingProposal {
  kind: 'rating';
  pillarId: string;
  stars: StarRating;
  evidence: string;
  note?: string;
}

export interface ActionProposal {
  kind: 'action';
  actionId: string;
}

export interface SkipProposal {
  kind: 'skip';
  pillarId: string;
  reason?: string;
}

export type Proposal = RatingProposal | ActionProposal | SkipProposal;

/** Narrow a tool call into a proposal, discarding anything malformed rather than
 *  trusting the model's shape. */
export function toProposal(name: string, input: unknown): Proposal | null {
  const obj = (input ?? {}) as Record<string, unknown>;

  if (name === 'propose_rating') {
    const stars = Number(obj.pillar_id ? obj.stars : NaN);
    if (!obj.pillar_id || !Number.isInteger(stars) || stars < 1 || stars > 5) return null;
    return {
      kind: 'rating',
      pillarId: String(obj.pillar_id),
      stars: stars as StarRating,
      evidence: String(obj.evidence ?? ''),
      note: obj.note ? String(obj.note).slice(0, 200) : undefined,
    };
  }

  if (name === 'propose_action') {
    if (!obj.action_id) return null;
    return { kind: 'action', actionId: String(obj.action_id) };
  }

  if (name === 'skip_pillar') {
    if (!obj.pillar_id) return null;
    return {
      kind: 'skip',
      pillarId: String(obj.pillar_id),
      reason: obj.reason ? String(obj.reason) : undefined,
    };
  }

  return null;
}
