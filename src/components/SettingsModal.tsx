import React, { useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  Eye,
  Hand,
  RotateCcw,
  Sliders,
  Volume2,
  VolumeX,
  Wind,
  X,
} from 'lucide-react';
import {
  CalibrationSettings as CalibrationSettingsType,
  DEFAULT_CALIBRATION_SETTINGS,
} from '../types/archery';
import { generateCalibrationCSharpSnippet } from '../data/unityScripts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  calibration: CalibrationSettingsType;
  onChangeCalibration: (next: CalibrationSettingsType) => void;
  showTrajectoryArc: boolean;
  onToggleTrajectoryArc: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  windSpeedX: number;
  onCycleWind: () => void;
}

interface CalibrationSettingsSectionProps {
  calibration: CalibrationSettingsType;
  onChangeCalibration: (next: CalibrationSettingsType) => void;
}

/**
 * CalibrationSettings interface section inside the Settings Modal:
 * Adjusts virtual interpupillary distance (IPD), dominant aiming eye,
 * and controller-to-string hand offset with live rig schematic and C# snippet.
 */
export const CalibrationSettings: React.FC<CalibrationSettingsSectionProps> = ({
  calibration,
  onChangeCalibration,
}) => {
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const csharpSnippet = generateCalibrationCSharpSnippet(calibration);
  const ipdNormalized = (calibration.virtualIpdMm - 54) / (74 - 54); // 0..1
  const eyeSpreadPx = 22 + ipdNormalized * 20; // SVG visualization spread

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(csharpSnippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const updateOffset = (axis: 'x' | 'y' | 'z', value: number) => {
    onChangeCalibration({
      ...calibration,
      stringHandOffsetCm: {
        ...calibration.stringHandOffsetCm,
        [axis]: value,
      },
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Left 6 Cols: Interactive Calibration Sliders & Live Rig Schematic */}
      <div className="lg:col-span-6 space-y-5">
        {/* 1. Virtual IPD & Dominant Eye */}
        <div className="bg-[#070B12] border border-white/10 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-sky-400 shrink-0" />
              <h3 className="text-sm font-bold text-white font-display">
                Virtual Interpupillary Distance (IPD)
              </h3>
            </div>
            <span className="text-sm font-mono font-bold text-sky-400 tabular-nums">
              {calibration.virtualIpdMm.toFixed(1)} mm
            </span>
          </div>

          <div>
            <input
              type="range"
              min={54}
              max={74}
              step={0.5}
              value={calibration.virtualIpdMm}
              onChange={(e) =>
                onChangeCalibration({
                  ...calibration,
                  virtualIpdMm: parseFloat(e.target.value),
                })
              }
              aria-label="Virtual Interpupillary Distance in millimeters"
              className="w-full accent-sky-400 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] font-mono text-slate-400 tabular-nums mt-1">
              <span>54.0 mm (Narrow)</span>
              <span>63.0 mm (Quest Default)</span>
              <span>74.0 mm (Wide)</span>
            </div>
          </div>

          {/* Dominant Aiming Eye Selector */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <div>
              <div className="text-xs font-semibold text-slate-200">Dominant Aiming Eye</div>
              <div className="text-[11px] text-slate-400">
                Aligns bow sight pin and stereo convergence vector
              </div>
            </div>
            <div className="flex items-center gap-1 p-1 bg-[#0B101B] border border-white/10 rounded-lg">
              {(['left', 'right'] as const).map((eye) => {
                const active = calibration.dominantEye === eye;
                return (
                  <button
                    key={eye}
                    onClick={() =>
                      onChangeCalibration({
                        ...calibration,
                        dominantEye: eye,
                      })
                    }
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors capitalize cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-sky-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {eye} Eye
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Top-Down Rig & Sight Alignment Schematic */}
          <div className="bg-[#0B101B] border border-white/10 rounded-md p-3">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-2">
              <span>Top-Down Rig Alignment Preview</span>
              <span className="tabular-nums">
                Offset: {((calibration.virtualIpdMm * 0.5 * 0.65) / 10).toFixed(2)} cm{' '}
                {calibration.dominantEye === 'right' ? 'R' : 'L'}
              </span>
            </div>
            <svg
              viewBox="0 0 280 96"
              className="w-full h-24 overflow-visible"
              aria-hidden="true"
            >
              {/* Sight Convergence Line */}
              <line
                x1={calibration.dominantEye === 'right' ? 140 + eyeSpreadPx : 140 - eyeSpreadPx}
                y1="74"
                x2={
                  (calibration.dominantEye === 'right' ? 140 + eyeSpreadPx * 0.65 : 140 - eyeSpreadPx * 0.65) +
                  calibration.stringHandOffsetCm.x * 1.4
                }
                y2="14"
                stroke="#38BDF8"
                strokeWidth="1.5"
                strokeDasharray="4 3"
              />

              {/* Left Eye */}
              <circle
                cx={140 - eyeSpreadPx}
                cy="74"
                r="7"
                fill={calibration.dominantEye === 'left' ? '#38BDF8' : '#1E293B'}
                stroke="#94A3B8"
                strokeWidth="1.5"
              />
              {/* Right Eye */}
              <circle
                cx={140 + eyeSpreadPx}
                cy="74"
                r="7"
                fill={calibration.dominantEye === 'right' ? '#38BDF8' : '#1E293B'}
                stroke="#94A3B8"
                strokeWidth="1.5"
              />

              {/* Bow Riser & Sight Plane */}
              <line x1="92" y1="22" x2="188" y2="22" stroke="#475569" strokeWidth="2" />
              <circle
                cx={
                  (calibration.dominantEye === 'right' ? 140 + eyeSpreadPx * 0.65 : 140 - eyeSpreadPx * 0.65) +
                  calibration.stringHandOffsetCm.x * 1.4
                }
                cy="22"
                r="4"
                fill="#38BDF8"
              />

              {/* Calibrated String Anchor */}
              <circle
                cx={140 + calibration.stringHandOffsetCm.x * 1.6}
                cy={52 - calibration.stringHandOffsetCm.z * 1.2}
                r="4.5"
                fill="#10B981"
              />
              <text
                x="140"
                y="92"
                textAnchor="middle"
                fill="#94A3B8"
                fontSize="9"
                fontFamily="JetBrains Mono, monospace"
              >
                Eyes ({calibration.virtualIpdMm.toFixed(1)}mm) · String Anchor ({calibration.stringHandOffsetCm.x.toFixed(1)}, {calibration.stringHandOffsetCm.y.toFixed(1)}, {calibration.stringHandOffsetCm.z.toFixed(1)} cm)
              </text>
            </svg>
          </div>
        </div>

        {/* 2. Controller-to-String Hand Offset */}
        <div className="bg-[#070B12] border border-white/10 rounded-lg p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hand className="w-4 h-4 text-emerald-400 shrink-0" />
              <h3 className="text-sm font-bold text-white font-display">
                Controller-to-String Hand Offset
              </h3>
            </div>
            <button
              onClick={() => onChangeCalibration(DEFAULT_CALIBRATION_SETTINGS)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-[#0B101B] hover:bg-slate-800 border border-white/10 rounded-md transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Defaults</span>
            </button>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Shifts the virtual nock-grab anchor relative to your Meta Quest Touch controller so your
            drawing hand clears the headset visor and tracking ring cleanly.
          </p>

          {/* X Lateral Offset */}
          <div>
            <div className="flex justify-between text-xs font-mono tabular-nums mb-1">
              <span className="text-slate-300">Lateral Offset (X)</span>
              <span className="text-emerald-400 font-semibold">
                {calibration.stringHandOffsetCm.x >= 0 ? '+' : ''}
                {calibration.stringHandOffsetCm.x.toFixed(1)} cm ({(calibration.stringHandOffsetCm.x / 100).toFixed(3)} m)
              </span>
            </div>
            <input
              type="range"
              min={-8}
              max={8}
              step={0.5}
              value={calibration.stringHandOffsetCm.x}
              onChange={(e) => updateOffset('x', parseFloat(e.target.value))}
              aria-label="String hand lateral X offset"
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>

          {/* Y Vertical Offset */}
          <div>
            <div className="flex justify-between text-xs font-mono tabular-nums mb-1">
              <span className="text-slate-300">Vertical Offset (Y)</span>
              <span className="text-emerald-400 font-semibold">
                {calibration.stringHandOffsetCm.y >= 0 ? '+' : ''}
                {calibration.stringHandOffsetCm.y.toFixed(1)} cm ({(calibration.stringHandOffsetCm.y / 100).toFixed(3)} m)
              </span>
            </div>
            <input
              type="range"
              min={-8}
              max={8}
              step={0.5}
              value={calibration.stringHandOffsetCm.y}
              onChange={(e) => updateOffset('y', parseFloat(e.target.value))}
              aria-label="String hand vertical Y offset"
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>

          {/* Z Depth / Anchor Offset */}
          <div>
            <div className="flex justify-between text-xs font-mono tabular-nums mb-1">
              <span className="text-slate-300">Draw Anchor Depth (Z)</span>
              <span className="text-emerald-400 font-semibold">
                {calibration.stringHandOffsetCm.z >= 0 ? '+' : ''}
                {calibration.stringHandOffsetCm.z.toFixed(1)} cm ({(calibration.stringHandOffsetCm.z / 100).toFixed(3)} m)
              </span>
            </div>
            <input
              type="range"
              min={-10}
              max={10}
              step={0.5}
              value={calibration.stringHandOffsetCm.z}
              onChange={(e) => updateOffset('z', parseFloat(e.target.value))}
              aria-label="String hand depth Z offset"
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Right 6 Cols: Live-Synchronized Unity C# Snippet for VR Player Rig */}
      <div className="lg:col-span-6 flex flex-col bg-[#070B12] border border-white/10 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-[#0E1525] border-b border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <Code2 className="w-4 h-4 text-sky-400 shrink-0" />
            <div className="truncate">
              <div className="text-xs font-mono font-bold text-white truncate">
                VRPlayerRigCalibration.cs
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                Live C# Rig Snippet · Syncs with sliders above
              </div>
            </div>
          </div>

          <button
            onClick={handleCopySnippet}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {copiedSnippet ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Copied Snippet</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-300" />
                <span>Copy C# Snippet</span>
              </>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 max-h-[500px] select-text">
          <pre className="text-[12px] leading-relaxed font-mono text-slate-200 overflow-x-auto">
            <code>{csharpSnippet}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  calibration,
  onChangeCalibration,
  showTrajectoryArc,
  onToggleTrajectoryArc,
  isMuted,
  onToggleMute,
  windSpeedX,
  onCycleWind,
}) => {
  const [activeTab, setActiveTab] = useState<'calibration' | 'range'>('calibration');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/80 pointer-events-auto">
      <div className="w-full max-w-6xl max-h-[88vh] bg-[#0B101B] border border-white/15 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#070B12]">
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5 text-sky-400 shrink-0" />
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white font-display">
                VR Rig Calibration & Simulation Settings
              </h2>
              <p className="text-xs text-slate-400">
                Adjust virtual IPD, controller-to-string hand offsets, and range telemetry options
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-lg transition-colors cursor-pointer"
            aria-label="Close Settings Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-[#0E1525] border-b border-white/10">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('calibration')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'calibration'
                  ? 'bg-sky-400 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Calibration Settings (IPD & String Offset)
            </button>
            <button
              onClick={() => setActiveTab('range')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'range'
                  ? 'bg-sky-400 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Range & Audio Preferences
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs font-mono text-slate-400 tabular-nums">
            <span>IPD {calibration.virtualIpdMm.toFixed(1)}mm</span>
            <span aria-hidden="true">·</span>
            <span>
              String Offset ({calibration.stringHandOffsetCm.x.toFixed(1)},{' '}
              {calibration.stringHandOffsetCm.y.toFixed(1)},{' '}
              {calibration.stringHandOffsetCm.z.toFixed(1)}) cm
            </span>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'calibration' ? (
            <CalibrationSettings
              calibration={calibration}
              onChangeCalibration={onChangeCalibration}
            />
          ) : (
            <div className="max-w-2xl space-y-4">
              <div className="bg-[#070B12] border border-white/10 rounded-lg p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-white">Ballistic Trajectory Preview Arc</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Renders a mass- and gravity-calibrated flight preview while drawing the bow
                  </div>
                </div>
                <button
                  onClick={onToggleTrajectoryArc}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                    showTrajectoryArc
                      ? 'bg-sky-400 text-slate-950 border-sky-400'
                      : 'bg-[#0B101B] text-slate-300 border-white/15 hover:text-white'
                  }`}
                >
                  {showTrajectoryArc ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              <div className="bg-[#070B12] border border-white/10 rounded-lg p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-white">Procedural Web Audio Synthesizer</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Bow creak ticks, string release harmonics, and elemental target impact audio
                  </div>
                </div>
                <button
                  onClick={onToggleMute}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0B101B] hover:bg-slate-800 border border-white/15 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  {isMuted ? (
                    <>
                      <VolumeX className="w-4 h-4 text-rose-400" />
                      <span>Muted</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                      <span>Active</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-[#070B12] border border-white/10 rounded-lg p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-white">Range Crosswind Velocity</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Applies lateral aerodynamic wind drift to arrows in flight
                  </div>
                </div>
                <button
                  onClick={onCycleWind}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-mono font-semibold text-sky-300 bg-[#0B101B] hover:bg-slate-800 border border-white/15 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Wind className="w-4 h-4" />
                  <span>
                    {windSpeedX === 0
                      ? 'Calm 0.0 m/s'
                      : `${windSpeedX > 0 ? '+' : ''}${windSpeedX.toFixed(1)} m/s`}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Action */}
        <div className="px-6 py-3.5 border-t border-white/10 bg-[#070B12] flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            Changes apply immediately to the 3D bow sight and Unity C# snippet
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            Done & Apply
          </button>
        </div>
      </div>
    </div>
  );
};
