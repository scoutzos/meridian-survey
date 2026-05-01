interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  /** Render colors for placement on a dark surface (Obsidian). */
  onDark?: boolean;
}

export default function Logo({ width = 120, height, className, style, onClick, onDark = false }: LogoProps) {
  // Maintain aspect ratio: 400x280 = 10:7 ratio
  const calculatedHeight = height || (width * 0.7);
  const monogramFill = onDark ? "#EDE6D6" : "#1A1A1A";
  const accentFill = "#C9A878"; // Brass
  return (
    <div className={className} style={style} onClick={onClick}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 400 280"
        role="img"
        aria-labelledby="t d"
        width={width}
        height={calculatedHeight}
        style={{ display: 'block' }}
      >
        <title id="t">Meridian Collective</title>
        <desc id="d">Primary M° monogram with the Meridian Collective wordmark.</desc>
        <text
          x="200"
          y="170"
          textAnchor="middle"
          fontFamily="'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif"
          fontSize="140"
          fontWeight="300"
          letterSpacing="-5"
          fill={monogramFill}
        >
          M
        </text>
        <text
          x="262"
          y="91"
          fontFamily="'Cormorant Garamond', 'EB Garamond', Georgia, serif"
          fontSize="34"
          fontWeight="400"
          fill={accentFill}
        >
          °
        </text>
        <line x1="64" y1="207" x2="94" y2="207" stroke={accentFill} strokeWidth="1"/>
        <text
          x="200"
          y="211"
          textAnchor="middle"
          fontFamily="'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif"
          fontSize="10"
          fontWeight="500"
          letterSpacing="4.5"
          fill={accentFill}
        >
          MERIDIAN COLLECTIVE
        </text>
        <line x1="306" y1="207" x2="336" y2="207" stroke={accentFill} strokeWidth="1"/>
      </svg>
    </div>
  );
}
