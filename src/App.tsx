/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, 
  ChevronLeft, 
  Home, 
  ShoppingBag, 
  Users, 
  Gamepad2, 
  BookOpen, 
  Zap, 
  Shield, 
  Sword,
  Search,
  ArrowRightLeft,
  X
} from 'lucide-react';

// --- Types & Data ---

type Screen = 'home' | 'shop' | 'characters' | 'detail' | 'matching' | 'result';

interface Character {
  id: string;
  name: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary';
  description: string;
  history: string;
  level: number;
  hearts: number;
  hp: number;
  attack: number;
  ultimate: number;
  skins: string[]; // skin IDs
  isHypercharge?: boolean;
}

interface Skin {
  id: string;
  charId: string;
  name: string;
  priceBurgers: number;
  priceHearts: number;
  timeLeft?: string;
  image: string;
}

interface GameMode {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const INITIAL_CHARACTERS: Character[] = [];

const SKINS: Skin[] = [];

const MODES: GameMode[] = [];

// --- Components ---

const Button = ({ children, onClick, className = '', variant = 'primary' }: { children: React.ReactNode, onClick?: () => void, className?: string, variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'play' }) => {
  const variants = {
    primary: 'bg-accent-pink border-b-4 border-[#A00090] text-white btn-pop-shadow',
    secondary: 'bg-accent-cyan border-b-4 border-[#00A0AA] text-bg-deep btn-pop-shadow',
    danger: 'bg-red-600 border-b-4 border-red-800 text-white btn-pop-shadow',
    ghost: 'bg-white/10 border-b-4 border-white/20 text-white backdrop-blur-sm btn-pop-shadow',
    play: 'bg-gradient-to-b from-accent-yellow to-burger border-b-6 border-[#884400] text-[#442200] btn-pop-shadow',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98, translateY: 2 }}
      onClick={onClick}
      className={`px-6 py-3 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${variants[variant]} ${className}`}
    >
      {children}
    </motion.button>
  );
};

