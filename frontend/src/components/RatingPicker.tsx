import { rocketTier } from "../lib/rocket";

interface Props {
  value: number;
  onChange: (v: number) => void;
}

/** Seletor de nota 0–10 com preview da faixa rocket. */
export default function RatingPicker({ value, onChange }: Props) {
  const tier = rocketTier(value);
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            className={`h-9 w-9 rounded-lg border font-mono text-sm transition-transform ${
              value === n
                ? "scale-110 border-transparent text-white"
                : "border-border bg-secondary text-foreground hover:border-border-hover"
            }`}
            style={value === n ? { background: tier.color, boxShadow: `0 0 12px ${tier.color}66` } : undefined}
          >
            {n}
          </button>
        ))}
      </div>
      <p
        className="mt-2 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-2xl px-3 py-1 text-xs sm:rounded-full"
        style={{ background: `${tier.color}22`, color: tier.color }}
      >
        <span aria-hidden>{tier.emoji}</span>
        <span className="font-medium">{value}/10 · {tier.label}</span>
        <span className="opacity-80">— {tier.sublabel}</span>
      </p>
    </div>
  );
}
