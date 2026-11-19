import { useEffect, useState } from 'react';

/** Frames rendered per second, measured with requestAnimationFrame (updated twice a second). */
export function FpsCounter() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      frames++;
      if (t - last >= 500) {
        setFps(Math.round((frames * 1000) / (t - last)));
        frames = 0;
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div
      className="pointer-events-none absolute bottom-[180px] right-2 rounded bg-black/60 px-2 py-0.5 font-mono text-xs text-mil-300"
      data-testid="fps"
    >
      {fps} FPS
    </div>
  );
}
