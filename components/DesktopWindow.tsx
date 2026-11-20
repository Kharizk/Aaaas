import React, { useRef, useState, useEffect } from 'react';
import { Minus, Square, Copy, X, Columns2 } from 'lucide-react';

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type WindowSnapPreset =
  | 'left'
  | 'right'
  | 'left_narrow'
  | 'right_wide'
  | 'top_left'
  | 'top_right'
  | 'bottom_left'
  | 'bottom_right'
  | 'maximize'
  | 'center';

export const computeSnapBounds = (
  preset: WindowSnapPreset,
  vw: number,
  vh: number
): { bounds: WindowBounds; isMaximized: boolean } => {
  const halfW = Math.floor(vw / 2) - 6;
  const halfH = Math.floor(vh / 2) - 6;

  switch (preset) {
    case 'maximize':
      return {
        isMaximized: true,
        bounds: { x: 0, y: 0, width: vw, height: vh },
      };
    case 'left':
      return {
        isMaximized: false,
        bounds: { x: 4, y: 4, width: halfW, height: vh - 8 },
      };
    case 'right':
      return {
        isMaximized: false,
        bounds: { x: Math.floor(vw / 2) + 2, y: 4, width: halfW, height: vh - 8 },
      };
    case 'left_narrow': {
      const narrowW = Math.max(360, Math.floor(vw * 0.35) - 6);
      return {
        isMaximized: false,
        bounds: { x: 4, y: 4, width: narrowW, height: vh - 8 },
      };
    }
    case 'right_wide': {
      const narrowW = Math.max(360, Math.floor(vw * 0.35));
      const wideW = vw - narrowW - 8;
      return {
        isMaximized: false,
        bounds: { x: narrowW + 4, y: 4, width: wideW, height: vh - 8 },
      };
    }
    case 'top_left':
      return {
        isMaximized: false,
        bounds: { x: 4, y: 4, width: halfW, height: halfH },
      };
    case 'top_right':
      return {
        isMaximized: false,
        bounds: { x: Math.floor(vw / 2) + 2, y: 4, width: halfW, height: halfH },
      };
    case 'bottom_left':
      return {
        isMaximized: false,
        bounds: { x: 4, y: Math.floor(vh / 2) + 2, width: halfW, height: halfH },
      };
    case 'bottom_right':
      return {
        isMaximized: false,
        bounds: { x: Math.floor(vw / 2) + 2, y: Math.floor(vh / 2) + 2, width: halfW, height: halfH },
      };
    case 'center':
    default: {
      const cw = Math.min(1040, vw - 64);
      const ch = Math.min(640, vh - 48);
      return {
        isMaximized: false,
        bounds: {
          x: Math.max(12, Math.round((vw - cw) / 2)),
          y: Math.max(12, Math.round((vh - ch) / 2)),
          width: cw,
          height: ch,
        },
      };
    }
  }
};

interface DesktopWindowProps {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  accentColor?: string;
  isActive: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  bounds: WindowBounds;
  onFocus: () => void;
  onMinimize: () => void;
  onMaximizeToggle: () => void;
  onSnap?: (preset: WindowSnapPreset) => void;
  onClose: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (bounds: WindowBounds) => void;
  children: React.ReactNode;
}

