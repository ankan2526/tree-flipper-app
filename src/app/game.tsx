import { useLocalSearchParams } from 'expo-router';

import GameScreen from '@/screens/GameScreen';

export default function GameRoute() {
  const { levelId: routeLevelId } = useLocalSearchParams();
  const levelId = Array.isArray(routeLevelId) ? routeLevelId[0] : routeLevelId;

  return <GameScreen key={levelId ?? 'missing-level'} levelId={levelId} />;
}
