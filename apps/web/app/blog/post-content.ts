import type { ComponentType } from 'react';
import { FlavorProfilesGuidePost } from './posts/flavor-profiles-guide';
import { LancerosGuidePost } from './posts/lanceros-guide';
import { TastingNotesMistakesPost } from './posts/tasting-notes-mistakes';

export const postContent: Record<string, ComponentType> = {
  'why-everyone-is-talking-about-lanceros': LancerosGuidePost,
  'cigar-101-flavor-profiles': FlavorProfilesGuidePost,
  '7-mistakes-cigar-tasting-notes': TastingNotesMistakesPost,
};
