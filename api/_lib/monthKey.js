export function getMonthKey(d = new Date()) {
  // UTC "YYYY-MM"
  return d.toISOString().slice(0, 7);
}