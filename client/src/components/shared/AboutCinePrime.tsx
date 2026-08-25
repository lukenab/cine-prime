import { ArrowRight, Clapperboard, MapPin, TicketCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import CinePrimeBrand from "./CinePrimeBrand";

const PROMISES = [
  {
    icon: Clapperboard,
    title: "Discover with confidence",
    description: "Explore current releases, screening formats and showtimes in one clear journey.",
  },
  {
    icon: TicketCheck,
    title: "Book without friction",
    description: "Choose seats, add concessions, apply offers and keep every ticket close at hand.",
  },
  {
    icon: MapPin,
    title: "Connected across locations",
    description: "Use one CinePrime account for a consistent experience across our cinema network.",
  },
];

export function AboutCinePrime() {
  const navigate = useNavigate();

  return (
    <section
      aria-labelledby="about-cineprime-title"
      className="relative overflow-hidden border-t border-white/[0.06] py-20 sm:py-24"
      style={{ background: "linear-gradient(145deg, #050505 0%, #07101d 52%, #050505 100%)" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-1/2 h-[420px] w-[420px] -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: "rgba(37,99,235,0.12)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 -top-32 h-80 w-80 rounded-full blur-3xl"
        style={{ background: "rgba(255,196,0,0.08)" }}
      />

      <div className="cp-shell relative mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-20">
          <div className="max-w-2xl">
            <span className="cp-eyebrow">About CinePrime</span>
            <h2
              id="about-cineprime-title"
              className="mt-4 max-w-xl text-[clamp(2rem,5vw,3.5rem)] font-extrabold leading-[1.08] tracking-[-0.035em] text-white"
            >
              Made for people who love the <span className="cp-grad-text">big screen.</span>
            </h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/60">
              CinePrime brings movie discovery, cinema selection and ticket booking into one connected experience—from choosing a film to taking your seat.
            </p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/45">
              Thoughtful programming, comfortable auditoriums and clear digital service help every visit feel simple, consistent and worth looking forward to.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate("/movies")}
                className="cp-btn inline-flex min-h-11 items-center justify-center gap-2 px-6 text-sm font-bold"
              >
                Explore movies <ArrowRight size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => navigate("/cinemas")}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-6 text-sm font-semibold text-white transition-colors hover:border-blue-400/40 hover:bg-blue-500/10"
              >
                Find a cinema
              </button>
            </div>
          </div>

          <div
            className="relative rounded-[28px] border border-white/[0.09] p-6 sm:p-8"
            style={{
              background: "linear-gradient(145deg, rgba(255,255,255,0.055), rgba(255,255,255,0.018))",
              boxShadow: "0 28px 80px rgba(0,0,0,0.28)",
            }}
          >
            <div className="mb-6 flex items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
              <CinePrimeBrand markSize={38} wordmarkSize="1rem" letterSpacing="0.14em" />
              <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-blue-300">
                Our promise
              </span>
            </div>

            <div className="space-y-2">
              {PROMISES.map(({ icon: Icon, title, description }) => (
                <div key={title} className="flex gap-4 rounded-2xl p-4 transition-colors hover:bg-white/[0.035]">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-white">{title}</h3>
                    <p className="mt-1 text-xs leading-5 text-white/45">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
