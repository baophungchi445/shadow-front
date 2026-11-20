import { useEffect, useMemo } from 'react';
import type { MatchConfig } from '@shadow-front/shared-types';
import { GameController } from '../game/GameController';
import { PhaserGame } from '../game/PhaserGame';
import { snapshotHud } from '../game/hudModel';
import { useApp } from '../stores/appStore';
import { keyLabel } from '../game/keybinds';
import { useHud } from '../stores/hudStore';
import { TopBar } from '../components/hud/TopBar';
import { Minimap } from '../components/hud/Minimap';
import { BuildPanel, CommandPanel, SelectionPanel, TeamStatus } from '../components/hud/BottomPanels';
import { FullscreenButton, VolumeSlider } from './InfoPages';
import { ObjectivesPanel } from '../components/hud/ObjectivesPanel';
import { FpsCounter } from '../components/hud/FpsCounter';
import { useT } from '../i18n';

export function GamePage({ match }: { match: MatchConfig }) {
  const controller = useMemo(() => new GameController(match), [match]);
  const settings = useApp((s) => s.settings);
  const tr = useT();
  const finishMatch = useApp((s) => s.finishMatch);
  const go = useApp((s) => s.go);
  const { hud, toasts, menuOpen, setHud, pushToast, setMenuOpen, reset } = useHud();

  useEffect(() => {
    reset();
    const offMsg = controller.events.on('message', (m) => pushToast(m));
    const offOver = controller.events.on('gameOver', (r) => {
      // Let the final explosions play before switching screens.
      setTimeout(() => finishMatch(r), 2500);
      pushToast({ text: r.victory ? 'VICTORY' : 'DEFEAT', tone: r.victory ? 'info' : 'alert' });
    });
    const timer = setInterval(() => setHud(snapshotHud(controller)), 100);
    // Development-only hook for automated browser smoke tests.
    if (import.meta.env.DEV) (window as unknown as { __sf?: GameController }).__sf = controller;
    setHud(snapshotHud(controller));
    pushToast({
      text:
        controller.config.campaignMission && controller.config.mission !== 'tutorial'
          ? `Mission: ${controller.objectivesTitle}. Objectives are on the left.`
          : controller.config.mission === 'survival'
            ? `Hold out against ${controller.config.survival?.waves ?? 10} enemy waves. The first wave arrives in 3 minutes.`
            : controller.config.mission === 'tutorial'
              ? 'Welcome, Commander. Follow the objectives on the left.'
              : 'Commander, establish your base. Build a Power Plant first.',
      tone: 'info',
    });
    return () => {
      clearInterval(timer);
      offMsg();
      offOver();
      controller.destroy();
    };
  }, [controller, finishMatch, pushToast, reset, setHud]);

  useEffect(() => {
    controller.sfx.setVolume(settings.volume);
  }, [controller, settings.volume]);

  useEffect(() => {
    controller.formation = settings.formation;
    controller.onFormation = (f) => useApp.getState().updateSettings({ formation: f });
    return () => {
      controller.onFormation = null;
    };
  }, [controller, settings.formation]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'F10' || e.code === useApp.getState().settings.keybinds.pause) {
        e.preventDefault();
        const open = !useHud.getState().menuOpen;
        controller.paused = open;
        setMenuOpen(open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [controller, setMenuOpen]);

  const openMenu = (open: boolean) => {
    controller.paused = open;
    setMenuOpen(open);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-graphite-950">
      <PhaserGame controller={controller} settings={settings} />
      {settings.showFps && <FpsCounter />}

      {hud && (
        <div className="pointer-events-none absolute inset-0">
          <TopBar hud={hud} onMenu={() => openMenu(true)} onSpeed={(s) => controller.setSpeed(s)} />

          {hud.objectives && (
            <div className="absolute left-2 top-14">
              <ObjectivesPanel objectives={hud.objectives} />
            </div>
          )}

          <div className="pointer-events-none absolute right-2 top-14 flex flex-col items-end gap-2">
            <div className="panel pointer-events-auto p-2">
              <div className="panel-title mb-1 flex justify-between">
                <span>{hud.mapName}</span>
                <span className="text-gray-500">
                  {hud.army.units}u · {hud.army.buildings}b
                </span>
              </div>
              <Minimap controller={controller} />
              <TeamStatus hud={hud} controller={controller} />
            </div>
          </div>

          <div className="absolute left-1/2 top-16 flex -translate-x-1/2 flex-col items-center gap-1.5">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`toast-in rounded border px-3 py-1 font-display text-sm font-semibold tracking-wide shadow-lg ${
                  t.tone === 'alert'
                    ? 'border-alert-500/70 bg-alert-500/20 text-red-200'
                    : t.tone === 'warn'
                      ? 'border-warn-500/60 bg-graphite-900/90 text-warn-400'
                      : 'border-mil-600/60 bg-graphite-900/90 text-mil-300'
                }`}
              >
                {tr.msg(t.text)}
              </div>
            ))}
          </div>

          <div className="absolute inset-x-2 bottom-2 flex h-[168px] gap-2">
            <SelectionPanel sel={hud.selection} controller={controller} />
            <CommandPanel sel={hud.selection} controller={controller} mode={hud.commandMode} />
            <BuildPanel build={hud.build} controller={controller} placing={hud.placing} />
          </div>
        </div>
      )}

      {menuOpen && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
          <div className="panel w-80 p-5">
            <div className="mb-1 font-display text-2xl font-bold tracking-widest text-gray-100">{tr('PAUSED')}</div>
            <div className="mb-4 text-xs text-gray-400">
              {tr('Simulation is paused. Press {key} / F10 to resume.', { key: keyLabel(settings.keybinds.pause) })}
            </div>
            <div className="mb-4 text-sm">
              <VolumeSlider />
            </div>
            <div className="flex flex-col gap-2">
              <button className="btn btn-primary" onClick={() => openMenu(false)}>
                {tr('Resume')}
              </button>
              <FullscreenButton />
              <button
                className="btn"
                onClick={() => {
                  openMenu(false);
                  controller.surrender();
                }}
              >
                {tr('Surrender')}
              </button>
              <button className="btn" onClick={() => go('menu')}>
                {tr('Quit to main menu')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
