import type { ComponentType } from 'react';
import { WelcomeToCavaroNewsPost } from './posts/welcome-to-cavaro-news';

export const newsContent: Record<string, ComponentType> = {
  'welcome-to-cavaro-news': WelcomeToCavaroNewsPost,
};
