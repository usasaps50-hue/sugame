/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import MainMenu from './components/MainMenu';
import BattleScreen from './components/BattleScreen';
import CharacterList from './components/CharacterList';
import CharacterDetail from './components/CharacterDetail';
import WorldBattle from './components/WorldBattle';
import Shop from './components/Shop';
import OnlineLobby from './components/OnlineLobby';
import OnlineBattleScreen from './components/OnlineBattleScreen';
import { MONSTERS, STAGES, INITIAL_REWARDS } from './constants';
import { Monster, Stage, Reward } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Heart } from 'lucide-react';

type View = 'menu' | 'battle' | 'character-list' | 'character-detail' | 'world' | 'shop' | 'online-lobby' | 'online-battle';

interface OnlineBattleConfig {
  isHost: boolean;
  roomCode: string;
  myTeam: Monster[];
  opponentTeam: Monster[];
}

export default function App() {
  const [view, setView] = useState<View>('menu');
  const [monsters, setMonsters] = useState<Monster[]>(MONSTERS);
  const [stages, setStages] = useState<Stage[]>(STAGES);
  const [rewards, setRewards] = useState<Reward[]>(INITIAL_REWARDS);
  const [selectedMonster, setSelectedMonster] = useState<Monster>(MONSTERS[0]);
  const [playerTeam, setPlayerTeam] = useState<Monster[]>([]);
  const [enemyTeam, setEnemyTeam] = useState<Monster[]>([]);
  
  const [hearts, setHearts] = useState(0);
  const [winStreak, setWinStreak] = useState(0);
  const [showRewardModal, setShowRewardModal] = useState<Reward | null>(null);
  const [onlineConfig, setOnlineConfig] = useState<OnlineBattleConfig | null>(null);
  const [lobbyMode, setLobbyMode] = useState<'normal' | 'random'>('normal');

  // Initialize player team with equipped monsters
  useEffect(() => {
    const equipped = monsters
      .filter(m => m.isEquipped)
      .sort((a, b) => (a.equipOrder ?? 0) - (b.equipOrder ?? 0));
    setPlayerTeam(equipped);
  }, [monsters]);

  const startBattle = () => {
    if (playerTeam.length === 0) {
      alert('キャラクターを装備してください！');
      return;
    }
    // Generate random enemy team
    const enemies = monsters
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map(m => ({ ...m, hp: m.maxHp }));
    setEnemyTeam(enemies);
    setView('battle');
  };

  const startStage = (stageId: string) => {
    if (playerTeam.length === 0) {
      alert('キャラクターを装備してください！');
      return;
    }
    const stage = stages.find(s => s.id === stageId);
    if (!stage) return;
    
    // In stage, enemy team might be fixed or random
    const enemies = monsters
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map(m => ({ ...m, hp: m.maxHp }));
    setEnemyTeam(enemies);
    setView('battle');
  };

  const handleBattleEnd = (result?: { win: boolean }) => {
    if (result?.win) {
      const bonus = winStreak >= 10 ? 10 : winStreak;
      const gain = 10 + bonus;
      const newHearts = hearts + gain;
      setHearts(newHearts);
      setWinStreak(prev => Math.min(11, prev + 1));

      // Check for rewards
      const newlyUnlocked = rewards.find(r => !r.isClaimed && newHearts >= r.heartThreshold);
      if (newlyUnlocked) {
        setShowRewardModal(newlyUnlocked);
        setRewards(prev => prev.map(r => r.id === newlyUnlocked.id ? { ...r, isClaimed: true } : r));
      }
    } else if (result) {
      setWinStreak(0);
    }
    setView('menu');
  };

  const handleEquip = (id: string) => {
    setMonsters(prev => {
      const alreadyEquipped = prev.filter(m => m.isEquipped);
      const target = prev.find(m => m.id === id);
      
      if (target?.isEquipped) return prev; // Already equipped
      if (alreadyEquipped.length >= 3) {
        alert('最大3体までしか装備できません！');
        return prev;
      }

      return prev.map(m => {
        if (m.id === id) {
          return { ...m, isEquipped: true, equipOrder: alreadyEquipped.length };
        }
        return m;
      });
    });
  };

  const handleUnequip = (id: string) => {
    setMonsters(prev => {
      const newMonsters = prev.map(m => {
        if (m.id === id) {
          return { ...m, isEquipped: false, equipOrder: undefined };
        }
        return m;
      });
      
      // Re-order remaining equipped monsters
      const equipped = newMonsters.filter(m => m.isEquipped).sort((a, b) => (a.equipOrder ?? 0) - (b.equipOrder ?? 0));
      return newMonsters.map(m => {
        if (m.isEquipped) {
          const index = equipped.findIndex(e => e.id === m.id);
          return { ...m, equipOrder: index };
        }
        return m;
      });
    });
  };

  const handleChangeSkin = (id: string) => {
    setMonsters(prev => prev.map(m => {
      if (m.id !== id) return m;
      const currentSkinIndex = m.skins.findIndex(s => s.id === m.activeSkinId);
      const nextSkinIndex = (currentSkinIndex + 1) % m.skins.length;
      return {
        ...m,
        activeSkinId: m.skins[nextSkinIndex].id
      };
    }));
  };

  const currentSelected = monsters.find(m => m.id === selectedMonster.id) || selectedMonster;
  const equippedMonster = playerTeam[0] || monsters[0];

  return (
    <div className="w-full h-screen bg-black overflow-hidden">
      {view === 'menu' && (
        <MainMenu
          onStartBattle={startBattle}
          onOpenCharacters={() => setView('character-list')}
          onOpenShop={() => setView('shop')}
          onOpenWorld={() => setView('world')}
          onOpenOnline={() => { setLobbyMode('normal'); setView('online-lobby'); }}
          onStartRandomBattle={() => { setLobbyMode('random'); setView('online-lobby'); }}
          equippedMonster={equippedMonster}
          hearts={hearts}
          winStreak={winStreak}
        />
      )}

      {view === 'character-list' && (
        <CharacterList 
          monsters={monsters}
          onBack={() => setView('menu')}
          onSelect={(m) => {
            setSelectedMonster(m);
            setView('character-detail');
          }}
        />
      )}

      {view === 'character-detail' && (
        <CharacterDetail 
          monster={currentSelected}
          onBack={() => setView('character-list')}
          onEquip={handleEquip}
          onUnequip={handleUnequip}
          onChangeSkin={handleChangeSkin}
        />
      )}

      {view === 'world' && (
        <WorldBattle 
          onBack={() => setView('menu')}
          onStartStage={startStage}
          stages={stages}
        />
      )}

      {view === 'shop' && (
        <Shop 
          onBack={() => setView('menu')} 
          onAddReward={(r) => setRewards(prev => [...prev, r])}
        />
      )}

      {view === 'battle' && (
        <ErrorBoundary>
          <BattleScreen
            onBack={handleBattleEnd}
            playerTeam={playerTeam}
            enemyTeam={enemyTeam}
          />
        </ErrorBoundary>
      )}

      {view === 'online-lobby' && (
        <OnlineLobby
          mode={lobbyMode}
          onBack={() => setView('menu')}
          onStartBattle={(config) => {
            setOnlineConfig(config);
            setView('online-battle');
          }}
        />
      )}

      {view === 'online-battle' && onlineConfig && (
        <ErrorBoundary>
          <OnlineBattleScreen
            isHost={onlineConfig.isHost}
            roomCode={onlineConfig.roomCode}
            myTeam={onlineConfig.myTeam}
            opponentTeam={onlineConfig.opponentTeam}
            onBack={() => {
              setOnlineConfig(null);
              setView('menu');
            }}
          />
        </ErrorBoundary>
      )}

      {/* Reward Modal */}
      <AnimatePresence>
        {showRewardModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-8 text-center backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-neutral-800 p-8 rounded-[3rem] border-4 border-yellow-500/50 shadow-[0_0_50px_rgba(234,179,8,0.3)] max-w-sm w-full"
            >
              <div className="w-24 h-24 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-yellow-500/20">
                <Heart size={48} className="text-black fill-black" />
              </div>
              <h2 className="text-2xl font-black italic uppercase italic tracking-tighter text-yellow-400 mb-2">
                {showRewardModal.heartThreshold} ハート達成！
              </h2>
              <p className="text-white font-bold text-lg mb-4">{showRewardModal.name}</p>
              <p className="text-white/60 text-sm mb-8">{showRewardModal.description}</p>
              
              <button 
                onClick={() => setShowRewardModal(null)}
                className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest shadow-xl"
              >
                受け取る
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
