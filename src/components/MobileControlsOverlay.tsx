import React, { useEffect, useRef, useState } from 'react';
import { Crosshair, Footprints, RotateCw, Shield, Target, X } from 'lucide-react';
import { MobileControlBridge, MobileControlInput } from '../types/archery';

interface MobileControlsOverlayProps {
  visible: boolean;
  drawPercent: number;
  arrowPrimaryHex: string;
  isCrouched: boolean;
  mobileInputRef: React.MutableRefObject<MobileControlInput>;
  mobileBridgeRef: React.MutableRefObject<MobileControlBridge | null>;
}

const STICK_RADIUS_PX = 46;

export const MobileControlsOverlay: React.FC<MobileControlsOverlayProps> = ({
  visible,
  drawPercent,
  arrowPrimaryHex,
  isCrouched,
  mobileInputRef,
  mobileBridgeRef,
}) => {
  const [stickOffset, setStickOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [sprintLocked, setSprintLocked] = useState<boolean>(false);
  const [isAutoSprinting, setIsAutoSprinting] = useState<boolean>(false);
  const [isDrawHeld, setIsDrawHeld] = useState<boolean>(false);

  const stickZoneRef = useRef<HTMLDivElement | null>(null);
  const stickPointerIdRef = useRef<number | null>(null);
  const stickCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const drawPointerIdRef = useRef<number | null>(null);
  const drawLastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (!visible) {
      stickPointerIdRef.current = null;
      drawPointerIdRef.current = null;
      mobileInputRef.current.moveX = 0;
      mobileInputRef.current.moveY = 0;
      setStickOffset({ x: 0, y: 0 });
      setIsAutoSprinting(false);
      setIsDrawHeld(false);
    }
  }, [visible, mobileInputRef]);

  if (!visible) return null;

  const updateJoystickFromClient = (clientX: number, clientY: number) => {
    const dx = clientX - stickCenterRef.current.x;
    const dy = clientY - stickCenterRef.current.y;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, STICK_RADIUS_PX);
    const angle = Math.atan2(dy, dx);

    const clampedX = Math.cos(angle) * clampedDist;
    const clampedY = Math.sin(angle) * clampedDist;

    const normX = clampedX / STICK_RADIUS_PX;
    const normY = -clampedY / STICK_RADIUS_PX; // +1 is up/forward

    // Deadzone 12%
    const mag = Math.hypot(normX, normY);
    if (mag < 0.12) {
      mobileInputRef.current.moveX = 0;
      mobileInputRef.current.moveY = 0;
      setIsAutoSprinting(false);
    } else {
      mobileInputRef.current.moveX = normX;
      mobileInputRef.current.moveY = normY;
      setIsAutoSprinting(mag >= 0.82 && !isCrouched);
    }

    setStickOffset({ x: clampedX, y: clampedY });
  };

  const resetJoystick = () => {
    stickPointerIdRef.current = null;
    mobileInputRef.current.moveX = 0;
    mobileInputRef.current.moveY = 0;
    setStickOffset({ x: 0, y: 0 });
    setIsAutoSprinting(false);
  };

  const handleStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (stickPointerIdRef.current !== null) return;

    const rect = stickZoneRef.current?.getBoundingClientRect();
    if (!rect) return;
    stickCenterRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    stickPointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateJoystickFromClient(e.clientX, e.clientY);
  };

  const handleStickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    e.preventDefault();
    updateJoystickFromClient(e.clientX, e.clientY);
  };

  const handleStickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    resetJoystick();
  };

  const handleToggleSprintLock = (e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
    setSprintLocked((prev) => {
      const next = !prev;
      mobileInputRef.current.sprintLocked = next;
      return next;
    });
  };

  const handleDrawPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (drawPointerIdRef.current !== null) return;

    drawPointerIdRef.current = e.pointerId;
    drawLastPosRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawHeld(true);
    mobileBridgeRef.current?.startDraw();
  };

  const handleDrawPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (drawPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    e.preventDefault();
    const dx = e.clientX - drawLastPosRef.current.x;
    const dy = e.clientY - drawLastPosRef.current.y;
    drawLastPosRef.current = { x: e.clientX, y: e.clientY };
    mobileBridgeRef.current?.addLookDelta(dx, dy);
  };

  const handleDrawPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (drawPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    drawPointerIdRef.current = null;
    setIsDrawHeld(false);
    mobileBridgeRef.current?.releaseDraw(false);
  };

  const handleDrawPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (drawPointerIdRef.current !== e.pointerId) return;
    e.stopPropagation();
    drawPointerIdRef.current = null;
    setIsDrawHeld(false);
    mobileBridgeRef.current?.releaseDraw(true);
  };

  const handleCancelShot = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    drawPointerIdRef.current = null;
    setIsDrawHeld(false);
    mobileBridgeRef.current?.releaseDraw(true);
  };

  const ringRadius = 35;
  const ringCirc = 2 * Math.PI * ringRadius;
  const clampedDraw = Math.max(0, Math.min(100, drawPercent));
  const ringOffset = ringCirc * (1 - clampedDraw / 100);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-20 pointer-events-none flex items-end justify-between px-3 sm:px-6 pb-3 sm:pb-5"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {/* LEFT THUMB ZONE: Sprint Lock + Virtual Movement Joystick */}
      <div className="flex flex-col items-start gap-2 pointer-events-auto touch-none">
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onClick={handleToggleSprintLock}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11px] font-mono font-bold transition-colors cursor-pointer ${
            sprintLocked || isAutoSprinting
              ? 'bg-sky-500/25 border-sky-400 text-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.3)]'
              : 'bg-[#0B101B]/85 border-white/15 text-slate-300'
          }`}
        >
          <Footprints className="w-3.5 h-3.5" />
          <span>{sprintLocked ? 'SPRINT ON' : isAutoSprinting ? 'SPRINTING' : 'SPRINT'}</span>
        </button>

        {/* Analog Stick Ring */}
        <div
          ref={stickZoneRef}
          onPointerDown={handleStickPointerDown}
          onPointerMove={handleStickPointerMove}
          onPointerUp={handleStickPointerUp}
          onPointerCancel={handleStickPointerUp}
          aria-label="Virtual Movement Joystick"
          className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 backdrop-blur-sm flex items-center justify-center touch-none select-none transition-colors ${
            isAutoSprinting || sprintLocked
              ? 'bg-sky-950/35 border-sky-400/60'
              : 'bg-[#0B101B]/65 border-white/20'
          }`}
        >
          {/* Crosshair guide lines */}
          <div className="absolute inset-x-5 h-px bg-white/10 pointer-events-none" />
          <div className="absolute inset-y-5 w-px bg-white/10 pointer-events-none" />
          <div className="absolute inset-3 rounded-full border border-dashed border-white/10 pointer-events-none" />

          {/* Draggable Thumb Puck */}
          <div
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 shadow-lg flex items-center justify-center pointer-events-none ${
              isAutoSprinting || sprintLocked
                ? 'bg-sky-400/35 border-sky-300'
                : 'bg-slate-200/20 border-white/60'
            }`}
            style={{
              transform: `translate3d(${stickOffset.x}px, ${stickOffset.y}px, 0)`,
            }}
          >
            <div className="w-3.5 h-3.5 rounded-full bg-white/80" />
          </div>
        </div>
      </div>

      {/* RIGHT THUMB ZONE: Crouch + Recenter + Hold-to-Draw Trigger */}
      <div className="flex items-end gap-2.5 sm:gap-3 pointer-events-auto touch-none">
        {/* Stacked Utility Tactile Buttons */}
        <div className="flex flex-col items-end gap-2">
          {isDrawHeld && (
            <button
              type="button"
              onPointerDown={handleCancelShot}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-rose-950/90 border border-rose-400/60 text-rose-200 text-[11px] font-mono font-bold shadow-lg cursor-pointer"
              aria-label="Cancel Arrow Shot"
            >
              <X className="w-3.5 h-3.5" />
              <span>CANCEL</span>
            </button>
          )}

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              mobileBridgeRef.current?.recenterAim();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#0B101B]/85 border border-white/15 text-slate-200 text-[11px] font-mono font-semibold cursor-pointer active:scale-95"
            aria-label="Center Camera Forward"
          >
            <RotateCw className="w-3.5 h-3.5 text-sky-400" />
            <span>CENTER</span>
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              mobileBridgeRef.current?.toggleCrouch();
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-mono font-bold transition-colors cursor-pointer active:scale-95 ${
              isCrouched
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : 'bg-[#0B101B]/85 border-white/20 text-slate-200'
            }`}
            aria-label="Toggle Crouch and Cover Hide"
          >
            <Shield className="w-4 h-4" />
            <span>{isCrouched ? 'CROUCHED' : 'CROUCH'}</span>
          </button>
        </div>

        {/* Large Hold-to-Draw & Release-to-Fire Trigger Button */}
        <button
          type="button"
          onPointerDown={handleDrawPointerDown}
          onPointerMove={handleDrawPointerMove}
          onPointerUp={handleDrawPointerUp}
          onPointerCancel={handleDrawPointerCancel}
          aria-label="Hold to Draw Bow and Release to Shoot"
          className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 flex flex-col items-center justify-center touch-none select-none transition-transform cursor-pointer shadow-2xl ${
            isDrawHeld
              ? 'scale-95 bg-slate-900/90 border-white/40'
              : 'bg-[#0B101B]/85 border-white/25 active:scale-95'
          }`}
        >
          {/* Circular Draw Progress Ring */}
          <svg
            viewBox="0 0 80 80"
            className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
          >
            <circle
              cx="40"
              cy="40"
              r={ringRadius}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="4"
            />
            {clampedDraw > 0 && (
              <circle
                cx="40"
                cy="40"
                r={ringRadius}
                fill="none"
                stroke={arrowPrimaryHex}
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeDasharray={ringCirc}
                strokeDashoffset={ringOffset}
              />
            )}
          </svg>

          {isDrawHeld ? (
            <>
              <Target className="w-6 h-6 text-white mb-0.5 pointer-events-none" />
              <span className="text-[11px] font-mono font-bold text-white tabular-nums pointer-events-none">
                {clampedDraw}%
              </span>
            </>
          ) : (
            <>
              <Crosshair className="w-6 h-6 text-sky-400 mb-0.5 pointer-events-none" />
              <span className="text-[10px] font-mono font-bold text-slate-200 tracking-wide pointer-events-none">
                HOLD DRAW
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
