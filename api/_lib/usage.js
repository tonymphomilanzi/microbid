export async function ensureUsageRow(tx, userId, monthKey) {
  await tx.usageMonth.upsert({
    where: { userId_monthKey: { userId, monthKey } },
    create: { userId, monthKey },
    update: {},
  });
}

export async function incrementIfBelowLimitOrThrow(tx, { userId, monthKey, field, limit, errorMessage }) {
  // unlimited
  if (typeof limit === "number" && limit < 0) return;

  // limit <= 0 means not allowed
  if (!Number.isFinite(limit) || limit <= 0) {
    const err = new Error(errorMessage);
    err.statusCode = 403;
    throw err;
  }

  await ensureUsageRow(tx, userId, monthKey);

  // Atomic: only increments if current value < limit
  const updated = await tx.usageMonth.updateMany({
    where: {
      userId,
      monthKey,
      [field]: { lt: limit },
    },
    data: {
      [field]: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    const err = new Error(errorMessage);
    err.statusCode = 403;
    throw err;
  }
}