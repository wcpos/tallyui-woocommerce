export function dayRange(now: Date): { startIso: string; endIso: string } {
  const [year, month, day] = [now.getFullYear(), now.getMonth(), now.getDate()];
  return {
    startIso: new Date(year, month, day).toISOString(),
    endIso: new Date(year, month, day + 1).toISOString(),
  };
}
