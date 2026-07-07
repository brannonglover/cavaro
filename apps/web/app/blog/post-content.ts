import type { ComponentType } from 'react';
import { TastingNotesMistakesPost } from './posts/tasting-notes-mistakes';

export const postContent: Record<string, ComponentType> = {
  '7-mistakes-cigar-tasting-notes': TastingNotesMistakesPost,
};
