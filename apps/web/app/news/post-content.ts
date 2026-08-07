import type { ComponentType } from 'react';
import { LaFlorDominicanaCatalogPost } from './posts/la-flor-dominicana-now-in-cavaro';
import { RockyPatelCatalogPost } from './posts/rocky-patel-now-in-cavaro';

export const newsContent: Record<string, ComponentType> = {
  'rocky-patel-now-in-cavaro': RockyPatelCatalogPost,
  'la-flor-dominicana-now-in-cavaro': LaFlorDominicanaCatalogPost,
};
