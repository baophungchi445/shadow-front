import { useEffect } from 'react';
import { useApp } from '../stores/appStore';
import { music } from '../game/music';
import { MainMenu } from '../pages/MainMenu';
import { SkirmishSetup } from '../pages/SkirmishSetup';
import { CampaignPage } from '../pages/CampaignPage';
import { ProfilePage } from '../pages/ProfilePage';
import { GamePage } from '../pages/GamePage';
import { ResultsPage } from '../pages/ResultsPage';
import { ArmyPage, MultiplayerPage, SettingsPage } from '../pages/InfoPages';

export function App() {
  const screen = useApp((s) => s.screen);
  const match = useApp((s) => s.match);
  const musicVolume = useApp((s) => s.settings.musicVolume);

  // Background music: unlocked by the first user gesture (autoplay policy), mood follows the screen.
  useEffect(() => {
    const unlock = () => music.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
  useEffect(() => music.setVolume(musicVolume), [musicVolume]);
  // Development-only hook for automated browser checks.
  if (import.meta.env.DEV) (window as unknown as { __music?: typeof music }).__music = music;
  useEffect(() => music.play(screen === 'game' ? 'battle' : 'menu'), [screen]);
  switch (screen) {
    case 'menu':
      return <MainMenu />;
    case 'skirmish':
      return <SkirmishSetup />;
    case 'campaign':
      return <CampaignPage />;
    case 'profile':
      return <ProfilePage />;
    case 'army':
      return <ArmyPage />;
    case 'settings':
      return <SettingsPage />;
    case 'multiplayer':
      return <MultiplayerPage />;
    case 'game':
      return match ? <GamePage key={match.seed} match={match} /> : <MainMenu />;
    case 'results':
      return <ResultsPage />;
  }
}