export const DesktopWindow: React.FC<DesktopWindowProps> = ({
  title,
  subtitle,
  icon: Icon,
  accentColor = '#0078D4',
  isActive,
  isMinimized,
  isMaximized,
  zIndex,
  bounds,
  onFocus,
  onMinimize,
  onMaximizeToggle,
  onSnap,
  onClose,
  onMove,
  onResize,
  children,
}) => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [showSnapMenu, setShowSnapMenu] = useState(false);
  const [dragSnapPreview, setDragSnapPreview] = useState<WindowSnapPreset | null>(null);
  const dragSnapRef = useRef<WindowSnapPreset | null>(null);
  const snapTimerRef = useRef<number | null>(null);

  const dragRef = useRef<{
    type: 'move' | 'resize';
    dir?: string;
    startX: number;
    startY: number;
    startBounds: WindowBounds;
  } | null>(null);

  useEffect(() => {
    const handleResizeViewport = () => {
      setIsMobile(window.innerWidth < 768);
      if (!isMaximized && window.innerWidth >= 768) {
        const maxW = window.innerWidth;
        const maxH = window.innerHeight - 48;
        const clampedW = Math.min(bounds.width, Math.max(360, maxW - 16));
        const clampedH = Math.min(bounds.height, Math.max(240, maxH - 16));
        const clampedX = Math.max(0, Math.min(maxW - 120, bounds.x));
        const clampedY = Math.max(0, Math.min(maxH - 48, bounds.y));
        if (
          clampedW !== bounds.width ||
          clampedH !== bounds.height ||
          clampedX !== bounds.x ||
          clampedY !== bounds.y
        ) {
          onResize({ x: clampedX, y: clampedY, width: clampedW, height: clampedH });
        }
      }
    };
    window.addEventListener('resize', handleResizeViewport);
    return () => window.removeEventListener('resize', handleResizeViewport);
  }, [bounds, isMaximized, onResize]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const { type, dir, startX, startY, startBounds } = dragRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const maxW = window.innerWidth;
      const maxH = window.innerHeight - 48;

      if (type === 'move') {
        const nextX = Math.max(-startBounds.width + 120, Math.min(maxW - 120, startBounds.x + dx));
        const nextY = Math.max(0, Math.min(maxH - 40, startBounds.y + dy));
        onMove(nextX, nextY);

        if (onSnap) {
          let nextSnap: WindowSnapPreset | null = null;
          if (e.clientX >= maxW - 18) {
            if (e.clientY <= 110) nextSnap = 'top_right';
            else if (e.clientY >= maxH - 110) nextSnap = 'bottom_right';
            else nextSnap = 'right';
          } else if (e.clientX <= 18) {
            if (e.clientY <= 110) nextSnap = 'top_left';
            else if (e.clientY >= maxH - 110) nextSnap = 'bottom_left';
            else nextSnap = 'left';
          } else if (e.clientY <= 14) {
            nextSnap = 'maximize';
          }
          if (dragSnapRef.current !== nextSnap) {
            dragSnapRef.current = nextSnap;
            setDragSnapPreview(nextSnap);
          }
        }
      } else if (type === 'resize' && dir) {
        const minW = 360;
        const minH = 260;
        let { x, y, width, height } = startBounds;

        if (dir.includes('e')) {
          width = Math.max(minW, Math.min(maxW - x, startBounds.width + dx));
        }
        if (dir.includes('s')) {
          height = Math.max(minH, Math.min(maxH - y, startBounds.height + dy));
        }
        if (dir.includes('w')) {
          const proposedW = startBounds.width - dx;
          if (proposedW >= minW && startBounds.x + dx >= 0) {
            width = proposedW;
            x = startBounds.x + dx;
          }
        }
        if (dir.includes('n')) {
          const proposedH = startBounds.height - dy;
          if (proposedH >= minH && startBounds.y + dy >= 0) {
            height = proposedH;
            y = startBounds.y + dy;
          }
        }

        onResize({ x, y, width, height });
      }
    };

    const handlePointerUp = () => {
      if (dragRef.current) {
        const pendingSnap = dragSnapRef.current;
        dragRef.current = null;
        dragSnapRef.current = null;
        setDragSnapPreview(null);
        document.body.style.userSelect = '';
        if (pendingSnap && onSnap) {
          onSnap(pendingSnap);
        }
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [onMove, onResize, onSnap]);

  const startDrag = (e: React.PointerEvent) => {
    if (isMaximized || isMobile) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    onFocus();
    setShowSnapMenu(false);
    document.body.style.userSelect = 'none';
    dragRef.current = {
      type: 'move',
      startX: e.clientX,
      startY: e.clientY,
      startBounds: { ...bounds },
    };
  };

  const startResize = (dir: string, e: React.PointerEvent) => {
    if (isMaximized || isMobile) return;
    e.preventDefault();
    e.stopPropagation();
    onFocus();
    document.body.style.userSelect = 'none';
    dragRef.current = {
      type: 'resize',
      dir,
      startX: e.clientX,
      startY: e.clientY,
      startBounds: { ...bounds },
    };
  };

  const openSnapHover = () => {
    if (isMobile || !onSnap) return;
    if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
    snapTimerRef.current = window.setTimeout(() => setShowSnapMenu(true), 240);
  };

  const closeSnapHover = () => {
    if (snapTimerRef.current) window.clearTimeout(snapTimerRef.current);
    snapTimerRef.current = window.setTimeout(() => setShowSnapMenu(false), 200);
  };

  const effectiveMaximized = isMaximized || isMobile;

  const containerStyle: React.CSSProperties = effectiveMaximized
    ? {
        top: 0,
        left: 0,
        right: 0,
        bottom: 48,
        zIndex,
      }
    : {
        top: bounds.y,
        left: bounds.x,
        width: bounds.width,
        height: bounds.height,
        zIndex,
      };

  const previewGeometry =
    dragSnapPreview && typeof window !== 'undefined'
      ? computeSnapBounds(dragSnapPreview, window.innerWidth, window.innerHeight - 48).bounds
      : null;

  return (
    <>
      {/* Windows 11 Aero Drag-to-Edge Snap Preview Overlay */}
      {previewGeometry && (
        <div
          style={{
            top: previewGeometry.y,
            left: previewGeometry.x,
            width: previewGeometry.width,
            height: previewGeometry.height,
            zIndex: zIndex - 1,
          }}
          className="fixed rounded-xl bg-[#0078D4]/20 border-2 border-[#0078D4] dark:border-[#60CDFF] backdrop-blur-xs pointer-events-none transition-all duration-100 print:hidden"
        />
      )}

      <section
        aria-label={title}
        onPointerDown={() => {
          if (!isActive) onFocus();
        }}
        style={containerStyle}
        className={`
          fixed flex flex-col overflow-hidden transition-[opacity,transform] duration-150 ease-out
          bg-white/95 dark:bg-[#202020]/95 backdrop-blur-2xl text-slate-900 dark:text-slate-100
          ${effectiveMaximized
            ? 'rounded-none border-0'
            : 'rounded-xl border border-slate-300/80 dark:border-white/12 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.42)]'}
          ${isActive && !effectiveMaximized ? 'ring-1 ring-black/5 dark:ring-white/15' : ''}
          ${isMinimized
            ? 'opacity-0 scale-95 pointer-events-none invisible'
            : 'opacity-100 scale-100 visible pointer-events-auto'}
          print:static print:inset-auto print:w-full print:h-auto print:overflow-visible print:shadow-none print:border-0 print:rounded-none
          ${isActive && !isMinimized ? 'print:block' : 'print:hidden'}
        `}
      >
        {/* Windows 11 Mica Title Bar */}
        <div
          onPointerDown={startDrag}
          onDoubleClick={() => !isMobile && onMaximizeToggle()}
          className={`
            h-9 pr-3 pl-0 flex items-center justify-between gap-3 shrink-0 select-none touch-none border-b print:hidden
            ${isActive
              ? 'bg-[#F3F3F3]/95 dark:bg-[#202020]/95 border-slate-200/80 dark:border-white/8'
              : 'bg-[#F9F9F9]/90 dark:bg-[#191919]/90 border-slate-200/50 dark:border-white/5 text-slate-500'}
            ${!effectiveMaximized ? 'cursor-grab active:cursor-grabbing' : ''}
          `}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className="w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0 shadow-xs"
              style={{ backgroundColor: accentColor }}
            >
              <Icon size={12} />
            </div>
            <span className="text-xs font-semibold truncate">{title}</span>
            {subtitle && (
              <>
                <span className="text-slate-300 dark:text-slate-600 hidden sm:inline" aria-hidden="true">·</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden sm:inline">
                  {subtitle}
                </span>
              </>
            )}
          </div>

          {/* Authentic Windows 11 Caption Buttons + Snap Layouts */}
          <div className="flex items-stretch h-full shrink-0 relative" dir="ltr">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMinimize();
              }}
              className="w-11 h-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-black/6 dark:hover:bg-white/8 transition-colors"
              title="تصغير إلى شريط المهام"
              aria-label="تصغير"
            >
              <Minus size={13} />
            </button>

            {!isMobile && (
              <div
                className="relative h-full flex items-stretch"
                onMouseEnter={openSnapHover}
                onMouseLeave={closeSnapHover}
              >
                {onSnap && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSnapMenu(prev => !prev);
                    }}
                    className={`w-9 h-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-black/6 dark:hover:bg-white/8 transition-colors ${
                      showSnapMenu ? 'bg-black/8 dark:bg-white/12 text-[#0078D4] dark:text-[#60CDFF]' : ''
                    }`}
                    title="تقسيم الشاشة (Snap Layouts)"
                    aria-label="تقسيم الشاشة"
                  >
                    <Columns2 size={12} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSnapMenu(false);
                    onMaximizeToggle();
                  }}
                  className="w-11 h-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-black/6 dark:hover:bg-white/8 transition-colors"
                  title={isMaximized ? 'استعادة الحجم' : 'تكبير (مرّر لاختيار تقسيم الشاشة)'}
                  aria-label={isMaximized ? 'استعادة' : 'تكبير'}
                >
                  {isMaximized ? <Copy size={11} /> : <Square size={11} />}
                </button>

                {/* Windows 11 Snap Layouts Popover */}
                {showSnapMenu && onSnap && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-10 left-0 z-50 w-[264px] bg-white/95 dark:bg-[#2C2C2C]/96 backdrop-blur-2xl border border-slate-200 dark:border-white/12 rounded-2xl shadow-2xl p-3 space-y-2.5"
                    dir="rtl"
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-300 px-0.5">
                      <span>تقسيم الشاشة</span>
                      <span className="text-[10px] font-normal opacity-75">Alt + أسهم</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2" dir="ltr">
                      {/* 1. 50% / 50% Split */}
                      <div className="h-12 rounded-lg border border-slate-200 dark:border-white/15 p-1 flex gap-1 bg-slate-50 dark:bg-white/5">
                        <button
                          type="button"
                          onClick={() => {
                            setShowSnapMenu(false);
                            onSnap('left');
                          }}
                          title="النصف الأيسر (50%)"
                          className="flex-1 rounded-sm bg-slate-300/80 dark:bg-white/15 hover:bg-[#0078D4] transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowSnapMenu(false);
                            onSnap('right');
                          }}
                          title="النصف الأيمن (50%)"
                          className="flex-1 rounded-sm bg-slate-300/80 dark:bg-white/15 hover:bg-[#0078D4] transition-colors"
                        />
                      </div>

                      {/* 2. 65% / 35% Asymmetric Split */}
                      <div className="h-12 rounded-lg border border-slate-200 dark:border-white/15 p-1 flex gap-1 bg-slate-50 dark:bg-white/5">
                        <button
                          type="button"
                          onClick={() => {
                            setShowSnapMenu(false);
                            onSnap('left_narrow');
                          }}
                          title="يسار جانبي (35%)"
                          className="w-[35%] rounded-sm bg-slate-300/80 dark:bg-white/15 hover:bg-[#0078D4] transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowSnapMenu(false);
                            onSnap('right_wide');
                          }}
                          title="يمين رئيسي (65%)"
                          className="flex-1 rounded-sm bg-slate-300/80 dark:bg-white/15 hover:bg-[#0078D4] transition-colors"
                        />
                      </div>

                      {/* 3. 4 Quadrants Split */}
                      <div className="h-12 rounded-lg border border-slate-200 dark:border-white/15 p-1 grid grid-cols-2 grid-rows-2 gap-1 bg-slate-50 dark:bg-white/5">
                        <button
                          type="button"
                          onClick={() => {
                            setShowSnapMenu(false);
                            onSnap('top_left');
                          }}
                          title="الربع العلوي الأيسر"
                          className="rounded-xs bg-slate-300/80 dark:bg-white/15 hover:bg-[#0078D4] transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowSnapMenu(false);
                            onSnap('top_right');
                          }}
                          title="الربع العلوي الأيمن"
                          className="rounded-xs bg-slate-300/80 dark:bg-white/15 hover:bg-[#0078D4] transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowSnapMenu(false);
                            onSnap('bottom_left');
                          }}
                          title="الربع السفلي الأيسر"
                          className="rounded-xs bg-slate-300/80 dark:bg-white/15 hover:bg-[#0078D4] transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setShowSnapMenu(false);
                            onSnap('bottom_right');
                          }}
                          title="الربع السفلي الأيمن"
                          className="rounded-xs bg-slate-300/80 dark:bg-white/15 hover:bg-[#0078D4] transition-colors"
                        />
                      </div>

                      {/* 4. Fullscreen & Center */}
                      <div className="h-12 rounded-lg border border-slate-200 dark:border-white/15 p-1 flex gap-1 bg-slate-50 dark:bg-white/5">
                        <button
                          type="button"
                          onClick={() => {
                            setShowSnapMenu(false);
                            onSnap('maximize');
                          }}
                          title="ملء الشاشة"
                          className="flex-1 rounded-sm bg-slate-300/80 dark:bg-white/15 hover:bg-[#0078D4] transition-colors text-[9px] font-bold text-slate-600 dark:text-slate-200 hover:text-white flex items-center justify-center"
                        >
                          ملء
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowSnapMenu(false);
                            onSnap('center');
                          }}
                          title="توسيط النافذة"
                          className="flex-1 rounded-sm bg-slate-300/80 dark:bg-white/15 hover:bg-[#0078D4] transition-colors text-[9px] font-bold text-slate-600 dark:text-slate-200 hover:text-white flex items-center justify-center"
                        >
                          وسط
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="w-11 h-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-[#C42B1C] hover:text-white transition-colors"
              title="إغلاق"
              aria-label="إغلاق"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Window Content Viewport */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative bg-white dark:bg-[#1C1C1C] custom-scrollbar print:p-0 print:overflow-visible print:h-auto print:block">
          {children}
        </div>

        {/* Resize Handles (Desktop Floating Mode Only) */}
        {!effectiveMaximized && (
          <>
            <div onPointerDown={(e) => startResize('e', e)} className="absolute top-2 bottom-2 right-0 w-1.5 cursor-ew-resize z-30 touch-none print:hidden" />
            <div onPointerDown={(e) => startResize('w', e)} className="absolute top-2 bottom-2 left-0 w-1.5 cursor-ew-resize z-30 touch-none print:hidden" />
            <div onPointerDown={(e) => startResize('s', e)} className="absolute bottom-0 left-2 right-2 h-1.5 cursor-ns-resize z-30 touch-none print:hidden" />
            <div onPointerDown={(e) => startResize('n', e)} className="absolute top-0 left-2 right-2 h-1 cursor-ns-resize z-30 touch-none print:hidden" />
            <div onPointerDown={(e) => startResize('se', e)} className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize z-40 touch-none print:hidden" />
            <div onPointerDown={(e) => startResize('sw', e)} className="absolute bottom-0 left-0 w-3.5 h-3.5 cursor-nesw-resize z-40 touch-none print:hidden" />
            <div onPointerDown={(e) => startResize('ne', e)} className="absolute top-0 right-0 w-3.5 h-3.5 cursor-nesw-resize z-40 touch-none print:hidden" />
            <div onPointerDown={(e) => startResize('nw', e)} className="absolute top-0 left-0 w-3.5 h-3.5 cursor-nwse-resize z-40 touch-none print:hidden" />
          </>
        )}
      </section>
    </>
  );
};
