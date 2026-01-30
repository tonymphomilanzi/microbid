const BASE_BPS = 800;
const MIN_BPS = 350;
const MAX_BPS = 800;

const MIN_FEE_YT_TG_CENTS = 300;
const MIN_FEE_OTHER_CENTS = 800;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function minFeeForPlatformCents(platform) {
  const p = String(platform || "").toLowerCase();
  if (p === "youtube" || p === "telegram") return MIN_FEE_YT_TG_CENTS;
  return MIN_FEE_OTHER_CENTS;
}

export function computeServiceFee({
  priceCents,
  platform,
  buyerTier = "FREE",
  sellerTier = "FREE",
  buyerCompletedDeals = 0,
  sellerCompletedDeals = 0,
}) {
  const discounts = [];
  let discountBps = 0;

  if (priceCents > 70000) {
    discountBps += 200;
    discounts.push({ code: "OVER_700", bps: 200 });
  }

  if (sellerTier === "PRO") {
    discountBps += 100;
    discounts.push({ code: "SELLER_PRO", bps: 100 });
  }
  if (sellerTier === "VIP") {
    discountBps += 150;
    discounts.push({ code: "SELLER_VIP", bps: 150 });
  }

  if (buyerTier === "PRO") {
    discountBps += 150;
    discounts.push({ code: "BUYER_PRO", bps: 150 });
  }
  if (buyerTier === "VIP") {
    discountBps += 200;
    discounts.push({ code: "BUYER_VIP", bps: 200 });
  }

  // Repeat discount: per-user (regardless of counterparty)
  if (buyerCompletedDeals >= 3) {
    discountBps += 50;
    discounts.push({ code: "BUYER_3_PLUS_DEALS", bps: 50 });
  }
  if (sellerCompletedDeals >= 3) {
    discountBps += 50;
    discounts.push({ code: "SELLER_3_PLUS_DEALS", bps: 50 });
  }

  const minFeeCents = minFeeForPlatformCents(platform);

  const feeBps = clamp(BASE_BPS - discountBps, MIN_BPS, MAX_BPS);

  const rawFeeCents = Math.round((priceCents * feeBps) / 10000);
  const feeCents = Math.max(minFeeCents, rawFeeCents);

  return {
    feeBps,
    feePercent: feeBps / 100,
    feeCents,
    minFeeCents,
    discounts,
  };
}