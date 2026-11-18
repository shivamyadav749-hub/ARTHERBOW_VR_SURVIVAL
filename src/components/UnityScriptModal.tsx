import React, { useState } from 'react';
import { Check, Code2, Copy, Download, Sliders, X } from 'lucide-react';
import { UNITY_CSHARP_SCRIPTS } from '../data/unityScripts';
import { ARROW_TYPE_LIST, ARROW_TYPES, ArrowTypeId } from '../types/archery';

interface UnityScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedArrowType: ArrowTypeId;
  onSelectArrowType: (type: ArrowTypeId) => void;
}

export const UnityScriptModal: React.FC<UnityScriptModalProps> = ({
  isOpen,
  onClose,
  selectedArrowType,
  onSelectArrowType,
}) => {
  const [activeTabId, setActiveTabId] = useState<string>(UNITY_CSHARP_SCRIPTS[0].id);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeScript =
    UNITY_CSHARP_SCRIPTS.find((s) => s.id === activeTabId) || UNITY_CSHARP_SCRIPTS[0];
  const activeArrowCfg = ARROW_TYPES[selectedArrowType];

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadScript = () => {
    const blob = new Blob([activeScript.code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeScript.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-8 bg-black/80 pointer-events-auto">
      <div className="w-full max-w-6xl h-[92dvh] sm:h-[86vh] bg-[#0B101B] border border-white/15 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-[#070B12]">
          <div className="flex items-center gap-2.5 min-w-0">
            <Code2 className="w-5 h-5 text-sky-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm sm:text-lg font-bold tracking-tight text-white font-display truncate">
                Unity Meta Quest VR C# Architecture & ScriptableObject Suite
              </h2>
              <p className="hidden sm:block text-xs text-slate-400">
                Meta XR Interaction SDK · Continuous Raycast Ballistics · Polymorphic Arrow Payloads
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleCopyCode(activeScript.code, activeScript.id)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedId === activeScript.id ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-300" />
                  <span>Copy {activeScript.fileName}</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadScript}
              className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-300" />
              <span className="hidden sm:inline">Download .cs</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-lg transition-colors cursor-pointer"
              aria-label="Close Unity C# Inspector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Script File Selector Tabs */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-[#0E1525] border-b border-white/10 overflow-x-auto shrink-0">
          <div className="flex items-center gap-1.5">
            {UNITY_CSHARP_SCRIPTS.map((script) => {
              const isActive = script.id === activeTabId;
              return (
                <button
                  key={script.id}
                  onClick={() => setActiveTabId(script.id)}
                  className={`px-3.5 py-1.5 text-xs font-mono font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {script.fileName}
                </button>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 font-mono whitespace-nowrap">
            <span>Unity 6 / 2022 LTS</span>
            <span aria-hidden="true">·</span>
            <span>UnityEngine.XR</span>
            <span aria-hidden="true">·</span>
            <span>Meta Quest 2 / 3 / 3S</span>
          </div>
        </div>

        {/* Main Split Body: Left C# Code Editor + Right ScriptableObject Inspector */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-y-auto lg:overflow-hidden">
          {/* Left 8 Cols: C# Source Code & Implementation Notes */}
          <div className="lg:col-span-8 flex flex-col min-h-[48dvh] lg:min-h-0 lg:border-r border-b lg:border-b-0 border-white/10">
            <div className="px-4 sm:px-6 py-3 sm:py-3.5 bg-[#0F172A] border-b border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-mono font-semibold text-sky-400">
                  {activeScript.className}
                </span>
                <span className="text-xs text-slate-400">
                  {activeScript.roleSummary}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
                {activeScript.keyHighlights.map((hl, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5">
                    <span className="text-sky-400">•</span>
                    <span>{hl}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#070B12] select-text">
              <pre className="text-xs md:text-[13px] leading-relaxed font-mono text-slate-200 overflow-x-auto">
                <code>{activeScript.code}</code>
              </pre>
            </div>
          </div>

          {/* Right 4 Cols: Live ArrowTypeData ScriptableObject Inspector */}
          <div className="lg:col-span-4 flex flex-col min-h-0 bg-[#0B101B] lg:overflow-y-auto p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sliders className="w-4 h-4 text-sky-400 shrink-0" />
              <h3 className="text-sm font-bold text-white font-display">
                Live ArrowTypeData Asset Inspector
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Select an arrow archetype below to inspect its serialized{' '}
              <code className="text-slate-200">ArrowTypeData</code> fields and test it live in the 3D range.
            </p>

            {/* Arrow Preset Selector */}
            <div className="grid grid-cols-1 gap-1.5 mb-5">
              {ARROW_TYPE_LIST.map((arr) => {
                const isSelected = arr.id === selectedArrowType;
                return (
                  <button
                    key={arr.id}
                    onClick={() => onSelectArrowType(arr.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-left border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800/90 border-sky-400/60 text-white'
                        : 'bg-[#070B12] border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-sm shrink-0"
                        style={{ backgroundColor: arr.primaryHex }}
                      />
                      <span className="text-xs font-semibold truncate">{arr.name}</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                      Key [{arr.hotkey}]
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Serialized Fields Table */}
            <div className="bg-[#070B12] border border-white/10 rounded-lg p-4 space-y-3 text-xs">
              <div className="pb-2 border-b border-white/10">
                <div className="text-[11px] font-mono text-slate-400">
                  {activeArrowCfg.unityEnumName}
                </div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {activeArrowCfg.name}
                </div>
                <div className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {activeArrowCfg.description}
                </div>
              </div>

              <div className="space-y-2 font-mono tabular-nums">
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">baseDamage</span>
                  <span className="text-white font-semibold">{activeArrowCfg.baseDamage}.0f</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">mass (Rigidbody)</span>
                  <span className="text-white font-semibold">{activeArrowCfg.mass.toFixed(2)} kg</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">muzzleVelocity</span>
                  <span className="text-white font-semibold">{activeArrowCfg.muzzleVelocity}.0 m/s</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">gravityMultiplier</span>
                  <span className="text-white font-semibold">{activeArrowCfg.gravityMultiplier.toFixed(2)}x</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">dragCoefficient</span>
                  <span className="text-white font-semibold">{activeArrowCfg.dragCoefficient}f</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400">ringScoreMultiplier</span>
                  <span className="text-white font-semibold">{activeArrowCfg.scoreMultiplier.toFixed(2)}x</span>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10">
                <div className="text-[11px] font-semibold text-slate-300 mb-1">
                  Special Impact Ability Logic
                </div>
                <div className="text-xs text-sky-300 font-medium">
                  {activeArrowCfg.specialAbilityLabel}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
