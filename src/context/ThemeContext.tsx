import React, { createContext, useContext, useEffect, useState } from 'react';
import { getThemeSetting, saveThemeSetting } from '@/utils/storage';

export type ThemeName = 'forest' | 'dark' | 'ocean' | 'sunset';

export interface ThemeColors {
  background: string;
  card: string;
  cardBorder: string;
  ink: string;
  muted: string;
  primary: string;
  palePrimary: string;
  accent: string;
  nodeRed: string;
  nodeBlue: string;
  treeLine: string;
  nodeBorder: string;
  lockedBg: string;
  lockedBorder: string;
  lockedText: string;
}

export const THEMES: Record<ThemeName, { name: string; colors: ThemeColors }> = {
  forest: {
    name: 'Forest (Default)',
    colors: {
      background: '#F3F7F1',
      card: '#FFFFFF',
      cardBorder: '#E0E9E1',
      ink: '#1E332D',
      muted: '#66766F',
      primary: '#3D8B63',
      palePrimary: '#E6F3E9',
      accent: '#F0B35A',
      nodeRed: '#E85D5D',
      nodeBlue: '#4C7DF0',
      treeLine: '#93A4A0',
      nodeBorder: '#FFFFFF',
      lockedBg: '#E9EFEA',
      lockedBorder: '#D2DDD5',
      lockedText: '#87968F',
    },
  },
  dark: {
    name: 'Midnight Dark',
    colors: {
      background: '#121614',
      card: '#1C221F',
      cardBorder: '#2B3530',
      ink: '#E8EFEA',
      muted: '#8B9C94',
      primary: '#4EAA7A',
      palePrimary: '#1E3328',
      accent: '#F2BE6B',
      nodeRed: '#F06B6B',
      nodeBlue: '#5D8BF7',
      treeLine: '#4A5B53',
      nodeBorder: '#1C221F',
      lockedBg: '#161B18',
      lockedBorder: '#232B27',
      lockedText: '#55665E',
    },
  },
  ocean: {
    name: 'Deep Ocean',
    colors: {
      background: '#EEF5F8',
      card: '#FFFFFF',
      cardBorder: '#D8E6ED',
      ink: '#102A38',
      muted: '#5A7382',
      primary: '#2B7FA6',
      palePrimary: '#E1F0F7',
      accent: '#F29C38',
      nodeRed: '#E25B6A',
      nodeBlue: '#3288E6',
      treeLine: '#8CA6B4',
      nodeBorder: '#FFFFFF',
      lockedBg: '#E2EBF0',
      lockedBorder: '#CAD9E2',
      lockedText: '#7B94A3',
    },
  },
  sunset: {
    name: 'Warm Sunset',
    colors: {
      background: '#FAF3EE',
      card: '#FFFFFF',
      cardBorder: '#EDE0D4',
      ink: '#38221B',
      muted: '#846D65',
      primary: '#C85C38',
      palePrimary: '#FAECE5',
      accent: '#E5A038',
      nodeRed: '#DE4D4D',
      nodeBlue: '#4668D8',
      treeLine: '#B0988E',
      nodeBorder: '#FFFFFF',
      lockedBg: '#EFE3DA',
      lockedBorder: '#DFCEBF',
      lockedText: '#9A8277',
    },
  },
};

interface ThemeContextType {
  themeName: ThemeName;
  colors: ThemeColors;
  setTheme: (name: ThemeName) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  themeName: 'forest',
  colors: THEMES.forest.colors,
  setTheme: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeName, setThemeName] = useState<ThemeName>('forest');

  useEffect(() => {
    getThemeSetting().then((saved) => {
      if (saved && saved in THEMES) {
        setThemeName(saved as ThemeName);
      }
    });
  }, []);

  const setTheme = async (name: ThemeName) => {
    setThemeName(name);
    await saveThemeSetting(name);
  };

  const colors = THEMES[themeName].colors;

  return (
    <ThemeContext.Provider value={{ themeName, colors, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  return useContext(ThemeContext);
}

