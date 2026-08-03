import { useCallback, useEffect, useState } from "react";
import { movieApi, type MovieApiResponse } from "../../api/movieApi";
import { subscribeLifecycleEvents } from "../../api/lifecycleSocket";
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

  const loadMovies = useCallback(async () => {
    setLoadingMovies(true);
    setMovieError("");
    try {
      const res = await movieApi.getPublicMovies();
      setMovies(res.result ?? []);
    } catch {
      setMovieError("Movies are temporarily unavailable.");
    } finally {
      setLoadingMovies(false);
    }
  }, []);

  useEffect(() => {
    void loadMovies();
    return subscribeLifecycleEvents((event) => {
      if (["MOVIE", "RELEASE_PLAN", "SCHEDULE_PLAN"].includes(event.aggregateType)) {
        void loadMovies();
      }
    });
  }, [loadMovies]);

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
