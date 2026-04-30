interface LogoProps {
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export default function Logo({ width = 120, height, className, style, onClick }: LogoProps) {
  // Maintain aspect ratio: 400x280 = 10:7 ratio
  const calculatedHeight = height || (width * 0.7);

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
        <title id="t">Meridian Collective — transparent</title>
        <desc id="d">Primary lockup with no background fill, intended to overlay any surface that respects sufficient contrast with bone and brass.</desc>
        <text 
          x="200" 
          y="170" 
          textAnchor="middle" 
          fontFamily="'Cormorant Garamond', 'EB Garamond', 'Playfair Display', Georgia, serif" 
          fontSize="140" 
          fontWeight="300" 
          letterSpacing="-5" 
          fill="#EDE6D6"
        >
          M
        </text>
        <text 
          x="262" 
          y="91" 
          fontFamily="'Cormorant Garamond', 'EB Garamond', Georgia, serif" 
          fontSize="34" 
          fontWeight="400" 
          fill="#C9A878"
        >
          °
        </text>
        <line x1="64" y1="207" x2="94" y2="207" stroke="#C9A878" strokeWidth="1"/>
        <text 
          x="200" 
          y="211" 
          textAnchor="middle" 
          fontFamily="'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif" 
          fontSize="10" 
          fontWeight="500" 
          letterSpacing="4.5" 
          fill="#C9A878"
        >
          MERIDIAN COLLECTIVE
        </text>
        <line x1="306" y1="207" x2="336" y2="207" stroke="#C9A878" strokeWidth="1"/>
      </svg>
    </div>
  );
}