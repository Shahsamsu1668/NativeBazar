/**
 * Utility functions for product filtering and deduplication.
 */

export function deduplicateProducts<T extends {
  id?: string;
  sellerId?: string;
  sellerName?: string;
  cropName?: string;
  banglaName?: string;
  district?: string;
  targetRole?: string;
  sellerRole?: string;
  unitPrice?: number;
  pricePerKg?: number;
}>(items: T[]): T[] {
  if (!Array.isArray(items)) return [];

  const seenIds = new Set<string>();
  const seenSignatures = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    if (item.id && seenIds.has(item.id)) continue;
    if (item.id) seenIds.add(item.id);

    const normSeller = (item.sellerName || item.sellerId || '').trim().toLowerCase();
    const normCrop = (item.cropName || item.banglaName || '').trim().toLowerCase();
    const normDistrict = (item.district || '').trim().toLowerCase();
    const normTarget = (item.targetRole || '').trim().toLowerCase();

    // Group identical lots by seller, crop, district, and target role
    const signature = normSeller && normCrop
      ? `${normSeller}::${normCrop}::${normDistrict}::${normTarget}`
      : item.id || Math.random().toString();

    if (seenSignatures.has(signature)) continue;
    seenSignatures.add(signature);
    result.push(item);
  }

  return result;
}
