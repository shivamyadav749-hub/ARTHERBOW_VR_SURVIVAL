import React from 'react';
import { Check, Coins, Heart, Shield, Sparkles, X } from 'lucide-react';
import {
  ANCIENT_ARMOR_ITEMS,
  ANCIENT_HELMET_ITEMS,
  computePlayerDefenseStats,
} from '../data/armoryData';
import { ArmorGearItem } from '../types/archery';

interface ArmoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  coins: number;
  ownedGearIds: string[];
  equippedArmorId: string;
  equippedHelmetId: string;
  onPurchaseAndEquip: (item: ArmorGearItem) => void;
  onEquip: (item: ArmorGearItem) => void;
}

export const ArmoryModal: React.FC<ArmoryModalProps> = ({
  isOpen,
  onClose,
  coins,
  ownedGearIds,
  equippedArmorId,
  equippedHelmetId,
  onPurchaseAndEquip,
  onEquip,
}) => {
  if (!isOpen) return null;

  const stats = computePlayerDefenseStats(equippedArmorId, equippedHelmetId);

  const renderGearSection = (title: string, items: ArmorGearItem[], equippedId: string) => (
    <div>
      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 mb-3">
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item) => {
          const isOwned = ownedGearIds.includes(item.id) || item.costCoins === 0;
          const isEquipped = item.id === equippedId;
          const canAfford = coins >= item.costCoins;

          return (
            <div
              key={item.id}
              className={`flex flex-col justify-between p-4 rounded-xl border transition-colors ${
                isEquipped
                  ? 'bg-[#162033] border-amber-400/70 shadow-lg'
                  : 'bg-[#070B12] border-white/10 hover:border-white/25'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Two-tone Ancient Metal Swatch */}
                    <div className="w-8 h-8 rounded-lg border border-white/15 shrink-0 flex overflow-hidden">
                      <div
                        className="w-1/2 h-full"
                        style={{ backgroundColor: item.primaryHex }}
                      />
                      <div
                        className="w-1/2 h-full"
                        style={{ backgroundColor: item.trimHex }}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">{item.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">{item.eraLabel}</div>
                    </div>
                  </div>
                  {isEquipped && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-300 bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 rounded shrink-0">
                      <Check className="w-3 h-3" /> Equipped
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 leading-relaxed mb-3">{item.description}</p>
              </div>

              <div className="space-y-3 pt-2.5 border-t border-white/10">
                <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                  <span className="text-emerald-400">+{item.bonusMaxHp} Max HP</span>
                  <span className="text-sky-300">-{item.damageReductionPct}% Incoming DMG</span>
                </div>

                {isEquipped ? (
                  <button
                    disabled
                    className="w-full py-2 px-3 text-xs font-semibold text-amber-300 bg-amber-500/10 border border-amber-400/30 rounded-lg cursor-default"
                  >
                    Active in Combat & Bow Trim
                  </button>
                ) : isOwned ? (
                  <button
                    onClick={() => onEquip(item)}
                    className="w-full py-2 px-3 text-xs font-bold text-slate-950 bg-sky-400 hover:bg-sky-300 rounded-lg transition-colors cursor-pointer"
                  >
                    Equip {item.slot === 'armor' ? 'Armor' : 'Helmet'}
                  </button>
                ) : (
                  <button
                    disabled={!canAfford}
                    onClick={() => onPurchaseAndEquip(item)}
                    className={`w-full py-2 px-3 flex items-center justify-center gap-1.5 text-xs font-bold rounded-lg transition-colors ${
                      canAfford
                        ? 'text-slate-950 bg-amber-400 hover:bg-amber-300 cursor-pointer'
                        : 'text-slate-500 bg-slate-900 border border-white/5 cursor-not-allowed'
                    }`}
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>
                      {canAfford
                        ? `Forge & Equip (${item.costCoins} Coins)`
                        : `Need ${item.costCoins} Coins`}
                    </span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/80 pointer-events-auto">
      <div className="w-full max-w-5xl max-h-[88vh] bg-[#0B101B] border border-white/15 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-white/10 bg-[#070B12]">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white font-display">
                Ancient Armory · Armor & Helmet Forging
              </h2>
              <p className="text-xs text-slate-400">
                Spend Coins earned from surviving waves & critical headshots to upgrade HP, mitigation, and your 3D bow gauntlet trim.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0B101B] border border-amber-400/35 text-xs font-mono font-bold text-amber-300 tabular-nums">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>{coins.toLocaleString()} Coins</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 border border-white/10 rounded-lg transition-colors cursor-pointer"
              aria-label="Close Ancient Armory"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Equipped Loadout Summary Banner */}
        <div className="px-6 py-3 bg-[#0E1525] border-b border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs font-mono tabular-nums">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold">
              <Heart className="w-3.5 h-3.5" /> Total Max HP: {stats.maxHp}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sky-300 font-bold">
              <Shield className="w-3.5 h-3.5" /> Armor Mitigation: {stats.damageReductionPct}%
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>
              Equipped: {stats.armor.name} + {stats.helmet.name}
            </span>
          </div>
        </div>

        {/* Gear Catalog */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#0B101B]">
          {renderGearSection('1. Ancient Battle Armor (Cuirass & Gauntlets)', ANCIENT_ARMOR_ITEMS, equippedArmorId)}
          {renderGearSection('2. Ancient Helmets & War Crests', ANCIENT_HELMET_ITEMS, equippedHelmetId)}
        </div>
      </div>
    </div>
  );
};
