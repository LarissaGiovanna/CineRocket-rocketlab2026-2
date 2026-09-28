/** Classificação Rocket — espelho visual do design.md (0–10 inteiros). */

export interface RocketTier {
  label: string;
  sublabel: string;
  color: string;
  emoji: string;
}

export function rocketTier(nota: number): RocketTier {
  const n = Math.round(nota);
  if (n <= 2)
    return { label: "Nem decolou", sublabel: "Esse filme nem saiu do chão", color: "#ef4444", emoji: "💥" };
  if (n <= 4)
    return { label: "Decolagem acidentada", sublabel: "Subiu um pouco, mas caiu rápido", color: "#f97316", emoji: "🔥" };
  if (n <= 6)
    return { label: "Na atmosfera", sublabel: "Chegou lá, mas não brilhou", color: "#eab308", emoji: "🚀" };
  if (n <= 8)
    return { label: "Em órbita", sublabel: "Sólido e admirável", color: "#3b82f6", emoji: "🛸" };
  if (n === 9)
    return { label: "Chegou à lua", sublabel: "Quase perfeito, inesquecível", color: "#a855f7", emoji: "🌕" };
  return { label: "Além das estrelas", sublabel: "Obra-prima absoluta", color: "#e03535", emoji: "⭐" };
}

export function formatNota(nota: number | null | undefined): string {
  if (nota === null || nota === undefined) return "—";
  return nota.toFixed(1);
}
