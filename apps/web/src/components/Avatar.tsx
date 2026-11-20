import type { AvatarIcon } from '@shadow-front/game-core';
import { hex } from './Icon';

/** 24×24 glyphs (white on the badge colour). */
const GLYPHS: Record<AvatarIcon, string> = {
  star: 'M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z',
  shield: 'M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z',
  chevrons: 'M4 3l8 5 8-5v4l-8 5-8-5zM4 11l8 5 8-5v4l-8 5-8-5z',
  crosshair:
    'M11 2h2v5h-2zM11 17h2v5h-2zM2 11h5v2H2zM17 11h5v2h-5zM12 7.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9zm0 2a2.5 2.5 0 100 5 2.5 2.5 0 000-5z',
  lightning: 'M13 2L4 14h7l-1 8 9-12h-7z',
  tank: 'M3 14h18v4.5H3zM6.5 9.5h9V14h-9zM15.5 10.8H22v1.6h-6.5z',
  skull:
    'M12 2a8 8 0 00-8 8c0 3 1.5 5 3 6v3h2v-2h2v2h2v-2h2v2h2v-3c1.5-1 3-3 3-6a8 8 0 00-8-8zM8.5 9a2 2 0 110 4 2 2 0 010-4zm7 0a2 2 0 110 4 2 2 0 010-4z',
  eagle: 'M12 7l-2 3.5L2 7l3 5.5 5 1.2L12 19l2-5.3 5-1.2L22 7l-8 3.5z',
};

/** Player avatar: a glyph on a coloured round badge. */
export function Avatar({ icon, color, size = 40 }: { icon: AvatarIcon; color: number; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className="shrink-0"
      data-testid="avatar"
      data-icon={icon}
      aria-hidden
    >
      <circle
        cx="16"
        cy="16"
        r="15"
        fill={hex(color)}
        stroke="#e8ecef"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
      <path d={GLYPHS[icon]} transform="translate(4 4)" fill="#f2f4f5" fillRule="evenodd" />
    </svg>
  );
}
