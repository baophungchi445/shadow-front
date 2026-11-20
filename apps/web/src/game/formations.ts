import type { Formation } from '@shadow-front/shared-types';

export const FORMATIONS: Formation[] = ['spread', 'line', 'column', 'wedge'];

export const FORMATION_NAMES: Record<Formation, string> = {
  spread: 'Spread',
  line: 'Line',
  column: 'Column',
  wedge: 'Wedge',
};
