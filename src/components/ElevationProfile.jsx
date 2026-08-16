export default function ElevationProfile() {
  const fillPath = "M0,90 L40,90 L70,55 L110,70 L150,20 L190,45 L230,10 L270,50 L310,30 L350,65 L390,15 L430,58 L470,40 L510,80 L550,60 L590,88 L640,88 L680,50 L720,72 L760,25 L800,90 L800,140 L0,140 Z";
  const strokePath = "M0,90 L40,90 L70,55 L110,70 L150,20 L190,45 L230,10 L270,50 L310,30 L350,65 L390,15 L430,58 L470,40 L510,80 L550,60 L590,88 L640,88 L680,50 L720,72 L760,25 L800,90";
  return (
    <svg viewBox="0 0 800 140" className="elev-svg" preserveAspectRatio="none">
      <defs>
        <linearGradient id="elevFillGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--amber)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--amber)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill="url(#elevFillGrad)" />
      <path
        d={strokePath}
        fill="none"
        stroke="var(--amber)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="elev-line"
      />
    </svg>
  );
}
