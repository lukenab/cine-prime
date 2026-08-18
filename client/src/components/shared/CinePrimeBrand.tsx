import { useId } from "react";
import { Link } from "react-router-dom";

interface CinePrimeBrandProps {
  to?: string;
  markSize?: number;
  wordmarkSize?: string | number;
  letterSpacing?: string;
  className?: string;
  glow?: boolean;
}

export default function CinePrimeBrand({
  to,
  markSize = 44,
  wordmarkSize = "1.3rem",
  letterSpacing = "0.18em",
  className = "",
  glow = true,
}: CinePrimeBrandProps) {
  const instanceId = useId().replace(/:/g, "");
  const sphereId = `cpLogoSphere-${instanceId}`;
  const ringId = `cpLogoRing-${instanceId}`;
  const rimId = `cpLogoRim-${instanceId}`;
  const specId = `cpLogoSpec-${instanceId}`;
  const clipId = `cpLogoClip-${instanceId}`;

  const brand = (
    <>
      <svg
        viewBox="0 0 200 200"
        aria-hidden="true"
        className="shrink-0 transition-transform duration-300 group-hover:scale-105"
        style={{
          width: markSize,
          height: markSize,
          filter: glow ? "drop-shadow(0 0 10px rgba(59,130,246,0.45))" : undefined,
        }}
      >
        <defs>
          <radialGradient id={sphereId} cx="34%" cy="30%" r="78%">
            <stop offset="0%" stopColor="#7DD3FC" />
            <stop offset="45%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#1E3A8A" />
          </radialGradient>
          <linearGradient id={ringId} gradientUnits="userSpaceOnUse" x1="20" y1="30" x2="180" y2="170">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
          <mask id={rimId}>
            <circle cx="100" cy="100" r="49" fill="#fff" />
            <circle cx="93" cy="93" r="48.2" fill="#000" />
          </mask>
          <radialGradient id={specId}>
            <stop offset="0%" stopColor="#fff" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <clipPath id={clipId}>
            <circle cx="100" cy="100" r="49" />
          </clipPath>
        </defs>

        <g transform="rotate(-22 100 100)">
          <ellipse cx="100" cy="100" rx="86" ry="31" fill="none" stroke={`url(#${ringId})`} strokeWidth="7" opacity="0.5" />
        </g>

        <circle cx="100" cy="100" r="49" fill={`url(#${sphereId})`} />
        <circle cx="100" cy="100" r="49" fill="#7DD3FC" mask={`url(#${rimId})`} opacity="0.8" />

        <g clipPath={`url(#${clipId})`}>
          <g transform="rotate(-22 100 100)">
            <path d="M14,108 A86,31 0 0 0 186,108" fill="none" stroke="#0A1A42" strokeWidth="7" opacity="0.5" />
          </g>
        </g>

        <ellipse cx="83" cy="79" rx="15" ry="10" fill={`url(#${specId})`} transform="rotate(-28 83 79)" />

        <g transform="rotate(-22 100 100)">
          <path d="M14,100 A86,31 0 0 0 186,100" fill="none" stroke={`url(#${ringId})`} strokeWidth="7" strokeLinecap="round" />
          <circle cx="186" cy="100" r="8.5" fill="#7DD3FC" />
        </g>
      </svg>

      <span
        className="uppercase leading-none"
        style={{
          fontSize: wordmarkSize,
          fontWeight: 800,
          letterSpacing,
          fontFamily: "'Inter', sans-serif",
          textShadow: glow ? "0 0 22px rgba(59,130,246,0.45)" : undefined,
        }}
      >
        <span style={{ color: "#f0f6ff" }}>Cine</span>
        <span
          style={{
            background: "linear-gradient(135deg, #93c5fd 0%, #3b82f6 50%, #2563eb 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Prime
        </span>
      </span>
    </>
  );

  const classes = `group flex items-center gap-2.5 select-none ${className}`.trim();

  return to ? (
    <Link to={to} className={`${classes} cursor-pointer`} aria-label="CinePrime home">
      {brand}
    </Link>
  ) : (
    <div className={classes} aria-label="CinePrime">
      {brand}
    </div>
  );
}
