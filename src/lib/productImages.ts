const palettes: Record<string, [string, string, string]> = {
  Origami: ['#f3e8ff', '#7c3aed', '#f59e0b'],
  Scrapbooking: ['#fff1f2', '#e11d48', '#fb7185'],
  Quilling: ['#ecfeff', '#0891b2', '#22d3ee'],
  'Card Making': ['#eef2ff', '#4f46e5', '#818cf8'],
  'Paper Flowers': ['#fff7ed', '#ea580c', '#fdba74'],
  'Washi Tape': ['#fdf4ff', '#c026d3', '#f0abfc'],
  Cardstock: ['#f0fdf4', '#16a34a', '#86efac'],
  'Kids Craft': ['#fffbeb', '#d97706', '#fbbf24'],
  Journaling: ['#eff6ff', '#2563eb', '#93c5fd'],
  'DIY Decor': ['#fdf2f8', '#db2777', '#f9a8d4'],
};

export function getGeneratedProductImage(name: string, category?: string | null): string {
  const [background, primary, accent] = palettes[category || ''] || ['#f5f3ff', '#6d28d9', '#c4b5fd'];
  const shortName = name.length > 28 ? `${name.slice(0, 27)}...` : name;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
      <rect width="800" height="800" rx="36" fill="${background}"/>
      <circle cx="650" cy="145" r="110" fill="${accent}" opacity=".28"/>
      <circle cx="130" cy="650" r="170" fill="${primary}" opacity=".10"/>
      <g transform="translate(400 365)">
        <rect x="-190" y="-220" width="380" height="440" rx="28" fill="#fff" opacity=".92"/>
        <rect x="-155" y="-185" width="310" height="250" rx="18" fill="${primary}" opacity=".12"/>
        <path d="M-120 -35 L-20 -135 L80 -35 L0 55 Z" fill="${primary}"/>
        <path d="M80 -35 L145 -105 L155 28 L55 55 Z" fill="${accent}" opacity=".9"/>
        <circle cx="-75" cy="-90" r="26" fill="${accent}" opacity=".9"/>
        <circle cx="-75" cy="-90" r="12" fill="#fff" opacity=".75"/>
        <path d="M-135 95 C-95 55 -35 55 5 95 C45 135 105 135 145 95" fill="none" stroke="${primary}" stroke-width="18" stroke-linecap="round"/>
      </g>
      <rect x="58" y="650" width="684" height="92" rx="46" fill="#fff" opacity=".92"/>
      <text x="400" y="700" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#1f2937">${shortName}</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
