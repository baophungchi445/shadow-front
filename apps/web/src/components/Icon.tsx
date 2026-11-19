import type { BuildingTypeId, UnitTypeId } from '@shadow-front/shared-types';
import { UNITS } from '@shadow-front/game-data';

/** Simple vector silhouettes (placeholder UI icons, not production art). */
const PATHS: Partial<Record<UnitTypeId | BuildingTypeId, string>> = {
  rifleman: 'M12 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm-2 5h4l1 6h-1.5l-.5 7h-2l-.5-7H9l1-6Zm5 1 6-2 .4 1-6 2Z',
  'at-soldier':
    'M11 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM9 8h4l1 6h-1.5l-.5 7h-2l-.5-7H8l1-6Zm2 1 11-3 .5 1.6-11 3Z',
  'recon-vehicle': 'M3 13h15l3 2v2H3Zm4-3h6l2 3H6Zm-2 8a2 2 0 1 0 4 0Zm11 0a2 2 0 1 0 4 0Zm-3-8h8v1h-8Z',
  apc: 'M2 11h17l3 3v3H2Zm3-3h11v3H5Zm0 10a2 2 0 1 0 4 0Zm5 0a2 2 0 1 0 4 0Zm5 0a2 2 0 1 0 4 0Z',
  'main-battle-tank': 'M2 15h20l-2 4H4Zm3-4h12l2 4H3Zm4-3h6v3H9Zm6 1h8v1.4h-8Z',
  'heavy-tank': 'M1 15h22l-2 5H3Zm3-5h15l2 5H2Zm4-3h8v3H8Zm8 0h7v1.3h-7Zm0 1.8h7v1.3h-7Z',
  'mobile-artillery': 'M2 15h19l-2 4H4Zm3-4h11l2 4H3Zm2-3h6v3H7Zm5 0 10-5 .6 1.2-10 5Z',
  'attack-helicopter': 'M2 6h20v1H2Zm9 1h2v2h-2Zm-3 2h9l3 3-2 2H9l-2-3Zm-6 1h6v1.6H2Zm9 6h5v1h-5Z',
  'recon-drone': 'M4 6h5v1.4H4Zm11 0h5v1.4h-5ZM6 7h1v3H6Zm11 0h1v3h-1ZM8 10h8l-1 4H9Zm3 4h2v2h-2Z',
  sniper:
    'M10 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4ZM8 8h4l1 6h-1.5l-.5 7h-2l-.5-7H7l1-6Zm4 1 10-3.5.4 1-10 3.5Zm6-2.6h1.5v2H18Z',
  medic:
    'M12 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm-2 5h4l1 6h-1.5l-.5 7h-2l-.5-7H9l1-6Zm6 0h2v2h2v2h-2v2h-2v-2h-2v-2h2Z',
  engineer:
    'M12 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm-2 5h4l1 6h-1.5l-.5 7h-2l-.5-7H9l1-6Zm7-1 2-2 2 2-1 1 1 4h-2l-1-4Z',
  headquarters: 'M3 21V10l9-5 9 5v11h-6v-6H9v6Zm8-19h1.5v4H11Z',
  'power-plant': 'M3 21V12h8v9Zm10 0 1-12h6l1 12ZM15 4h4v4h-4Z',
  'resource-extractor': 'M3 21v-6h10v6Zm12 0 3-14 3 14Zm-9-9 3-6 3 6Z',
  barracks: 'M2 21V11l10-6 10 6v10h-4v-5H6v5Zm16-17h1v5h-1Zm1 0h3v2h-3Z',
  'war-factory': 'M2 21V9l6 3V9l6 3V9l8 4v8Zm5-5h10v5H7Z',
  airfield: 'M2 20h20v1H2Zm2-3h16v2H4Zm4-12h3v12H8Zm-3 2h9v1.5H5Z',
  'research-center': 'M3 21v-7h18v7Zm2-7a7 7 0 0 1 14 0Z',
  'defense-turret': 'M5 21v-6h14v6Zm3-6 1-4h6l1 4Zm6-3 8-3 .5 1.3-8 3Z',
  'radar-station': 'M4 21v-5h16v5Zm7-5V9h2v7Zm-6-9a7 4 0 0 1 14 0 7 4 0 0 1-14 0Zm3 0a4 2 0 0 0 8 0Z',
  wall: 'M2 10h20v11H2Zm2 2v3h7v-3Zm9 0v3h7v-3Zm-9 5v2h4v-2Zm6 0v2h6v-2Zm8 0v2h2v-2Z',
  'missile-launcher': 'M5 21v-5h14v5Zm2-5 1-4h8l1 4Zm1-5 7-7 1.4 1.4-7 7Zm4 0 7-7 1.4 1.4-7 7Z',
  bunker: 'M2 21v-8l4-3h12l4 3v8Zm4-6v2h4v-2Zm8 0v2h4v-2ZM8 7h8v3H8Z',
  'sam-site': 'M5 21v-5h14v5Zm2-5 9-8 2 1.6-9 8Zm9-8 4-3 .8 1-4 3Z',
};

export function Icon({ id, className = '' }: { id: UnitTypeId | BuildingTypeId; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d={PATHS[id] ?? PATHS[(UNITS as Partial<typeof UNITS>)[id as UnitTypeId]?.look ?? 'rifleman']}
        fill="currentColor"
      />
    </svg>
  );
}

export function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
