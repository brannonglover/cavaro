import type { ComponentType } from 'react';
import { EightBrandsJoinCavaroPost } from './posts/eight-brands-join-cavaro';
import { LaFlorDominicanaCatalogPost } from './posts/la-flor-dominicana-now-in-cavaro';
import { RockyPatelCatalogPost } from './posts/rocky-patel-now-in-cavaro';

export const newsContent: Record<string, ComponentType> = {
  'eight-brands-join-cavaro': EightBrandsJoinCavaroPost,
  'rocky-patel-now-in-cavaro': RockyPatelCatalogPost,
  'la-flor-dominicana-now-in-cavaro': LaFlorDominicanaCatalogPost,
};