const CurrencyBadge = ({ icon, value, className = '' }: { icon: string, value: string | number, className?: string }) => (
  <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border-2 border-white/10 bg-black/40 font-bold text-white shadow-inner backdrop-blur-md ${className}`}>
    <span className="text-xl">{icon}</span>
    <span>{value}</span>
  </div>
);

export default function App() {
  const [activeScreen, setActiveScreen] = useState<Screen>('home');
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [selectedModeId, setSelectedModeId] = useState<string | null>(null);
  const [burgers, setBurgers] = useState(100);
  const [hearts, setHearts] = useState(10);

  const selectedChar = useMemo(() => INITIAL_CHARACTERS.find(c => c.id === selectedCharId) ?? null, [selectedCharId]);
  const selectedMode = useMemo(() => MODES.find(m => m.id === selectedModeId) ?? null, [selectedModeId]);

  const goTo = (screen: Screen) => setActiveScreen(screen);

  return (
    <div className="fixed inset-0 bg-game-radial text-white font-sans overflow-hidden select-none">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

      {/* Screen Container */}
      <AnimatePresence mode="wait">
        {activeScreen === 'home' && (
          <HomeScreen 
            key="home" 
            onGoTo={goTo} 
            burgers={burgers} 
            hearts={hearts} 
            selectedChar={selectedChar}
            selectedMode={selectedMode}
            selectedModeId={selectedModeId}
            onSelectMode={(id: string) => setSelectedModeId(id)}
          />
        )}
        {activeScreen === 'shop' && (
          <ShopScreen key="shop" onBack={() => goTo('home')} burgers={burgers} hearts={hearts} />
        )}
        {activeScreen === 'characters' && (
          <CharacterSelectScreen 
            key="chars" 
            onBack={() => goTo('home')} 
            onSelect={(id) => { setSelectedCharId(id); goTo('detail'); }}
            characters={INITIAL_CHARACTERS}
          />
        )}
        {activeScreen === 'detail' && (
          <CharacterDetailScreen 
            key="detail" 
            onBack={() => goTo('characters')} 
            character={selectedChar}
            onSelect={() => goTo('home')}
          />
        )}
        {activeScreen === 'matching' && (
          <MatchingScreen 
            key="matching" 
            onCancel={() => goTo('home')} 
            mode={selectedMode}
            onFinish={() => goTo('result')}
          />
        )}
        {activeScreen === 'result' && (
          <ResultScreen 
            key="result" 
            onHome={() => goTo('home')} 
            character={selectedChar}
          />
        )}
      </AnimatePresence>

      {/* Admin Note (Visible in Code) */}
      {/* 
        ADMIN NOTE: 
        To change prices or add content, modify the INITIAL_CHARACTERS, SKINS, or MODES arrays.
        In a real app, these would be fetched from a backend.
      */}
    </div>
  );
}

// --- Screen Components ---

function HomeScreen({ onGoTo, burgers, hearts, selectedChar, selectedMode, selectedModeId, onSelectMode }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="relative w-full h-full flex flex-col p-6"
    >
      {/* Top Bar - Removed as requested */}
      <div className="flex justify-between items-start opacity-0 pointer-events-none h-0 overflow-hidden">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 bg-black/30 p-2 pr-6 rounded-full border border-white/10">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-2xl shadow-lg border-2 border-white/20">
              👤
            </div>
            <div>
              <div className="font-bold text-sm opacity-70">PlayerName</div>
              <div className="font-black text-xl flex items-center gap-1">
                <span className="text-pink-400">♡</span> {hearts}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <CurrencyBadge icon="🍔" value={burgers} />
          <button className="p-2 bg-white/10 rounded-xl border border-white/20 hover:bg-white/20 transition-colors">
            <Settings size={24} />
          </button>
        </div>
      </div>

      {/* Center Content */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Character Preview */}
        <motion.div 
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="relative z-10"
        >
          <div className="text-9xl drop-shadow-[0_20px_20px_rgba(0,0,0,0.5)]">
            {selectedChar ? (SKINS.find(s => s.charId === selectedChar.id)?.image || '❓') : '❓'}
          </div>
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-black/40 blur-xl rounded-full" />
        </motion.div>

        {/* Side Buttons (Left) */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-4">
          <SideButton icon={<ShoppingBag />} label="ショップ" onClick={() => onGoTo('shop')} color="border-accent-pink text-accent-pink" />
          <SideButton icon={<Users />} label="キャラ" onClick={() => onGoTo('characters')} color="border-accent-cyan text-accent-cyan" />
          <SideButton icon={<Zap />} label="スキン" onClick={() => onGoTo('shop')} color="border-accent-yellow text-accent-yellow" />
          <SideButton icon={<Gamepad2 />} label="ストア" onClick={() => onGoTo('shop')} color="border-accent-cyan text-accent-cyan" isSpecial />
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-4">
          <Button variant="ghost" className="flex items-center gap-2 !px-4 !py-2">
            <BookOpen size={20} /> QUESTS
          </Button>
        </div>

        <div className="flex items-center gap-6 bg-bg-panel/60 p-4 rounded-3xl border border-white/10 backdrop-blur-md shadow-2xl">
          {MODES.length > 0 ? (
            <>
              <div className="flex flex-col">
                <div className="text-xs font-bold text-accent-cyan uppercase tracking-widest mb-1">Current Mode</div>
                <div className="text-2xl font-black flex items-center gap-2">
                  {selectedMode?.icon} {selectedMode?.name}
                </div>
                <div className="text-xs opacity-60 max-w-[200px]">{selectedMode?.description}</div>
              </div>
              <div className="flex gap-2">
                {MODES.map(m => (
                  <button
                    key={m.id}
                    onClick={() => onSelectMode(m.id)}
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all border-2 ${selectedModeId === m.id ? 'bg-accent-cyan border-white text-bg-deep scale-110 shadow-[0_0_15px_rgba(0,240,255,0.5)]' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}
                  >
                    {m.icon}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col">
              <div className="text-xs font-bold text-accent-cyan uppercase tracking-widest mb-1">ゲームモード</div>
              <div className="text-lg font-black opacity-40">準備中...</div>
            </div>
          )}

          <Button
            onClick={() => onGoTo('matching')}
            variant="play"
            className="!px-12 !py-6 !text-3xl !rounded-2xl"
          >
            PLAY
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function SideButton({ icon, label, onClick, color, isSpecial }: any) {
  return (
    <motion.button
      whileHover={{ scale: 1.1, x: 5 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={`w-20 h-20 bg-bg-panel/80 backdrop-blur-md border-2 rounded-2xl flex flex-col items-center justify-center gap-1 shadow-xl transition-all ${color} ${isSpecial ? 'animate-pulse' : ''}`}
    >
      <div className="text-2xl">{icon}</div>
      <span className="font-black text-[10px] tracking-tighter">{label}</span>
    </motion.button>
  );
}

function ShopScreen({ onBack, burgers, hearts }: any) {
  const paidSkins = SKINS.filter(s => s.priceBurgers > 0);
  const paidChars = INITIAL_CHARACTERS;

  return (
    <motion.div
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      className="absolute inset-0 bg-game-radial flex flex-col"
    >
      {/* 戻るボタン */}
      <button onClick={onBack} className="absolute top-6 left-6 z-50 p-3 bg-bg-panel/80 backdrop-blur-md rounded-2xl border border-accent-cyan/30 hover:bg-bg-panel transition-colors text-accent-cyan">
        <ChevronLeft size={32} />
      </button>

      {/* 通貨バッジ */}
      <div className="absolute top-6 right-6 z-50 flex gap-3">
        <CurrencyBadge icon="🍔" value={burgers} />
        <CurrencyBadge icon="♡" value={hearts} />
      </div>

      {/* 上半分：スキン */}
      <div className="flex-1 flex flex-col pt-20 px-6 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3 mb-4">
          <Zap size={20} className="text-accent-yellow" />
          <span className="font-black uppercase tracking-widest text-sm text-accent-yellow">スキン</span>
        </div>
        {paidSkins.length === 0 ? (
          <div className="flex-1 flex items-center justify-center opacity-30">
            <p className="font-black uppercase tracking-widest text-sm">準備中...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto flex gap-4 pb-2 items-center">
            {paidSkins.map((skin, i) => (
              <motion.div
                key={skin.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="min-w-[220px] h-full bg-gradient-to-br from-accent-yellow/10 to-accent-pink/10 backdrop-blur-md rounded-[24px] border-2 border-accent-yellow p-5 flex flex-col items-center justify-between relative overflow-hidden group shadow-[0_0_20px_rgba(255,245,0,0.15)]"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                {skin.timeLeft && (
                  <div className="absolute top-3 right-3 bg-accent-pink px-2 py-0.5 rounded-full text-[10px] font-bold animate-pulse text-white">
                    ⏰ {skin.timeLeft}
                  </div>
                )}
                <div className="text-7xl mt-4 group-hover:scale-110 transition-transform drop-shadow-glow">{skin.image}</div>
                <div className="w-full text-center">
                  <h3 className="text-lg font-black mb-1 text-accent-yellow">{skin.name}</h3>
                  <p className="text-[10px] text-accent-pink uppercase font-bold tracking-widest mb-3">スキン</p>
                  <Button className="w-full !py-3 !text-sm" variant="primary">
                    <span>🍔 {skin.priceBurgers}</span>
                    <span className="opacity-30 mx-1">|</span>
                    <span>♡ {skin.priceHearts}</span>
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 下半分：キャラクター */}
      <div className="flex-1 flex flex-col px-6 pt-3 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <Users size={20} className="text-accent-cyan" />
          <span className="font-black uppercase tracking-widest text-sm text-accent-cyan">キャラクター</span>
        </div>
        {paidChars.length === 0 ? (
          <div className="flex-1 flex items-center justify-center opacity-30">
            <p className="font-black uppercase tracking-widest text-sm">準備中...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto flex gap-4 pb-2 items-center">
            {paidChars.map((char: any, i: number) => (
              <motion.div
                key={char.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="min-w-[200px] h-full bg-gradient-to-br from-accent-cyan/10 to-accent-pink/10 backdrop-blur-md rounded-[24px] border-2 border-accent-cyan p-5 flex flex-col items-center justify-between relative overflow-hidden group shadow-[0_0_20px_rgba(0,240,255,0.15)]"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                <div className="text-7xl mt-4 group-hover:scale-110 transition-transform drop-shadow-glow">
                  {SKINS.find(s => s.charId === char.id)?.image || '❓'}
                </div>
                <div className="w-full text-center">
                  <div className="mb-1 px-2 py-0.5 bg-accent-cyan/20 text-accent-cyan inline-block rounded text-[10px] font-black uppercase tracking-widest">
                    {char.rarity}
                  </div>
                  <h3 className="text-lg font-black mb-1 text-white">{char.name}</h3>
                  <Button className="w-full !py-3 !text-sm mt-2" variant="secondary">
                    <span>🍔 {char.hp}</span>
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function CharacterSelectScreen({ onBack, onSelect, characters }: any) {
  return (
    <motion.div 
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      className="absolute inset-0 bg-game-radial p-8 flex flex-col"
    >
      <div className="flex justify-between items-center mb-8 opacity-0 pointer-events-none h-0 overflow-hidden">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-3 bg-white/20 rounded-2xl hover:bg-white/30 transition-colors">
            <ChevronLeft size={32} />
          </button>
        </div>
        <button className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl border border-white/20 font-bold">
          <ArrowRightLeft size={18} /> SORT BY HEARTS
        </button>
      </div>

      {/* Floating Back Button for navigation */}
      <button onClick={onBack} className="absolute top-6 left-6 z-50 p-3 bg-bg-panel/80 backdrop-blur-md rounded-2xl border border-accent-cyan/30 hover:bg-bg-panel transition-colors text-accent-cyan">
        <ChevronLeft size={32} />
      </button>

      <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-6 pr-4">
        {characters.map((char: any, i: number) => (
          <motion.div 
            key={char.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onSelect(char.id)}
            className="bg-bg-panel/60 hover:bg-bg-panel transition-all cursor-pointer rounded-2xl border-2 border-transparent hover:border-accent-cyan/50 p-4 flex flex-col items-center group relative overflow-hidden shadow-lg"
          >
            {char.isHypercharge && (
              <div className="absolute top-2 right-2 text-accent-cyan drop-shadow-glow animate-bounce">
                <Zap size={20} fill="currentColor" />
              </div>
            )}
            
            <div className="text-6xl mb-4 group-hover:scale-110 transition-transform drop-shadow-glow">
              {SKINS.find(s => s.charId === char.id)?.image || '🍔'}
            </div>
            
            <div className="w-full">
              <div className="flex justify-between items-center mb-1">
                <h3 className="font-black text-lg text-white">{char.name}</h3>
                <span className="text-[10px] bg-accent-cyan/20 text-accent-cyan px-2 py-0.5 rounded-full font-bold">LVL {char.level}</span>
              </div>
              
              <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/10">
                <div 
                  className="h-full bg-accent-pink" 
                  style={{ width: `${(char.hearts / 500) * 100}%` }} 
                />
              </div>
              <div className="text-[10px] font-bold text-right mt-1 text-heart">♡ {char.hearts} / 500</div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function CharacterDetailScreen({ onBack, character, onSelect }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
      className="absolute inset-0 bg-game-radial p-8 flex"
    >
      {/* Left Column: Info */}
      <div className="w-1/3 flex flex-col justify-between">
        <div>
          <button onClick={onBack} className="p-3 bg-bg-panel/80 rounded-2xl hover:bg-bg-panel transition-colors mb-6 text-accent-cyan border border-accent-cyan/30">
            <ChevronLeft size={32} />
          </button>
          <div className="mb-2 px-3 py-1 bg-accent-cyan text-bg-deep inline-block rounded-lg text-xs font-black uppercase tracking-widest">
            {character.rarity}
          </div>
          <h1 className="text-6xl font-black italic mb-4 leading-none text-white drop-shadow-glow">{character.name}</h1>
          <p className="text-lg opacity-70 mb-6 font-medium leading-relaxed">
            {character.description}
          </p>
          <div className="p-4 bg-bg-panel/40 rounded-2xl border border-white/10">
            <h4 className="text-xs font-bold text-accent-yellow uppercase mb-2">Backstory</h4>
            <p className="text-sm italic opacity-60">{character.history}</p>
          </div>
        </div>

        <div className="flex gap-4">
          <Button variant="ghost" className="flex-1">TRY OUT</Button>
          <Button onClick={onSelect} className="flex-1" variant="secondary">SELECT</Button>
        </div>
      </div>

      {/* Center Column: Visual */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        <div className="absolute inset-0 bg-radial-gradient from-accent-cyan/20 to-transparent opacity-30 pointer-events-none" />
        <motion.div
          animate={{ y: [0, -20, 0], rotate: [0, 2, -2, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="text-[200px] drop-shadow-[0_35px_35px_rgba(0,0,0,0.6)] z-10"
        >
          {SKINS.find(s => s.charId === character.id)?.image || '❓'}
        </motion.div>
      </div>

      {/* Right Column: Stats */}
      <div className="w-1/4 flex flex-col justify-center gap-6">
        <div className="bg-bg-panel/60 p-6 rounded-[32px] border border-white/10 shadow-2xl">
          <div className="flex justify-between items-center mb-4">
            <span className="font-black text-xl text-accent-yellow">STATS</span>
            <span className="text-3xl font-black text-accent-cyan">Lv. {character.level}</span>
          </div>
          
          <div className="space-y-4">
            <StatRow icon={<Shield size={18} />} label="HP" value={character.hp} color="bg-accent-cyan" />
            <StatRow icon={<Sword size={18} />} label="ATTACK" value={character.attack} color="bg-accent-pink" />
            <StatRow icon={<Zap size={18} />} label="ULTIMATE" value={character.ultimate} color="bg-accent-yellow" />
          </div>
        </div>

        <div className="bg-bg-panel/80 p-6 rounded-[32px] border-b-6 border-accent-pink text-white shadow-2xl">
          <div className="text-center font-black text-sm uppercase mb-3 text-accent-pink">Upgrade Character</div>
          <div className="flex justify-center gap-4 mb-4">
            <div className="flex items-center gap-1 font-black text-xl">🍔 250</div>
            <div className="flex items-center gap-1 font-black text-xl">♡ 25</div>
          </div>
          <Button variant="primary" className="w-full !py-3">
            LEVEL UP!
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function StatRow({ icon, label, value, color }: any) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
      <div className="flex-1">
        <div className="flex justify-between text-[10px] font-bold opacity-60 uppercase mb-1">
          <span>{label}</span>
          <span>{value}</span>
        </div>
        <div className="h-2 bg-black/40 rounded-full overflow-hidden">
          <div className={`h-full ${color}`} style={{ width: `${(value / 6000) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function MatchingScreen({ onCancel, mode, onFinish }: any) {
  const [dots, setDots] = useState('');
  const [players, setPlayers] = useState([true, false, false, false, false, false]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    
    const playerInterval = setInterval(() => {
      setPlayers(p => {
        const next = [...p];
        const firstEmpty = next.indexOf(false);
        if (firstEmpty !== -1) next[firstEmpty] = true;
        
        // Auto-finish when full
        if (next.every(v => v === true)) {
          setTimeout(onFinish, 1000);
        }
        return next;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(playerInterval);
    };
  }, [onFinish]);

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 bg-game-radial flex flex-col items-center justify-center p-12"
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] opacity-5"
          style={{ background: 'conic-gradient(from 0deg, transparent, var(--color-accent-cyan), transparent, var(--color-accent-pink), transparent)' }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <motion.div 
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="text-6xl font-black italic mb-2 tracking-[0.2em] text-white drop-shadow-glow"
        >
          MATCHING{dots}
        </motion.div>
        <div className="text-xl font-bold text-accent-cyan mb-12 uppercase tracking-widest">
          {mode.name}
        </div>

        {/* Matching Circle from Theme */}
        <div className="w-48 h-48 border-[10px] border-accent-cyan border-t-transparent rounded-full animate-spin mb-16 shadow-[0_0_30px_rgba(0,240,255,0.3)]" />

        <div className="flex gap-4 mb-16">
          {players.map((filled, i) => (
            <motion.div 
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`w-20 h-20 rounded-full border-2 flex items-center justify-center text-3xl transition-all duration-500 ${filled ? 'bg-accent-cyan/20 border-accent-cyan shadow-[0_0_15px_rgba(0,240,255,0.4)]' : 'bg-white/5 border-white/10 border-dashed'}`}
            >
              {filled ? (i === 0 ? '👤' : '🍔') : '?'}
            </motion.div>
          ))}
        </div>

        <Button variant="danger" onClick={onCancel} className="!px-12 !py-4">
          CANCEL
        </Button>
      </div>
    </motion.div>
  );
}

function ResultScreen({ onHome, character }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 bg-game-radial flex flex-col items-center justify-center p-12 overflow-hidden"
    >
      {/* Confetti-like background */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: -100, x: Math.random() * 1000 - 500, rotate: 0 }}
            animate={{ y: 1000, rotate: 360 }}
            transition={{ duration: 2 + Math.random() * 3, repeat: Infinity, ease: "linear", delay: Math.random() * 2 }}
            className="text-2xl absolute"
            style={{ left: `${Math.random() * 100}%` }}
          >
            {['🍔', '✨', '♡', '🎊'][Math.floor(Math.random() * 4)]}
          </motion.div>
        ))}
      </div>

      <motion.div 
        initial={{ scale: 0.5, y: 50 }}
        animate={{ scale: 1, y: 0 }}
        className="relative z-10 flex flex-col items-center"
      >
        <div className="text-8xl font-black italic text-white drop-shadow-[0_10px_0_#A00090] mb-2 tracking-tighter uppercase">
          VICTORY!
        </div>
        <div className="text-2xl font-bold text-accent-cyan mb-8 uppercase tracking-[0.3em] drop-shadow-glow">Burger King of the Hill</div>

        <div className="flex items-center gap-12 mb-12">
          <motion.div 
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="text-[180px] drop-shadow-glow"
          >
            {character ? (SKINS.find(s => s.charId === character.id)?.image || '❓') : '❓'}
          </motion.div>

          <div className="flex flex-col gap-4">
            <RewardItem icon="♡" label="Hearts Earned" value="+15" color="text-accent-pink" />
            <RewardItem icon="🍔" label="Burgers Found" value="+120" color="text-accent-yellow" />
            <RewardItem icon="⭐" label="EXP Gained" value="+500" color="text-accent-cyan" />
          </div>
        </div>

        <Button onClick={onHome} variant="play" className="!px-16 !py-6 !text-2xl">
          CONTINUE
        </Button>
      </motion.div>
    </motion.div>
  );
}

function RewardItem({ icon, label, value, color }: any) {
  return (
    <motion.div 
      initial={{ x: 50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="flex items-center gap-4 bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-white/10 min-w-[240px]"
    >
      <div className="text-4xl">{icon}</div>
      <div className="flex-1">
        <div className="text-[10px] font-bold opacity-60 uppercase tracking-widest">{label}</div>
        <div className={`text-2xl font-black ${color}`}>{value}</div>
      </div>
    </motion.div>
  );
}
