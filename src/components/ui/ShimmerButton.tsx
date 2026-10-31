import React from "react";

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  shimmerColor?: string;
  className?: string;
}

export const ShimmerButton: React.FC<ShimmerButtonProps> = ({
  children,
  shimmerColor: _shimmerColor = "#ffffff",
  className = "",
  disabled,
  ...props
}) => {
  return (
    <button
      disabled={disabled}
      className={`group relative inline-flex items-center justify-center overflow-hidden rounded-lg px-5 py-2.5 font-bold text-xs uppercase tracking-wider text-black bg-amber-500 hover:bg-amber-400 active:scale-[0.98] transition-all duration-200 shadow-md hover:shadow-amber-500/25 disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${className}`}
      {...props}
    >
      {/* Shimmer sweep effect */}
      <span className="absolute top-0 left-0 -ml-12 h-full w-8 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 -skew-x-12 group-hover:opacity-100 group-hover:translate-x-[350px] transition-all duration-700 ease-out" />
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
    </button>
  );
};
