import { useLocalSearchParams } from 'expo-router';

import ChapterScreen from '@/screens/ChapterScreen';

export default function ChapterRoute() {
  const { chapterId: routeChapterId } = useLocalSearchParams();
  const chapterId = Array.isArray(routeChapterId) ? routeChapterId[0] : routeChapterId;

  return <ChapterScreen key={chapterId ?? 'missing-chapter'} chapterId={chapterId} />;
}
