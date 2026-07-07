import { useEffect, useState } from 'react';
import { getCigarDisplayAssets } from '../lib/cigarImage';

/**
 * Resolves cigar imagery: user photo → catalog AI image → null (gradient fallback).
 */
export function useResolvedCigarImage(cigar) {
  const [assets, setAssets] = useState({
    imageUrl: cigar?.image?.trim() || null,
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
  }, [cigar?.id, cigar?.image, cigar?.brand, cigar?.name, cigar?.length, cigar?.wrapper]);

  return assets;
}
