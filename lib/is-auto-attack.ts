export function isAutoAttack(name: string): boolean {
  const lower = name.toLowerCase();
  return lower === "attack" || lower.startsWith("unknown_");
}
