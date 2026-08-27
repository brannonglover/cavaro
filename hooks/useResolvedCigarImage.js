import { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { getCigarDisplayAssets, resolveCigarImageUrl } from '../lib/cigarImage';

const STICK_ASPECT = 2.15;

/**
 * Resolves cigar imagery: user photo → brand product photo → null.
 */
export function useResolvedCigarImage(cigar) {
  const [assets, setAssets] = useState({
    imageUrl: resolveCigarImageUrl(cigar),
    wrapper: cigar?.wrapper?.trim() || null,
  });

  useEffect(() => {
    let active = true;

    getCigarDisplayAssets(cigar).then((next) => {
      if (active) setAssets(next);
    });

    return () => {
      active = false;
    };
  }, [cigar?.id, cigar?.image, cigar?.brand, cigar?.name, cigar?.line, cigar?.length, cigar?.wrapper]);

  return assets;
}

/**
 * Long landscape product photos (a cigar lying on its side) are rotated 90°.
 */
export function useCigarImagePresentation(url) {
  const [presentation, setPresentation] = useState({
    rotate90: false,
  });

  useEffect(() => {
    const candidate = url?.trim();
    if (!candidate) {
      setPresentation({ rotate90: false });
      return undefined;
    }

    setPresentation({ rotate90: false });

    let cancelled = false;
    Image.getSize(
      candidate,
      (width, height) => {
        if (cancelled) return;
        const long = Math.max(width, height);
        const short = Math.max(1, Math.min(width, height));
        const rotate90 = width > height && long / short >= STICK_ASPECT;
        setPresentation({ rotate90 });
      },
      () => {
        if (!cancelled) setPresentation({ rotate90: false });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

  return presentation;
}

export function useCigarImageResizeMode(url, fallback = 'cover') {
  return fallback;
}
