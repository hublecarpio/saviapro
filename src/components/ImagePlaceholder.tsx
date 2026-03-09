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
          className="relative w-24 h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden"
          style={{
            // Liquid glass base
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.14) 100%)",
            backdropFilter: "blur(18px) saturate(160%)",
            WebkitBackdropFilter: "blur(18px) saturate(160%)",
            boxShadow:
              "0 4px 24px 0 rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.08)",
            border: "1px solid rgba(255,255,255,0.28)",
          }}
        >
          {/* Shimmer sweep animation */}
          <div
            className="absolute inset-0 -translate-x-full animate-[shimmer_2.2s_ease-in-out_infinite]"
            style={{
              background:
                "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.22) 50%, transparent 70%)",
            }}
          />

          {/* Inner highlight top-edge */}
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
            }}
          />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center justify-center h-full gap-2">
            <ImageIcon
              className="h-6 w-6"
              style={{ color: "rgba(255,255,255,0.45)" }}
            />
            <div className="flex items-center gap-1">
              <Loader2
                className="h-3 w-3 animate-spin"
                style={{ color: "rgba(255,255,255,0.5)" }}
              />
              <span
                className="text-[9px] font-semibold tracking-wide"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Generando...
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* Shimmer keyframe (injected once via a style tag) */}
      <style>{`
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          60%  { transform: translateX(100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};
