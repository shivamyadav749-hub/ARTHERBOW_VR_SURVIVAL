import React, { useEffect, useState } from 'react';
import { Coins, Lock, Play, Star, Swords, Unlock, Wind, X } from 'lucide-react';
import { CAMPAIGN_LEVELS, SEASONS } from '../data/campaignLevels';

export interface LevelProgressRecord {
  bestScore: number;
  stars: number; // 0..3
}

interface LevelSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLevel: number;
  maxUnlockedLevel: number;
  unlockAllLevels: boolean;
  onToggleUnlockAll: () => void;
  progressByLevel: Record<number, LevelProgressRecord>;
  onSelectLevel: (level: number) => void;
}

export const LevelSelectModal: React.FC<LevelSelectModalProps> = ({
  isOpen,
  onClose,
  currentLevel,
  maxUnlockedLevel,
  unlockAllLevels,
  onToggleUnlockAll,
  progressByLevel,
  onSelectLevel,
}) => {
  const activeSeasonId = Math.floor((currentLevel - 1) / 10) + 1;
  const [viewedSeasonId, setViewedSeasonId] = useState<number>(activeSeasonId);

  useEffect(() => {
    if (isOpen) {
      setViewedSeasonId(Math.floor((currentLevel - 1) / 10) + 1);
    }
  }, [isOpen, currentLevel]);

  if (!isOpen) return null;

  const viewedSeason = SEASONS.find((s) => s.id === viewedSeasonId) || SEASONS[0];
  const seasonLevels = CAMPAIGN_LEVELS.filter((lvl) => lvl.seasonId === viewedSeason.id);

  const totalStarsEarned = Object.values(progressByLevel).reduce(
    (sum, rec) => sum + (rec.stars || 0),
    0
  );

  const isSeasonStarUnlocked =
    unlockAllLevels || totalStarsEarned >= viewedSeason.requiredStarsToUnlock;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/80 pointer-events-auto">
      <div className="w-full max-w-5xl max-h-[88vh] bg-[#0B101B] border border-white/15 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-white/10 bg-[#070B12]">
          <div>
            <div className="flex items-center gap-2.5">
              <Swords className="w-5 h-5 text-sky-400 shrink-0" />
              <h2 className="text-lg font-bold tracking-tight text-white font-display">
                5 Seasons · Levels 1–50 Survival Campaign
              </h2>
              <span className="text-xs font-mono text-amber-400 bg-amber-400/10 border border-amber-400/25 px-2 py-0.5 rounded tabular-nums">
                ★ {totalStarsEarned} / 150 Stars
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Earn 3-star HP ratings to unlock new Seasons and face elite shielded Centurions & Javelineers.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onToggleUnlockAll}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                unlockAllLevels
                  ? 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'
                  : 'bg-slate-800 hover:bg-slate-700 border-white/10 text-slate-200'
              }`}
            >
              {unlockAllLevels ? (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>All 50 Unlocked</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Unlock All 50 Levels</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-lg transition-colors cursor-pointer"
              aria-label="Close Season & Level Selector"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 5 Season Tabs with Star Gate Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-6 py-3 bg-[#0E1525] border-b border-white/10">
          {SEASONS.map((season) => {
            const isSelected = season.id === viewedSeason.id;
            const seasonStars = CAMPAIGN_LEVELS.filter((l) => l.seasonId === season.id).reduce(
              (acc, l) => acc + (progressByLevel[l.level]?.stars || 0),
              0
            );
            const unlocked = unlockAllLevels || totalStarsEarned >= season.requiredStarsToUnlock;
            return (
              <button
                key={season.id}
                onClick={() => setViewedSeasonId(season.id)}
                className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#162033] border-sky-400/70 text-white'
                    : 'bg-[#070B12] border-white/10 text-slate-300 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between w-full gap-1 mb-1">
                  <span className="text-[11px] font-mono text-slate-400">
                    S{season.id} · Lv {season.levelRange[0]}–{season.levelRange[1]}
                  </span>
                  <span
                    className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      color: season.accentHex,
                      backgroundColor: season.badgeBgHex,
                    }}
                  >
                    {season.difficulty}
                  </span>
                </div>
                <div className="text-xs font-bold truncate w-full">{season.name}</div>
                <div className="text-[10px] font-mono mt-1 tabular-nums flex items-center justify-between w-full">
                  <span className="text-amber-400">★ {seasonStars}/30</span>
                  {!unlocked && (
                    <span className="text-rose-400 inline-flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" /> {season.requiredStarsToUnlock}★
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Season Banner */}
        <div className="px-6 py-3 bg-[#0B101B] border-b border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2.5">
            <span
              className="w-2.5 h-2.5 rounded-xs shrink-0"
              style={{ backgroundColor: viewedSeason.accentHex }}
            />
            <span className="font-bold text-white">
              Season {viewedSeason.id}: {viewedSeason.name}
            </span>
            <span className="text-slate-400">— {viewedSeason.subtitle}</span>
          </div>
          {!isSeasonStarUnlocked ? (
            <span className="font-mono text-rose-400 font-semibold">
              Requires {viewedSeason.requiredStarsToUnlock} Total Stars ({totalStarsEarned}/
              {viewedSeason.requiredStarsToUnlock})
            </span>
          ) : (
            <span className="font-mono text-slate-400">
              Difficulty:{' '}
              <strong style={{ color: viewedSeason.accentHex }}>{viewedSeason.difficulty}</strong>
            </span>
          )}
        </div>

        {/* 10 Levels Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-[#070B12]">
          {seasonLevels.map((lvl) => {
            const isUnlocked =
              unlockAllLevels || (isSeasonStarUnlocked && lvl.level <= maxUnlockedLevel);
            const isCurrent = lvl.level === currentLevel;
            const rec = progressByLevel[lvl.level];
            const stars = rec?.stars || 0;

            return (
              <button
                key={lvl.level}
                disabled={!isUnlocked}
                onClick={() => {
                  onSelectLevel(lvl.level);
                  onClose();
                }}
                className={`flex flex-col justify-between p-3.5 rounded-xl border text-left transition-all ${
                  !isUnlocked
                    ? 'bg-[#090D16] border-white/5 opacity-55 cursor-not-allowed'
                    : isCurrent
                    ? 'bg-[#162033] border-sky-400 text-white shadow-lg cursor-pointer'
                    : 'bg-[#0B101B] border-white/10 hover:border-sky-400/50 hover:bg-[#111A2B] text-slate-200 cursor-pointer'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-xs font-mono font-bold text-sky-400 tabular-nums">
                      LVL {lvl.level}
                    </span>
                    {!isUnlocked ? (
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                    ) : (
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${
                              s <= stars ? 'text-amber-400 fill-amber-400' : 'text-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-sm font-bold text-white truncate mb-2">{lvl.title}</div>
                </div>

                <div className="space-y-1 text-[11px] font-mono text-slate-400 tabular-nums pt-2 border-t border-white/10">
                  <div className="flex justify-between">
                    <span>Squad</span>
                    <span className="text-white font-semibold">{lvl.enemies.length} Warriors</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Reward</span>
                    <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
                      <Coins className="w-3 h-3" /> +{lvl.coinReward}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Wind</span>
                    <span className="inline-flex items-center gap-1 text-sky-300">
                      <Wind className="w-3 h-3" />
                      {lvl.windSpeedX === 0
                        ? '0.0'
                        : `${lvl.windSpeedX > 0 ? '+' : ''}${lvl.windSpeedX.toFixed(1)}`}
                    </span>
                  </div>
                </div>

                {isUnlocked && (
                  <div className="mt-2.5 flex items-center justify-between text-[11px] font-semibold text-sky-300">
                    <span>{rec?.bestScore ? `Best: ${rec.bestScore}` : 'Ready'}</span>
                    <span className="inline-flex items-center gap-1">
                      <Play className="w-3 h-3 fill-current" /> Fight
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
