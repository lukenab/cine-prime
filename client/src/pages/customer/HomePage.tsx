import { useEffect, useState } from "react";
import { movieApi, type MovieApiResponse } from "../../api/movieApi";
import { HeroSection } from "../../components/shared/HeroSection";
import { QuickBooking } from "../../components/shared/QuickBooking";
import { MovieShowcase } from "../../components/shared/MovieShowcase";
import { OffersTeaser } from "../../components/shared/OffersTeaser";
import { UpcomingEvents } from "../../components/shared/UpcomingEvents";
import { CinemaLocations } from "../../components/shared/CinemaLocations";
import { ExperienceBanner } from "../../components/shared/ExperienceBanner";
import { Testimonials } from "../../components/shared/Testimonials";

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
        const res = await movieApi.getPublicMovies();
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
      <QuickBooking />
      <MovieShowcase movies={movies} loading={loadingMovies} error={movieError} />
      <OffersTeaser />
      <UpcomingEvents />
      <CinemaLocations />
      <ExperienceBanner />
      <Testimonials />
    </>
  );
}
