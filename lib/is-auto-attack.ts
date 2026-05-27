export function isAutoAttack(name: string): boolean {
  const lower = name.toLowerCase();
  return name === "攻撃" || lower === "attack" || lower.startsWith("unknown_");
}
