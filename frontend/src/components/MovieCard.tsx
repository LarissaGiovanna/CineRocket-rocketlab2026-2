import { Link } from "react-router-dom";
import type { MovieCard } from "../lib/movieCard";
import { formatNota } from "../lib/rocket";

interface Props {
  movie: MovieCard;
  layout?: "grid" | "list";
}

export default function MovieCardView({ movie, layout = "grid" }: Props) {
  if (layout === "list") {
    return (
      <Link
        to={`/movie/${movie.id}`}
        className="flex gap-3 rounded-xl border border-border bg-card p-3 hover:border-border-hover"
      >
        {movie.url_poster ? (
          <img
            src={movie.url_poster}
            alt={movie.titulo}
            loading="lazy"
            className="h-24 w-16 shrink-0 rounded-lg bg-secondary object-cover"
          />
        ) : (
          <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded-lg bg-secondary text-2xl" aria-hidden>
            🎬
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium">{movie.titulo}</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            ⭐ {formatNota(movie.nota_media)}/10
          </p>
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/movie/${movie.id}`} className="group min-w-0">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-secondary">
        {movie.url_poster ? (
          <img
            src={movie.url_poster}
            alt={movie.titulo}
            loading="lazy"
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl" aria-hidden>
            🎬
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 font-mono text-xs text-imdb opacity-0 transition-opacity group-hover:opacity-100">
          ⭐ {formatNota(movie.nota_media)}
        </span>
      </div>
      <p className="mt-2 truncate text-sm font-medium">{movie.titulo}</p>
      <p className="font-mono text-xs text-muted-foreground">
        ⭐ {formatNota(movie.nota_media)}/10
      </p>
    </Link>
  );
}
