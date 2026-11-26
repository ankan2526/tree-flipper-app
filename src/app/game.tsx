import { useLocalSearchParams } from 'expo-router';

import GameScreen from '@/screens/GameScreen';

export default function GameRoute() {
  const { levelId: routeLevelId, mode: routeMode, challengeMoves: routeChallengeMoves } = useLocalSearchParams();
  const levelId = Array.isArray(routeLevelId) ? routeLevelId[0] : routeLevelId;
  const mode = Array.isArray(routeMode) ? routeMode[0] : routeMode;
  const challengeMoves = Array.isArray(routeChallengeMoves) ? routeChallengeMoves[0] : routeChallengeMoves;

  return (
    <GameScreen
      key={`${mode ?? 'normal'}-${levelId ?? 'missing-level'}`}
      levelId={levelId}
      mode={mode}
      challengeMoves={challengeMoves}
    />
  );
}
