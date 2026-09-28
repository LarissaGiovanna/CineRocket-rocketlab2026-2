import { useCallback, useEffect, useRef, useState } from "react";
import MovieCardView from "./MovieCard";
import type { MovieCard } from "../lib/movieCard";

interface Props {
  movies: MovieCard[];
  label: string;
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {dir === "left" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
}

/** Carrossel de pôsteres sem scrollbar: navegação pelas setas laterais. */
export default function GenreRail({ movies, label }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update, movies.length]);

  function scroll(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  }

  const arrowCls =
    "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-black/70 text-foreground backdrop-blur-sm transition hover:border-border-hover hover:bg-black/90";

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={update}
        className="no-scrollbar flex gap-3 overflow-x-auto pb-2 md:gap-4"
        aria-label={label}
      >
        {movies.map((m) => (
          <div key={m.id} className="w-28 shrink-0 sm:w-32 md:w-36">
            <MovieCardView movie={m} />
          </div>
        ))}
      </div>
      {canLeft && (
        <button
          type="button"
          onClick={() => scroll(-1)}
          aria-label={`Rolar ${label} para a esquerda`}
          className={`${arrowCls} left-1`}
        >
          <Chevron dir="left" />
        </button>
      )}
      {canRight && (
        <button
          type="button"
          onClick={() => scroll(1)}
          aria-label={`Rolar ${label} para a direita`}
          className={`${arrowCls} right-1`}
        >
          <Chevron dir="right" />
        </button>
      )}
    </div>
  );
}
