import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { BattleScene, type SceneSettings } from './scenes/BattleScene';
import type { GameController } from './GameController';

interface Props {
  controller: GameController;
  settings: SceneSettings;
}

/**
 * Mounts exactly one Phaser.Game for the given controller and destroys it on unmount.
 * Re-renders of the parent never recreate the game (the only dependency is the controller).
 */
export function PhaserGame({ controller, settings }: Props) {
  const host = useRef<HTMLDivElement>(null);
  // Stable object shared with the scene; mutated in place when settings change.
  const live = useRef<SceneSettings>({ ...settings });

  useEffect(() => {
    Object.assign(live.current, settings);
  }, [settings]);

  useEffect(() => {
    if (!host.current) return;
    const shared = live.current;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: host.current,
      backgroundColor: '#0b0e11',
      scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
      render: { antialias: true, powerPreference: 'high-performance' },
      input: { mouse: { preventDefaultWheel: true } },
      callbacks: {
        preBoot: (g) => {
          g.registry.set('controller', controller);
          g.registry.set('settings', shared);
        },
      },
      scene: [BattleScene],
    });
    return () => {
      game.destroy(true);
    };
  }, [controller]);

  return <div ref={host} className="absolute inset-0" />;
}
