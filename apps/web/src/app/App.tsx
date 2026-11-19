import { useApp } from '../stores/appStore';
import { MainMenu } from '../pages/MainMenu';
import { SkirmishSetup } from '../pages/SkirmishSetup';
import { GamePage } from '../pages/GamePage';
import { ResultsPage } from '../pages/ResultsPage';
import { ArmyPage, MultiplayerPage, SettingsPage } from '../pages/InfoPages';

export function App() {
  const screen = useApp((s) => s.screen);
  const match = useApp((s) => s.match);
  switch (screen) {
    case 'menu':
      return <MainMenu />;
    case 'skirmish':
      return <SkirmishSetup />;
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
