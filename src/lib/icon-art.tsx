/** Shared artwork for generated PWA icons (rendered with next/og). */
export function IconArt({ size, maskable = false }: { size: number; maskable?: boolean }) {
  const inner = maskable ? size * 0.56 : size * 0.6
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #6a4df5 0%, #3fb6d8 100%)", borderRadius: maskable ? 0 : size * 0.225 }}>
      <svg width={inner} height={inner} viewBox="0 0 40 40">
        <path d="M20 4c1.1 8.2 4.8 12.3 13 13.5-8.200 1.200-11.900 5.300-13 13.500-1.100-8.200-4.800-12.300-13-13.500C15.200 16.300 18.900 12.200 20 4Z" fill="white" />
        <circle cx="32" cy="8" r="2.600" fill="white" fillOpacity="0.75" />
      </svg>
    </div>
  )
}
