import { useId } from "react";

type OrbitaLogoProps = {
  /**
   * Rendered height in px. Width follows automatically at the mark's natural
   * ~1.8:1 ratio — a ringed planet is wider than it is tall, so pinning both
   * dimensions would squash it.
   */
  size?: number;
  /**
   * Blue halo behind the mark. Reads well on the dark navbar/footer; turn it
   * off on light or busy backgrounds where it just muddies the edges.
   */
  glow?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * CinePrime brand mark — a ringed planet whose orbit passes in front of the
 * sphere at the bottom and behind it at the top, with a single moon on the
 * ring.
 *
 * The viewBox is cropped tight to the artwork rather than left at a square
 * 0 0 200 200, so the mark optically fills whatever box it is given instead of
 * floating in dead space.
 *
 * Gradient ids are generated per instance with useId. Two of these render at
 * once (navbar + footer), and duplicate ids across inline SVGs make every
 * instance after the first inherit the wrong gradient in Safari and Firefox.
 */
export function OrbitaLogo({
  size = 38,
  glow = true,
  className,
  style,
}: OrbitaLogoProps) {
  const uid = useId();
  const sphereId = `orbita-sphere-${uid}`;
  const ringId = `orbita-ring-${uid}`;

  return (
    <svg
      viewBox="14 51 176 98"
      height={size}
      width={size * 1.8}
      role="img"
      aria-label="CinePrime"
      className={className}
      style={{
        display: "block",
        overflow: "visible",
        filter: glow
          ? "drop-shadow(0 0 10px rgba(59,130,246,0.45))"
          : undefined,
        ...style,
      }}
    >
      <defs>
        <radialGradient id={sphereId} cx="34%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#7DD3FC" />
          <stop offset="45%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </radialGradient>
        {/* userSpaceOnUse, not the default objectBoundingBox: the front arc has
            a very flat bounding box and an objectBoundingBox gradient collapses
            on shapes like that, dropping the stroke entirely. */}
        <linearGradient
          id={ringId}
          gradientUnits="userSpaceOnUse"
          x1="20"
          y1="30"
          x2="180"
          y2="170"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
      </defs>

      {/* Back half of the ring — drawn first so the planet occludes it. */}
      <g transform="rotate(-22 100 100)">
        <ellipse
          cx="100"
          cy="100"
          rx="86"
          ry="31"
          fill="none"
          stroke={`url(#${ringId})`}
          strokeWidth="7"
          opacity="0.55"
        />
      </g>

      <circle cx="100" cy="100" r="49" fill={`url(#${sphereId})`} />

      {/* Front half of the ring, plus the moon, painted over the sphere. */}
      <g transform="rotate(-22 100 100)">
        <path
          d="M14,100 A86,31 0 0 0 186,100"
          fill="none"
          stroke={`url(#${ringId})`}
          strokeWidth="7"
          strokeLinecap="round"
        />
        <circle cx="186" cy="100" r="8.5" fill="#7DD3FC" />
      </g>
    </svg>
  );
}

export default OrbitaLogo;
