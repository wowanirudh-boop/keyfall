export function formatPlaylistDuration(durationSeconds: number) {
  const minutes = Math.max(0, Math.round(durationSeconds / 60));
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours > 0 ? `${hours}H ${remainingMinutes}M` : `${remainingMinutes}M`;
}

export function joinNames(names: readonly string[]) {
  if (names.length < 2) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
