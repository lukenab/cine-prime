import { Zap, Volume2, Monitor, Armchair } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Supporting accents distinguish capabilities without competing with gold CTAs.
const FEATURES = [
  {
    icon: Monitor,
    title: "4K Ultra HD",
    description: "Crystal-clear projection on massive screens up to 30 metres wide.",
    color: "#FACC15",
  },
  {
    icon: Volume2,
    title: "Dolby Atmos",
    description: "Immersive 3D sound that fills the entire theatre with breathtaking audio.",
    color: "#A855F7",
  },
  {
    icon: Armchair,
    title: "Recliner Seats",
    description: "Fully electric leather recliners with footrests and heated cushions.",
    color: "#22D3EE",
  },
  {
    icon: Zap,
    title: "4DX & IMAX",
    description: "Motion seats, wind, rain effects, and the largest screens in the world.",
    color: "#F97316",
  },
];

export function ExperienceBanner() {
  const navigate = useNavigate();

  return (
    // cp-stars adds the drifting starfield; this section is the visual peak of the page,
    // so it keeps its own deep-navy gradient instead of the flat .cp-section shell.
    // position/overflow are needed locally so the starfield layers are clipped to the section.
    <section
      className="cp-stars cp-theme-experience"
      style={{
        background: "linear-gradient(135deg, #070510 0%, #11102b 50%, #070510 100%)",
        paddingTop: "80px",
        paddingBottom: "80px",
        borderTop: "1px solid rgba(139,92,246,0.2)",
        borderBottom: "1px solid rgba(139,92,246,0.2)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* cp-shell lifts the content above the starfield layers */}
      <div className="cp-shell max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="cp-eyebrow" style={{ color: "var(--cp-purple)" }}>Why Choose CinePrime</span>
          <h2
            style={{
              color: "white",
              fontWeight: 800,
              fontSize: "clamp(1.6rem, 4vw, 2.5rem)",
              marginTop: "12px",
              lineHeight: 1.2,
            }}
          >
            The Ultimate <span className="cp-grad-text cp-grad-text--experience">Cinema Experience</span>
          </h2>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.9rem", marginTop: "12px" }}>
            State-of-the-art technology meets luxurious comfort for an unparalleled night out.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map(({ icon: Icon, title, description, color }) => (
            <div
              key={title}
              // cp-card--lift reproduces the old -8px hover lift in CSS. The border/background
              // and glow live in the class: inline styles set from JS would always win over it.
              className="cp-card cp-card--lift group relative p-6 cursor-default"
            >
              {/* Icon */}
              <div
                className="flex items-center justify-center w-12 h-12 rounded-xl mb-5"
                style={{
                  backgroundColor: `${color}15`,
                  border: `1px solid ${color}25`,
                }}
              >
                <Icon size={22} style={{ color }} />
              </div>

              {/* Glow dot */}
              <div
                className="absolute top-5 right-5 w-1.5 h-1.5 rounded-full opacity-60"
                style={{ backgroundColor: color }}
              />

              <h3 style={{ color: "white", fontWeight: 700, fontSize: "1rem", marginBottom: "8px" }}>
                {title}
              </h3>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.82rem", lineHeight: 1.65 }}>
                {description}
              </p>
            </div>
          ))}
        </div>

        {/* CTA strip */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-6 mt-12 p-8 rounded-2xl"
          style={{
            background: "linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(255,196,0,0.08) 100%)",
            border: "1px solid rgba(168,85,247,0.24)",
          }}
        >
          <div>
            <h3 style={{ color: "white", fontWeight: 700, fontSize: "1.2rem" }}>
              Ready for an unforgettable night?
            </h3>
            <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.85rem", marginTop: "4px" }}>
              Join 2 million+ movie lovers who book with CinePrime every month.
            </p>
          </div>
          <button
            // The page's closing CTA had no handler at all; send it to the movie listing.
            onClick={() => navigate("/movies")}
            // .cp-btn supplies background, colour, radius, shadow and hover state.
            className="cp-btn flex-shrink-0 px-8 py-3.5"
            style={{
              fontWeight: 800,
              fontSize: "0.9rem",
              whiteSpace: "nowrap",
            }}
          >
            Browse All Movies
          </button>
        </div>
      </div>
    </section>
  );
}
