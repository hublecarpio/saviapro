import { ImageIcon, Loader2 } from "lucide-react";

interface ImagePlaceholderProps {
  count: number;
}

export const ImagePlaceholder = ({ count }: ImagePlaceholderProps) => {
  return (
    <div className="flex flex-wrap justify-center gap-3 mt-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="relative w-24 h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden
                     bg-background/50 dark:bg-white/[0.06] 
                     border border-border/40 dark:border-white/[0.18]
                     backdrop-blur-xl saturate-150
                     shadow-[0_4px_24px_0_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.15)]
                     dark:shadow-[0_4px_24px_0_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(0,0,0,0.08)]"
        >
          {/* Shimmer sweep */}
          <div
            className="absolute inset-0 -translate-x-full"
            style={{
              background:
                "linear-gradient(105deg, transparent 30%, hsl(var(--primary) / 0.12) 50%, transparent 70%)",
              animation: "glass-shimmer 2.2s ease-in-out infinite",
            }}
          />

          {/* Top edge highlight */}
          <div
            className="absolute inset-x-0 top-0 h-px 
                       bg-gradient-to-r from-transparent via-white/30 dark:via-white/50 to-transparent"
          />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center justify-center h-full gap-2">
            <ImageIcon className="h-6 w-6 text-muted-foreground/30 dark:text-white/[0.35]" />
            <div className="flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin text-primary/40 dark:text-white/[0.4]" />
              <span className="text-[9px] font-semibold tracking-wide text-muted-foreground/40 dark:text-white/[0.45]">
                Generando...
              </span>
            </div>
          </div>
        </div>
      ))}

      <style>{`
        @keyframes glass-shimmer {
          0%   { transform: translateX(-100%); }
          60%  { transform: translateX(100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};
