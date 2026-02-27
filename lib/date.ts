// app/lib/date.ts

export function formatShowDate(
  isoYYYYMMDD: string | null | undefined,
  opts?: { weekday?: boolean }
) {
  const iso = (isoYYYYMMDD ?? "").slice(0, 10);
  if (!iso) return "";

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso; // fallback: show raw if unexpected

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);

  // ✅ local-safe date (no UTC shifting)
  const dt = new Date(y, mo - 1, d);

  const weekday = new Intl.DateTimeFormat("en-CA", { weekday: "long" }).format(dt);
  const monthDay = new Intl.DateTimeFormat("en-CA", { month: "long", day: "numeric" }).format(dt);

  return opts?.weekday ? `${weekday}, ${monthDay}` : `${monthDay}`;
}

