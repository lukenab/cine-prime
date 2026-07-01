import { useEffect, useState } from "react";
import { movieApi, type MovieApiResponse } from "../../api/movieApi";
import { HeroSection } from "../../components/shared/HeroSection";
import { SearchBar } from "../../components/shared/SearchBar";
import { NowShowing } from "../../components/shared/NowShowing";
import { CinemaLocations } from "../../components/shared/CinemaLocations";
import { ExperienceBanner } from "../../components/shared/ExperienceBanner";
import { ComingSoon } from "../../components/shared/ComingSoon";

export default function HomePage() {
  const [movies, setMovies] = useState<MovieApiResponse[]>([]);
  const [loadingMovies, setLoadingMovies] = useState(false);
  const [movieError, setMovieError] = useState("");

  useEffect(() => {
    let active = true;

    const loadMovies = async () => {
      setLoadingMovies(true);
      setMovieError("");
      try {
        const res = await movieApi.getAllMovies();
        if (active) setMovies(res.result ?? []);
      } catch {
        if (active) setMovieError("Movies are temporarily unavailable.");
      } finally {
        if (active) setLoadingMovies(false);
      }
    };

    loadMovies();

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <HeroSection />
      <SearchBar />
      <NowShowing movies={movies} loading={loadingMovies} error={movieError} />
      <CinemaLocations />
      <ExperienceBanner />
      <ComingSoon movies={movies} />
    </>
  );
}
