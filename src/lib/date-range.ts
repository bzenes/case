/** Every calendar date from startIso to endIso inclusive, as "YYYY-MM-DD" strings. */
export function eachDateInRange(startIso: string, endIso: string): string[] {
  const dates: string[] = [];
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  for (let d = start; d.getTime() <= end.getTime(); d = new Date(d.getTime() + 86_400_000)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}
