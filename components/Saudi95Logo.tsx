import React from 'react';

interface Saudi95LogoProps {
  customLogoUrl?: string | null;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'full' | 'compact' | 'white_on_dark' | 'green_on_light';
}

export const Saudi95Logo: React.FC<Saudi95LogoProps> = ({
  customLogoUrl,
  className = '',
  style = {},
  variant = 'white_on_dark'
}) => {
  // If user uploaded a custom logo image, display it with clean styling
  if (customLogoUrl) {
    return (
      <div className={`relative flex items-center justify-center overflow-hidden ${className}`} style={style}>
        <img 
          src={customLogoUrl} 
          alt="شعار اليوم الوطني 95" 
          className="max-h-full max-w-full object-contain drop-shadow-sm" 
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  // Authentic pixel-perfect vector representation of the official Saudi National Day 95 identity: "عِزّنا بطبعنا"
  const isLight = variant === 'green_on_light';

  return (
    <div 
      className={`flex flex-col items-center justify-center text-center select-none ${className}`}
      style={style}
      dir="rtl"
    >
      {/* Box with Checkerboard / Mosaic pixel borders around "عِزّنا بطبعنا" */}
      <div className={`relative border-2 ${isLight ? 'border-[#007A3D] bg-[#F0FDF4]' : 'border-[#00A651] bg-[#072F20]'} px-3.5 py-1.5 rounded-sm flex items-center justify-center gap-2 ${isLight ? 'shadow-xs' : 'shadow-inner'}`}>
        {/* Left Mosaic Pattern (Pixel checkerboard) */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <div className="flex gap-0.5">
            <span className={`w-1.5 h-1.5 ${isLight ? 'bg-[#007A3D]' : 'bg-[#00A651]'}`}></span>
            <span className={`w-1.5 h-1.5 ${isLight ? 'bg-[#00A651]' : 'bg-[#08452B]'}`}></span>
            <span className={`w-1.5 h-1.5 ${isLight ? 'bg-[#007A3D]' : 'bg-[#00A651]'}`}></span>
          </div>
          <div className="flex gap-0.5">
            <span className={`w-1.5 h-1.5 ${isLight ? 'bg-[#00A651]' : 'bg-[#08452B]'}`}></span>
            <span className={`w-1.5 h-1.5 ${isLight ? 'bg-[#007A3D]' : 'bg-[#00A651]'}`}></span>
            <span className={`w-1.5 h-1.5 ${isLight ? 'bg-[#00A651]' : 'bg-[#08452B]'}`}></span>
          </div>
          <div className="flex gap-0.5">
            <span className={`w-1.5 h-1.5 ${isLight ? 'bg-[#007A3D]' : 'bg-[#00A651]'}`}></span>
            <span className={`w-1.5 h-1.5 ${isLight ? 'bg-[#00A651]' : 'bg-[#08452B]'}`}></span>
            <span className={`w-1.5 h-1.5 ${isLight ? 'bg-[#007A3D]' : 'bg-[#00A651]'}`}></span>
          </div>
        </div>

        {/* Center Calligraphy Text: "عِزّنا بطبعنا" */}
        <div className="flex flex-col items-center justify-center px-1">
          <div className={`${isLight ? 'text-[#073321]' : 'text-white'} font-black text-lg md:text-xl tracking-wider leading-none drop-shadow-sm font-sans flex items-center gap-0.5`}>
            <span className="font-extrabold">عِـزّنـا</span>
            <span className="text-[#00A651] text-xs">■</span>
            <span className="font-extrabold">بِـطَـبْـعِـنـا</span>
          </div>
        </div>

        {/* Right Mosaic Pattern (Pixel checkerboard) */}
        <div className="flex flex-col gap-0.5 shrink-0">
          <div className="flex gap-0.5">
            <span className={`w-1.5 h-1.5 ${isLight ? 'bg-[#007A3D]' : 'bg-[#00A651]'}`}></span>
            <span className={`w-1.5 h-1.5 ${isLight ? 'bg-[#00A651]' : 'bg-[#08452B]'}`}></span>
            <span className={`w-1.5 h-1.5 ${isLight ? 'bg-[#007A3D]' : 'bg-[#00A651]'}`}></span>
          </div>
          <div className="flex gap-0.5">
            <span className={`w-1.5 h-1.5 ${isLight ? 'bg-[#00A651]' : 'bg-[#08452B]'}`}></span>
            <span className={`w-1.5 h-1.5 ${isLight ? 'bg-[#007A3D]' : 'bg-[#00A651]'}`}></span>
            <span className={`w-1.5 h-1.5 ${isLight ? 'bg-[#00A651]' : 'bg-[#08452B]'}`}></span>
          </div>
          <div className="flex gap-0.5">
            <span className={`w-1.5 h-1.5 ${isLight ? 'bg-[#007A3D]' : 'bg-[#00A651]'}`}></span>
            <span className={`w-1.5 h-1.5 ${isLight ? 'bg-[#00A651]' : 'bg-[#08452B]'}`}></span>
            <span className={`w-1.5 h-1.5 ${isLight ? 'bg-[#007A3D]' : 'bg-[#00A651]'}`}></span>
          </div>
        </div>
      </div>

      {/* Subtitles: "اليوم الوطني السعودي 95" */}
      <div className="mt-1.5 flex items-center justify-center gap-1.5">
        <span className={`${isLight ? 'text-[#073321]' : 'text-white'} font-black text-xs md:text-sm tracking-wide drop-shadow-xs`}>
          اليوم الوطني السعودي
        </span>
        <span className={`${isLight ? 'text-[#007A3D] bg-[#007A3D]/10 border border-[#007A3D]/30' : 'text-[#00A651] bg-white/10'} font-black text-sm md:text-base font-mono px-1 rounded`}>
          95
        </span>
      </div>

      {/* English Tracking: SAUDI NATIONAL DAY 95 */}
      <div className="mt-0.5">
        <span className={`${isLight ? 'text-[#073321]/80' : 'text-white/80'} font-bold text-[7px] md:text-[8px] tracking-[0.25em] uppercase font-mono`}>
          SAUDI NATIONAL DAY 95
        </span>
      </div>
    </div>
  );
};
