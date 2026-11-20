export type GraphicsQuality = 'low' | 'medium' | 'high';

export const GRAPHICS_QUALITIES: GraphicsQuality[] = ['low', 'medium', 'high'];

/** What each graphics quality level draws. */
export const QUALITY: Record<
  GraphicsQuality,
  {
    label: string;
    /** Max live particles. */
    particles: number;
    /** Keep 1 of every N optional particles (smoke, debris); 1 = all. */
    keepEvery: number;
    /** Scorch marks: none / buildings only / buildings and big vehicles. */
    scorch: 'none' | 'buildings' | 'all';
    antialias: boolean;
  }
> = {
  low: { label: 'Low', particles: 350, keepEvery: 3, scorch: 'none', antialias: false },
  medium: { label: 'Medium', particles: 800, keepEvery: 2, scorch: 'buildings', antialias: true },
  high: { label: 'High', particles: 1400, keepEvery: 1, scorch: 'all', antialias: true },
};
