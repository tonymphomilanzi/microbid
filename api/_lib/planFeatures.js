export function normalizeFeatures(features) {
  const f = features && typeof features === "object" ? features : {};

  const listingsPerMonth = Number(f.listingsPerMonth ?? 0);
  const conversationsPerMonth = Number(f.conversationsPerMonth ?? 0);

  return {
    listingsPerMonth: Number.isFinite(listingsPerMonth) ? Math.trunc(listingsPerMonth) : 0,
    conversationsPerMonth: Number.isFinite(conversationsPerMonth) ? Math.trunc(conversationsPerMonth) : 0,
  };
}

export function isUnlimited(n) {
  return typeof n === "number" && n < 0;
}