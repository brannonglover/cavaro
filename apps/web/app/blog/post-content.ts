import type { ComponentType } from 'react';
import { FlavorProfilesGuidePost } from './posts/flavor-profiles-guide';
import { TastingNotesMistakesPost } from './posts/tasting-notes-mistakes';

export const postContent: Record<string, ComponentType> = {
  'cigar-101-flavor-profiles': FlavorProfilesGuidePost,
  '7-mistakes-cigar-tasting-notes': TastingNotesMistakesPost,
};
