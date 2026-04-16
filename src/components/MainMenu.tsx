/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import {
  Users,
  Sword,
  ShoppingBag,
  Globe,
  Settings,
  Trophy,
  Coins,
  Star,
  MessageCircle,
  Heart,
  Zap,
  Wifi,
  Menu as MenuIcon
} from 'lucide-react';
import { Monster } from '../types';

interface MainMenuProps {
  onStartBattle: () => void;
  onOpenCharacters: () => void;
  onOpenShop: () => void;
  onOpenWorld: () => void;
  onOpenOnline: () => void;
  onStartRandomBattle: () => void;
  equippedMonster: Monster | null;
  hearts: number;
  winStreak: number;
}

export default function MainMenu({ onStartBattle, onOpenCharacters, onOpenShop, onOpenWorld, onOpenOnline, onStartRandomBattle, equippedMonster, hearts, winStreak }: MainMenuProps) {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-600 to-indigo-900 text-white flex flex-col font-sans overflow-hidden">
      {/* Top Bar */}
      <div className="p-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <Heart size={16} className="text-red-500 fill-red-500" />
            <span className="font-black text-sm">{hearts}</span>
          </div>
          <div className="flex items-center gap-2 bg-black/30 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
            <Coins size={16} className="text-yellow-400" />
            <span className="font-black text-sm">5,000</span>
          </div>
          {winStreak > 0 && (
            <div className="flex items-center gap-2 bg-orange-500/50 backdrop-blur-md px-3 py-1 rounded-full border border-orange-400/30">
              <Zap size={12} className="text-yellow-400 fill-yellow-400" />
              <span className="text-[10px] font-black uppercase">{winStreak}連勝中!</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <button className="p-2 bg-black/30 backdrop-blur-md rounded-xl border border-white/10">
            <MessageCircle size={24} />
          </button>
          <button className="p-2 bg-black/30 backdrop-blur-md rounded-xl border border-white/10">
            <MenuIcon size={24} />
          </button>
        </div>
      </div>

      {/* Main Character Display (Center) */}
      <div className="flex-1 relative flex flex-col items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
          <div className="w-[800px] h-[800px] bg-white rounded-full blur-[100px]" />
        </div>

        <motion.div
          animate={{
            y: [0, -15, 0],
            rotate: [-1, 1, -1]
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="relative z-10"
        >
          <div
            className="w-64 h-64 rounded-full flex items-center justify-center border-4 border-white/10"
            style={{ backgroundColor: equippedMonster ? `${equippedMonster.color}20` : 'rgba(255,255,255,0.05)' }}
          >
            <div className="text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">
              {equippedMonster
                ? <Sword size={180} style={{ color: equippedMonster.color }} />
                : <Sword size={180} className="opacity-20" />
              }
            </div>
          </div>
        </motion.div>

        <div className="mt-8 text-center z-10">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Star size={16} className="text-yellow-400 fill-yellow-400" />
            <h2 className="text-3xl font-black italic uppercase tracking-tighter">
              {equippedMonster ? equippedMonster.name : 'キャラクターなし'}
            </h2>
          </div>
          <div className="bg-black/40 backdrop-blur-md px-6 py-1 rounded-full border border-white/10 inline-block">
            <p className="text-xs font-bold uppercase tracking-widest opacity-80">
              {equippedMonster ? 'パワー 11' : 'キャラクターを追加してください'}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Controls (Brawl Stars Style) */}
      <div className="p-6 flex items-end justify-between z-20">
        {/* Left Side: Character, Shop, World */}
        <div className="flex items-center gap-3">
          <MenuButton 
            icon={<Users size={24} />} 
            label="キャラクター" 
            color="bg-blue-500" 
            onClick={onOpenCharacters} 
          />
          <MenuButton 
            icon={<ShoppingBag size={24} />} 
            label="ショップ" 
            color="bg-yellow-500" 
            onClick={onOpenShop} 
          />
          <MenuButton
            icon={<Globe size={24} />}
            label="ワールドバトル"
            color="bg-green-500"
            onClick={onOpenWorld}
          />
          <MenuButton
            icon={<Wifi size={24} />}
            label="オンライン"
            color="bg-purple-500"
            onClick={onOpenOnline}
          />
        </div>

        {/* Right Side: Random Battle */}
        <button
          onClick={onStartRandomBattle}
          className="group relative"
        >
          <div className="absolute inset-0 bg-yellow-400 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
          <div className="relative bg-gradient-to-b from-yellow-400 to-orange-600 px-12 py-6 rounded-3xl border-b-8 border-orange-800 shadow-2xl active:translate-y-1 active:border-b-4 transition-all">
            <div className="flex flex-col items-center">
              <span className="text-3xl font-black italic uppercase tracking-tighter text-white drop-shadow-md">バトル</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-orange-900 mt-1">オンライン対戦</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

function MenuButton({ icon, label, color, onClick }: { icon: React.ReactNode, label: string, color: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center gap-2 group"
    >
      <div className={`w-16 h-16 ${color} rounded-2xl flex items-center justify-center border-b-4 border-black/20 shadow-lg group-active:translate-y-0.5 group-active:border-b-2 transition-all`}>
        {icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-tighter text-white/80">{label}</span>
    </button>
  );
}
