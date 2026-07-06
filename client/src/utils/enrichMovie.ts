import type { MovieApiResponse } from "../api/movieApi";

const fallbackPoster = "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=900&h=1350&fit=crop";
const fallbackBackdrop = "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=1400&h=800&fit=crop";

export function enrichMovie(movie: MovieApiResponse): MovieApiResponse {
  return {
    ...movie,
    movieNameVn: movie.movieNameVn || movie.movieNameEnglish || "Untitled Movie",
    movieNameEnglish: movie.movieNameEnglish || movie.movieNameVn || "Untitled Movie",
    director: movie.director || "Updating",
    actor: movie.actor || "Updating",
    content: movie.content || "Movie details will be updated soon.",
    duration: movie.duration || 100,
    version: movie.version || "2D",
    movieProductionCompany: movie.movieProductionCompany || "CinePrime",
    largeImage: movie.largeImage || movie.smallImage || fallbackBackdrop,
    smallImage: movie.smallImage || movie.largeImage || fallbackPoster,
    movieType: movie.movieType?.length ? movie.movieType : ["Cinema"],
    showTimes: movie.showTimes ?? [],
    createAt: movie.createAt || new Date().toISOString(),
  };
}
