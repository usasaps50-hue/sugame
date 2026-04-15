/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, ChevronLeft, Wifi, WifiOff } from 'lucide-react';
import { Monster, Skill, GameState } from '../types';
import { GoryoCanvas, GoryoCanvasRef } from './GoryoCanvas';
import CharacterSprite, { CharacterSpriteRef } from './CharacterSprite';

interface Props {
  isHost: boolean;
  roomCode: string;
  myTeam: Monster[];      // 自分のチーム
  opponentTeam: Monster[]; // 相手のチーム
  onBack: () => void;
}

const GORYO_ID = 'm4';

// ── ユーティリティ（BattleScreen と同じ） ────────────────────────────────
function getEffectiveCost(skill: Skill, activePlayer: Monster, activeEnemy: Monster, state: GameState): number {
  let cost = skill.cost;
  if (skill.id === 's9') return (activePlayer.form ?? 1) >= 3 ? 2 : 3;
  if (skill.id === 's10') return activeEnemy.isWaterType ? 6 : 8;
  if (state.bonsaiRootActive && skill.id !== 's31') cost += 1;
  if (skill.id === 's44' && state.saitoLimitBreakActive) return 0;
  if (state.tosaFreezeActive && cost >= 4) return 99;
  return cost;
}

function isSkillLocked(skill: Skill, state: GameState): { locked: boolean; reason: string } {
  if (skill.id === 's22' && state.tapiocaStock === 0) return { locked: true, reason: 'タピオカなし' };
  if (skill.id === 's26' && state.tapiocaStock === 0) return { locked: true, reason: 'タピオカなし' };
  if (skill.id === 's29' && state.bonsaiMineActive) return { locked: true, reason: '設置済み' };
  if (skill.id === 's32' && state.bonsaiPhotoCount < 2) return { locked: true, reason: `光合成${state.bonsaiPhotoCount}/2` };
  if (skill.id === 's32' && state.bonsaiSekkenCharging) return { locked: true, reason: 'チャージ中' };
  if (skill.id === 's33' && state.potatoStock === 0) return { locked: true, reason: 'ポテトなし' };
  if (skill.id === 's34' && state.saltDebuffActive) return { locked: true, reason: '発動中' };
  if (skill.id === 's35' && state.ketchupBarrierActive) return { locked: true, reason: '発動中' };
  if (skill.id === 's38' && state.potatoStock === 0) return { locked: true, reason: 'ポテトなし' };
  if (skill.id === 's50' && state.enemyBugCount < 3) return { locked: true, reason: `バグ${state.enemyBugCount}/3` };
  if (skill.id === 's55' && state.buildingFloor < 5) return { locked: true, reason: `階層${state.buildingFloor}/5` };
  if (skill.id === 's56' && state.buildingFloor === 0) return { locked: true, reason: '階層0' };
  if (skill.id === 's44' && !state.saitoLimitBreakActive && (state.saitoHazureCount < 3 || state.saitoKitaiChi < 8))
    return { locked: true, reason: `ハズレ${state.saitoHazureCount}/3・期待値${state.saitoKitaiChi}/8` };
  if (skill.id === 's61' && !state.tosaAttackKaritateActive) return { locked: true, reason: '取り立て未発動' };
  return { locked: false, reason: '' };
}

// ゲスト視点のスキルロック（enemyEnergy ベース）
function isGuestSkillLocked(skill: Skill, state: GameState): { locked: boolean; reason: string } {
  // ゲストは enemy サイドのリソースを使う
  if (skill.id === 's22' && state.cpuTapiocaStock === 0) return { locked: true, reason: 'タピオカなし' };
  if (skill.id === 's26' && state.cpuTapiocaStock === 0) return { locked: true, reason: 'タピオカなし' };
  if (skill.id === 's29' && state.bonsaiMineActive) return { locked: true, reason: '設置済み' };
  if (skill.id === 's50' && state.cpuBugCount < 3) return { locked: true, reason: `バグ${state.cpuBugCount}/3` };
  if (skill.id === 's55' && state.cpuBuildingFloor < 5) return { locked: true, reason: `階層${state.cpuBuildingFloor}/5` };
  if (skill.id === 's56' && state.cpuBuildingFloor === 0) return { locked: true, reason: '階層0' };
  if (skill.id === 's44' && (state.cpuHazureCount < 3 || state.cpuKitaiChi < 8)) return { locked: true, reason: `ハズレ${state.cpuHazureCount}/3・期待値${state.cpuKitaiChi}/8` };
  return { locked: false, reason: '' };
}

function checkGoryoEvolution(monster: Monster, logs: string[]): { monster: Monster; evolved: boolean; logs: string[] } {
  if (monster.id !== GORYO_ID) return { monster, evolved: false, logs };
  const form = monster.form ?? 1;
  if (form >= 3) return { monster, evolved: false, logs };
  if ((monster.attacksGiven ?? 0) >= 2 && (monster.attacksReceived ?? 0) >= 2) {
    const newForm = form + 1;
    const newMaxHp = monster.maxHp + 20;
    const newHp = Math.min(monster.hp + 20, newMaxHp);
    return {
      monster: { ...monster, form: newForm, maxHp: newMaxHp, hp: newHp, attacksGiven: 0, attacksReceived: 0 },
      evolved: true,
      logs: [`✨ ゴリョが形態${newForm}に進化！HP+20！`, ...logs],
    };
  }
  return { monster, evolved: false, logs };
}

const INITIAL_STATE_EXTRA = {
  playerDodgeActive: false, playerShield: 0, criticalMomentActive: false,
  playerStunTurns: 0, playerNoEnergyNextTurn: false, enemyDamageDebuff: 0,
  tailGatlingActive: false, tailGatlingTurn: 0, tapiocaStock: 0,
  playerDamageHalf: false, playerDamageNullify: false,
  bonsaiMineActive: false, bonsaiMineTurnsLeft: 0, bonsaiNextAttackDouble: false,
  bonsaiRootActive: false, bonsaiRootTurnsLeft: 0, bonsaiPhotoCount: 0,
  bonsaiGuardThisTurn: false, bonsaiBonusEnergyNextTurn: false, bonsaiSekkenCharging: false,
  potatoStock: 10, saltDebuffActive: false, saltDebuffTurnsLeft: 0,
  ketchupBarrierActive: false, ketchupBarrierTurnsLeft: 0, burgerOrderActive: false,
  saitoKitaiChi: 0, saitoHazureCount: 0, saitoBorrowActive: false,
  saitoBorrowTurnsLeft: 0, saitoSSRActive: false,
  enemyBugCount: 0, copyPasteActive: false,
  buildingFloor: 0, earthquakeProofActive: false,
  enemyEnergy: 3, enemyHand: [],
  cpuTapiocaStock: 0, cpuPotatoStock: 10, cpuKitaiChi: 0,
  cpuHazureCount: 0, cpuBugCount: 0, cpuBuildingFloor: 0,
  saitoLimitBreakActive: false,
  tosaAttackKaritateActive: false, tosaAttackKaritateTurnsLeft: 0,
  tosaAttackKaritateDouble: false, tosaFreezeActive: false,
  tosaDantanActive: false, tosaSanpanActive: false,
  tosaPlayerKaritateActive: false, tosaPlayerKaritateTurnsLeft: 0,
};

// ── メインコンポーネント ───────────────────────────────────────────────────
export default function OnlineBattleScreen({ isHost, roomCode, myTeam, opponentTeam, onBack }: Props) {
  // HOST: playerTeam=自分, enemyTeam=相手
  // GUEST: playerTeam=相手（上）, enemyTeam=自分（下）と解釈して HOST が state を送る
  // → ゲストには HOST の state をそのまま送り、ゲスト側で "enemy" 視点で表示する
  const [gameState, setGameState] = useState<GameState>(() => ({
    playerTeam: myTeam.map(m => ({ ...m, hp: m.maxHp, form: m.form ?? 1, attacksGiven: 0, attacksReceived: 0 })),
    enemyTeam: opponentTeam.map(m => ({ ...m, hp: m.maxHp })),
    activePlayerIndex: 0, activeEnemyIndex: 0,
    turn: 'player',
    energy: 3,
    hand: [],
    logs: ['バトル開始！'],
    hearts: 0, winStreak: 0,
    ...INITIAL_STATE_EXTRA,
  }));

  const [showResult, setShowResult] = useState<'win' | 'lose' | null>(null);
  const [isShaking, setIsShaking]   = useState({ player: false, enemy: false });
  const [energyGain, setEnergyGain] = useState(0);
  const [waiting, setWaiting]       = useState(false); // ゲスト: 相手の応答待ち
  const [connected, setConnected]   = useState(true);

  const playerGoryoRef  = useRef<GoryoCanvasRef>(null);
  const enemyGoryoRef   = useRef<GoryoCanvasRef>(null);
  const playerSpriteRef = useRef<CharacterSpriteRef>(null);
  const enemySpriteRef  = useRef<CharacterSpriteRef>(null);
  const gameStateRef    = useRef(gameState);
  const showResultRef   = useRef(showResult);

  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { showResultRef.current = showResult; }, [showResult]);

  // activePlayer/Enemy は常に HOST 視点
  const gs = gameState;
  const activePlayer = gs.playerTeam[gs.activePlayerIndex];
  const activeEnemy  = gs.enemyTeam[gs.activeEnemyIndex];

  // 自分のターンか？
  const isMyTurn = isHost ? gs.turn === 'player' : gs.turn === 'enemy';
  // 自分のアクティブキャラ
  const myChar       = isHost ? activePlayer : activeEnemy;
  // 相手のアクティブキャラ
  const opChar       = isHost ? activeEnemy  : activePlayer;
  // 自分のエナジー
  const myEnergy     = isHost ? gs.energy    : gs.enemyEnergy;

  const shake = (target: 'player' | 'enemy') => {
    setIsShaking(prev => ({ ...prev, [target]: true }));
    setTimeout(() => setIsShaking(prev => ({ ...prev, [target]: false })), 500);
  };

  // ── Supabase Realtime チャンネルのセットアップ ──────────────────────────
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const ch = supabase.channel(`battle:${roomCode}`, {
      config: { broadcast: { self: false } },
    });

    if (isHost) {
      // HOST: ゲストのスキル・ターン終了を受信
      ch.on('broadcast', { event: 'SKILL' }, ({ payload }: { payload: { id: string } }) => {
        applyGuestSkillRef.current?.(payload.id);
      });
      ch.on('broadcast', { event: 'ENDTURN' }, () => {
        handleGuestEndTurnRef.current?.();
      });
    } else {
      // GUEST: ホストの gameState を受信
      ch.on('broadcast', { event: 'STATE' }, ({ payload }: { payload: { gs: GameState } }) => {
        setGameState(payload.gs);
        setWaiting(false);
      });
    }

    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnected(true);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setConnected(false);
      }
    });

    chRef.current = ch;

    return () => {
      supabase.removeChannel(ch);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, roomCode]);

  // ── HOST: gameState が変わるたびに Broadcast で送信 ─────────────────────
  useEffect(() => {
    if (!isHost) return;
    const ch = chRef.current;
    if (!ch) return;
    ch.send({ type: 'broadcast', event: 'STATE', payload: { gs: gameState } })
      .catch(() => setConnected(false));
  }, [gameState, isHost]);

  // ── HOST: ターン開始エフェクト ──────────────────────────────────────────
  const turnStartProcessed = useRef(false);
  useEffect(() => {
    if (!isHost) return;
    if (gs.turn !== 'player') { turnStartProcessed.current = false; return; }
    if (turnStartProcessed.current) return;
    turnStartProcessed.current = true;

    setGameState(prev => {
      let next = { ...prev };
      const logs: string[] = [];
      if (prev.tailGatlingActive && prev.tailGatlingTurn > 0) {
        const dmgMap: Record<number,number> = { 1:5, 2:10, 3:10 };
        const dmg = dmgMap[prev.tailGatlingTurn] ?? 0;
        const et = [...prev.enemyTeam];
        et[prev.activeEnemyIndex] = { ...et[prev.activeEnemyIndex], hp: Math.max(0, et[prev.activeEnemyIndex].hp - dmg) };
        next.enemyTeam = et;
        const nt = prev.tailGatlingTurn + 1;
        next.tailGatlingActive = nt <= 3; next.tailGatlingTurn = next.tailGatlingActive ? nt : 0;
        logs.push(`テールマシンガン${prev.tailGatlingTurn}撃目！${dmg}ダメージ！`);
        if (et[prev.activeEnemyIndex].hp <= 0 && prev.activeEnemyIndex >= prev.enemyTeam.length - 1) setTimeout(() => setShowResult('win'), 100);
      }
      if (prev.bonsaiBonusEnergyNextTurn) {
        next.energy = Math.min(10, prev.energy + 2); next.bonsaiBonusEnergyNextTurn = false;
        logs.push('光合成の恵み！エナジー+2！');
      }
      if (prev.bonsaiRootActive && prev.bonsaiRootTurnsLeft > 0) {
        const pt = [...prev.playerTeam];
        pt[prev.activePlayerIndex] = { ...pt[prev.activePlayerIndex], hp: Math.min(pt[prev.activePlayerIndex].maxHp, pt[prev.activePlayerIndex].hp + 10) };
        next.playerTeam = pt;
        const rt = prev.bonsaiRootTurnsLeft - 1;
        next.bonsaiRootActive = rt > 0; next.bonsaiRootTurnsLeft = rt;
        logs.push(`根を張る！HP+10！（残り${rt}ターン）`);
      }
      if (prev.bonsaiSekkenCharging) {
        const p = prev.playerTeam[prev.activePlayerIndex];
        const dmg = p.hp <= p.maxHp / 2 ? 80 : 50;
        const et2 = [...prev.enemyTeam];
        et2[prev.activeEnemyIndex] = { ...et2[prev.activeEnemyIndex], hp: Math.max(0, et2[prev.activeEnemyIndex].hp - dmg) };
        next.enemyTeam = et2; next.bonsaiSekkenCharging = false; next.bonsaiPhotoCount = 0;
        logs.push(`⚔️ 秘剣・大樹断ち！${dmg}ダメージ！`);
        if (et2[prev.activeEnemyIndex].hp <= 0 && prev.activeEnemyIndex >= prev.enemyTeam.length - 1) setTimeout(() => setShowResult('win'), 100);
      }
      if (prev.tosaAttackKaritateActive && prev.tosaAttackKaritateTurnsLeft > 0) {
        const kDmg = prev.tosaAttackKaritateDouble ? 30 : 15;
        const et3 = [...(next.enemyTeam ?? prev.enemyTeam)];
        et3[prev.activeEnemyIndex] = { ...et3[prev.activeEnemyIndex], hp: Math.max(0, et3[prev.activeEnemyIndex].hp - kDmg) };
        next.enemyTeam = et3;
        const kt = prev.tosaAttackKaritateTurnsLeft - 1;
        next.tosaAttackKaritateActive = kt > 0; next.tosaAttackKaritateTurnsLeft = kt;
        if (kt === 0) next.tosaAttackKaritateDouble = false;
        logs.push(`🦊 取り立て！敵に${kDmg}ダメージ！（残り${kt}ターン）`);
      }
      if (logs.length > 0) next.logs = [...logs, ...prev.logs].slice(0, 5);
      return next;
    });
  }, [gs.turn, isHost]);

  // ── HOST: プレイヤースキル使用 ────────────────────────────────────────────
  const handlePlayerSkill = useCallback((skill: Skill) => {
    if (!isHost || gs.turn !== 'player' || showResult || waiting) return;
    const cost = getEffectiveCost(skill, activePlayer, activeEnemy, gs);
    const { locked } = isSkillLocked(skill, gs);
    if (gs.energy < cost || locked || gs.playerStunTurns > 0) return;

    // アニメーション
    if (activePlayer.id !== GORYO_ID) {
      playerSpriteRef.current?.playAnimation(skill.type === 'attack' ? 'ATTACK' : 'SKILL');
      if (skill.type === 'attack') {
        setTimeout(() => {
          if (activeEnemy.id !== GORYO_ID) enemySpriteRef.current?.playAnimation('DAMAGE');
          else enemyGoryoRef.current?.playAnimation('DAMAGE' as any);
        }, 280);
      }
    } else {
      const aMap: Record<string,string> = { s9:'TOUGH_GUARD', s10:'GOLDFISH_SPLASH', s11:'AQUA_FIST', s12:'TOUGH_GUARD', s13:'HEAL_MIST', s14:'GORILLA_PUNCH' };
      const a = aMap[skill.id]; if (a) playerGoryoRef.current?.playAnimation(a as any);
    }

    // shake は updater 外で呼ぶ（updater 内で setState を呼ぶのは React 規約違反）
    const ENEMY_SHAKE_IDS = new Set(['s10','s14','s15','s16','s19','s20','s22','s24','s26','s27','s33','s38','s39','s44','s45','s49','s50','s51','s56','s57','s62']);
    if (skill.type === 'attack' || ENEMY_SHAKE_IDS.has(skill.id)) shake('enemy');

    setGameState(prev => {
      let next = { ...prev };
      let newPlayerMonster = { ...activePlayer };
      let newEnemyHp = activeEnemy.hp;
      const logs: string[] = [];
      next.energy = prev.energy - cost;

      // ─── スキル効果（BattleScreen の handleSkill と同じ）───────────────
      if (skill.id === 's9') { next.playerDodgeActive = true; logs.push(`${activePlayer.name}が水の中へ！回避！`); }
      else if (skill.id === 's10') { const d = activeEnemy.isWaterType?60:30; newEnemyHp=Math.max(0,newEnemyHp-d); newPlayerMonster.attacksGiven=(newPlayerMonster.attacksGiven??0)+1; logs.push(`食欲旺盛！${d}ダメージ！`); }
      else if (skill.id === 's11') { next.tailGatlingActive=true; next.tailGatlingTurn=1; logs.push(`テールマシンガン発動！`); }
      else if (skill.id === 's12') { next.criticalMomentActive=true; logs.push(`危機一髪！`); }
      else if (skill.id === 's13') { newPlayerMonster.hp=Math.min(newPlayerMonster.maxHp,newPlayerMonster.hp+16); logs.push(`弱肉強食！HP+16！`); }
      else if (skill.id === 's14') { newEnemyHp=Math.max(0,newEnemyHp-42); next.playerStunTurns=1; next.playerNoEnergyNextTurn=true; newPlayerMonster.attacksGiven=(newPlayerMonster.attacksGiven??0)+1; logs.push(`DEATHパンチ！42ダメージ！次ターン行動不能`); }
      else if (skill.id === 's15') { let d=15; if(prev.bonsaiNextAttackDouble){d*=2;next.bonsaiNextAttackDouble=false;} newEnemyHp=Math.max(0,newEnemyHp-d); logs.push(`焼きたてタックル！${d}ダメージ！`); }
      else if (skill.id === 's16') { let d=20; if(prev.bonsaiNextAttackDouble){d*=2;next.bonsaiNextAttackDouble=false;} newEnemyHp=Math.max(0,newEnemyHp-d); logs.push(`トースト連続発射！${d}ダメージ！`); }
      else if (skill.id === 's17') { next.enemyDamageDebuff=(prev.enemyDamageDebuff??0)+1; logs.push(`コンセント抜き！`); }
      else if (skill.id === 's18') { newPlayerMonster.hp=Math.min(newPlayerMonster.maxHp,newPlayerMonster.hp+20); logs.push(`パンくず補給！HP+20！`); }
      else if (skill.id === 's19') { let d=45; if(prev.bonsaiNextAttackDouble){d*=2;next.bonsaiNextAttackDouble=false;} newEnemyHp=Math.max(0,newEnemyHp-d); newPlayerMonster.hp=Math.max(1,newPlayerMonster.hp-10); logs.push(`オーバーヒート！${d}ダメージ！反動10`); }
      else if (skill.id === 's20') { let d=60; if(prev.bonsaiNextAttackDouble){d*=2;next.bonsaiNextAttackDouble=false;} newEnemyHp=Math.max(0,newEnemyHp-d); newPlayerMonster.hp=Math.min(newPlayerMonster.maxHp,newPlayerMonster.hp+15); next.playerStunTurns=2; logs.push(`フルブレックファスト！${d}ダメージ！2ターン行動不能`); }
      else if (skill.id === 's21') { const g=Math.floor(Math.random()*3)+1; next.tapiocaStock=Math.min(6,prev.tapiocaStock+g); logs.push(`タピオカ生成！×${g}（計${next.tapiocaStock}）`); }
      else if (skill.id === 's22') { const u=Math.min(3,prev.tapiocaStock); const d=u*12; newEnemyHp=Math.max(0,newEnemyHp-d); next.tapiocaStock=prev.tapiocaStock-u; logs.push(`プチプチ弾！×${u}、${d}ダメージ！`); }
      else if (skill.id === 's23') { next.playerDamageHalf=true; logs.push(`甘すぎる誘惑！次のターンダメージ半減！`); }
      else if (skill.id === 's24') { const d=15; newEnemyHp=Math.max(0,newEnemyHp-d); newPlayerMonster.hp=Math.min(newPlayerMonster.maxHp,newPlayerMonster.hp+d); logs.push(`ストロー吸引！15ダメージ＋HP15回復！`); }
      else if (skill.id === 's25') { next.playerDamageNullify=true; logs.push(`もちもちバリア！次の攻撃を無効！`); }
      else if (skill.id === 's26') { const u=prev.tapiocaStock; const d=u*15; newEnemyHp=Math.max(0,newEnemyHp-d); next.tapiocaStock=0; next.energy=0; logs.push(`タピオカラッシュ！×${u}全消費、${d}ダメージ！`); }
      else if (skill.id === 's27') { let d=20; if(prev.bonsaiNextAttackDouble){d*=2;next.bonsaiNextAttackDouble=false;} newEnemyHp=Math.max(0,newEnemyHp-d); logs.push(`居合・小枝斬り！${d}ダメージ！`); }
      else if (skill.id === 's28') { next.bonsaiGuardThisTurn=true; next.bonsaiBonusEnergyNextTurn=true; next.bonsaiPhotoCount=(prev.bonsaiPhotoCount??0)+1; logs.push(`光合成の構え！`); }
      else if (skill.id === 's29') { next.bonsaiMineActive=true; next.bonsaiMineTurnsLeft=2; logs.push(`松ぼっくり地雷設置！`); }
      else if (skill.id === 's30') { newPlayerMonster.hp=Math.max(1,newPlayerMonster.hp-20); next.bonsaiNextAttackDouble=true; logs.push(`捨て身の剪定！HP-20、次攻撃2倍！`); }
      else if (skill.id === 's31') { next.bonsaiRootActive=true; next.bonsaiRootTurnsLeft=3; logs.push(`根を張る！3ターンHP+10/turn`); }
      else if (skill.id === 's32') { next.bonsaiSekkenCharging=true; logs.push(`秘剣チャージ！次ターン発動！`); }
      else if (skill.id === 's33') { const u=Math.min(5,prev.potatoStock); const d=u*5; newEnemyHp=Math.max(0,newEnemyHp-d); next.potatoStock=prev.potatoStock-u; logs.push(`ポテト投げ！×${u}、${d}ダメージ！`); }
      else if (skill.id === 's34') { next.saltDebuffActive=true; next.saltDebuffTurnsLeft=4; logs.push(`しおかけ！4ターンエナジー回復-1！`); }
      else if (skill.id === 's35') { next.ketchupBarrierActive=true; next.ketchupBarrierTurnsLeft=3; logs.push(`ケチャップバリア！3ターン被ダメ10%減！`); }
      else if (skill.id === 's36') { next.burgerOrderActive=true; logs.push(`バーガーお急ぎ注文！`); }
      else if (skill.id === 's37') { next.potatoStock=Math.min(10,prev.potatoStock+5); logs.push(`ポテト追加注文！+5本`); }
      else if (skill.id === 's38') { const u=prev.potatoStock+5; const d=u*4; newEnemyHp=Math.max(0,newEnemyHp-d); next.potatoStock=0; logs.push(`ポテトLサイズ！×${u}、${d}ダメージ！`); }
      else if (skill.id === 's39') {
        let d=0; let hz=false;
        if(prev.saitoLimitBreakActive){d=30;logs.push(`🌟 限界突破ガチャ！30ダメージ！`);}
        else if(prev.saitoSSRActive){d=30;next.saitoSSRActive=false;logs.push(`SSR確定！30ダメージ！`);}
        else if(prev.saitoKitaiChi>=8){d=Math.random()<0.5?20:30;logs.push(`期待値高し！${d}ダメージ！`);}
        else{const r=Math.random();d=r<0.33?10:r<0.66?20:30;hz=d===10;}
        if(hz){next.saitoHazureCount=prev.saitoHazureCount+1;logs.push(`ハズレ…10ダメージ（${next.saitoHazureCount}回）`);}
        newEnemyHp=Math.max(0,newEnemyHp-d);
      }
      else if (skill.id === 's40') { const le=Math.floor(Math.random()*3)+1; const lk=Math.floor(Math.random()*8)+1; const mul=prev.tosaSanpanActive?2:1; next.energy=Math.min(10,prev.energy+le*mul); next.saitoKitaiChi=Math.min(15,prev.saitoKitaiChi+lk*mul); if(next.saitoKitaiChi>=11&&!prev.saitoLimitBreakActive)next.saitoLimitBreakActive=true; logs.push(`ラッキー！エナジー+${le*mul}、期待値+${lk*mul}！`); }
      else if (skill.id === 's41') { next.energy=10; next.saitoKitaiChi=10; next.saitoBorrowActive=true; next.saitoBorrowTurnsLeft=3; logs.push(`借金！エナジー&期待値MAX！3ターン後0`); }
      else if (skill.id === 's42') { next.saitoSSRActive=true; logs.push(`SSR確定演出！`); }
      else if (skill.id === 's43') { const h=prev.saitoLimitBreakActive?60:10+Math.floor(prev.saitoKitaiChi*3); newPlayerMonster.hp=Math.min(newPlayerMonster.maxHp,newPlayerMonster.hp+h); logs.push(`やけ酒！HP+${h}！`); }
      else if (skill.id === 's44') {
        if(prev.saitoLimitBreakActive){const d=Math.floor(activeEnemy.hp*3/4);newEnemyHp=Math.max(0,activeEnemy.hp-d);next.saitoKitaiChi=0;next.saitoLimitBreakActive=false;logs.push(`🌟 限界突破クライマックス！${d}ダメージ！`);}
        else{const d=Math.floor(activeEnemy.hp*2/3);newEnemyHp=Math.max(0,activeEnemy.hp-d);next.saitoKitaiChi=4;next.saitoHazureCount=0;logs.push(`🎆 クライマックス！${d}ダメージ！`);}
      }
      else if (skill.id === 's45') { newEnemyHp=Math.max(0,newEnemyHp-10); next.enemyBugCount=prev.enemyBugCount+1; logs.push(`スパム送信！10ダメージ＋バグ🐛`); }
      else if (skill.id === 's46') { next.enemyDamageDebuff=(prev.enemyDamageDebuff??0)+2; next.enemyBugCount=prev.enemyBugCount+1; logs.push(`重い処理！エナジーデバフ＋バグ🐛`); }
      else if (skill.id === 's47') { next.enemyDamageDebuff=(prev.enemyDamageDebuff??0)+3; logs.push(`パスワードクラック！`); }
      else if (skill.id === 's48') { next.copyPasteActive=true; logs.push(`コピペ！次の攻撃を反射！`); }
      else if (skill.id === 's49') { newEnemyHp=Math.max(0,newEnemyHp-15); newPlayerMonster.hp=Math.min(newPlayerMonster.maxHp,newPlayerMonster.hp+15); next.enemyDamageDebuff=(prev.enemyDamageDebuff??0)+2; logs.push(`ランサムウェア！15ダメージ＋HP吸収！`); }
      else if (skill.id === 's50') { newEnemyHp=Math.max(0,newEnemyHp-70); next.enemyBugCount=0; logs.push(`💥 ブルースクリーン！70ダメージ！`); }
      else if (skill.id === 's51') { let d=15; if(prev.bonsaiNextAttackDouble){d*=2;next.bonsaiNextAttackDouble=false;} newEnemyHp=Math.max(0,newEnemyHp-d); logs.push(`資材ぶん投げ！${d}ダメージ！`); }
      else if (skill.id === 's52') { next.buildingFloor=prev.buildingFloor+3; newPlayerMonster.hp=Math.max(1,newPlayerMonster.hp-10); logs.push(`突貫工事！階層+3（→${next.buildingFloor}階）`); }
      else if (skill.id === 's53') { next.earthquakeProofActive=true; logs.push(`耐震偽装！次ターン被ダメ0！`); }
      else if (skill.id === 's54') { const h=prev.buildingFloor*5; newPlayerMonster.hp=Math.min(newPlayerMonster.maxHp,newPlayerMonster.hp+h); logs.push(`家賃収入！HP+${h}！`); }
      else if (skill.id === 's55') { next.enemyDamageDebuff=99; logs.push(`屋上からの絶景！敵エナジー0！`); }
      else if (skill.id === 's56') { const d=Math.min(150,prev.buildingFloor*15); newEnemyHp=Math.max(0,newEnemyHp-d); newPlayerMonster.hp=Math.max(1,newPlayerMonster.hp-30); next.buildingFloor=0; logs.push(`💥 ビルヂング大崩落！${d}ダメージ！`); }
      else if (skill.id === 's57') { newEnemyHp=Math.max(0,newEnemyHp-10); logs.push(`小銭投げ！10ダメージ🦊`); }
      else if (skill.id === 's58') { next.enemyEnergy=10; next.tosaAttackKaritateActive=true; next.tosaAttackKaritateTurnsLeft=3; logs.push(`押し貸し！敵エナジーMAX＋取り立て3ターン🦊`); }
      else if (skill.id === 's59') { next.tosaDantanActive=true; next.saitoKitaiChi=Math.max(0,prev.saitoKitaiChi-3); logs.push(`担保没収！次の敵回復をダメージ変換🦊`); }
      else if (skill.id === 's60') { next.tosaFreezeActive=true; next.saitoKitaiChi=Math.max(0,prev.saitoKitaiChi-3); logs.push(`口座凍結！次ターン高コスト封印🦊`); }
      else if (skill.id === 's61') { next.tosaAttackKaritateDouble=true; next.saitoKitaiChi=Math.max(0,prev.saitoKitaiChi-2); logs.push(`利子倍プッシュ！取り立て2倍🦊`); }
      else if (skill.id === 's62') { next.enemyEnergy=0; newEnemyHp=Math.floor(activeEnemy.hp/2); next.energy=0; next.tosaSanpanActive=true; logs.push(`自己破産手続き！敵エナジー0・HP半分🦊`); }
      else if (skill.type === 'attack') { let d=skill.value; if(prev.bonsaiNextAttackDouble){d*=2;next.bonsaiNextAttackDouble=false;} newEnemyHp=Math.max(0,newEnemyHp-d); logs.push(`${skill.name}！${d}ダメージ。`); }
      else if (skill.type === 'buff') { newPlayerMonster.hp=Math.min(newPlayerMonster.maxHp,newPlayerMonster.hp+skill.value); logs.push(`${skill.name}！HP+${skill.value}回復。`); }

      if (skill.type === 'attack' && activePlayer.id === GORYO_ID && !['s9','s11','s12','s13','s32'].includes(skill.id))
        newPlayerMonster.attacksGiven = (newPlayerMonster.attacksGiven ?? 0) + 1;

      // 敵撃破チェック
      const newEnemyTeam = [...prev.enemyTeam];
      newEnemyTeam[prev.activeEnemyIndex] = { ...activeEnemy, hp: newEnemyHp };
      next.enemyTeam = newEnemyTeam;

      const { evolved: evolvedP, logs: evolLogs } = checkGoryoEvolution(newPlayerMonster, []);
      const newPlayerTeam = [...prev.playerTeam];
      newPlayerTeam[prev.activePlayerIndex] = evolvedP;
      next.playerTeam = newPlayerTeam;
      next.logs = [...evolLogs, ...logs, ...prev.logs].slice(0, 5);

      if (newEnemyHp <= 0) {
        if (prev.activeEnemyIndex < prev.enemyTeam.length - 1) {
          setTimeout(() => setGameState(p => ({ ...p, activeEnemyIndex: p.activeEnemyIndex + 1 })), 300);
          next.logs = [`${activeEnemy.name}を倒した！`, ...next.logs].slice(0, 5);
        } else {
          setTimeout(() => setShowResult('win'), 300);
        }
      }
      return next;
    });
  }, [isHost, gs, activePlayer, activeEnemy, showResult, waiting]);

  // ── HOST: ターン終了 ─────────────────────────────────────────────────────
  const handleEndTurn = useCallback(() => {
    if (!isHost || gs.turn !== 'player' || showResult) return;
    setGameState(prev => {
      let next = { ...prev, turn: 'enemy' as const };
      const logs: string[] = ['相手のターン…'];
      // 松ぼっくり地雷カウント
      if (prev.bonsaiMineActive) {
        const nt = prev.bonsaiMineTurnsLeft - 1;
        if (nt <= 0) {
          const et = [...prev.enemyTeam];
          et[prev.activeEnemyIndex] = { ...et[prev.activeEnemyIndex], hp: Math.max(0, et[prev.activeEnemyIndex].hp - 35) };
          next.enemyTeam = et; next.bonsaiMineActive = false; next.bonsaiMineTurnsLeft = 0;
          logs.push(`💥 松ぼっくり地雷爆発！35ダメージ！`);
          if (et[prev.activeEnemyIndex].hp <= 0 && prev.activeEnemyIndex >= prev.enemyTeam.length - 1) setTimeout(() => setShowResult('win'), 100);
        } else { next.bonsaiMineTurnsLeft = nt; }
      }
      // ゲストのエナジー回復
      const eDebuff = prev.saltDebuffActive ? 1 : 0;
      next.enemyEnergy = Math.min(10, prev.enemyEnergy + Math.max(0, 3 - eDebuff));
      next.logs = [...logs, ...prev.logs].slice(0, 5);
      return next;
    });
  }, [isHost, gs.turn, showResult]);

  // ── HOST: ゲストのターン終了を受信 ──────────────────────────────────────
  const handleGuestEndTurn = useCallback(() => {
    setGameState(prev => {
      const energyR = prev.playerNoEnergyNextTurn ? 0 : 3;
      const next = {
        ...prev,
        turn: 'player' as const,
        energy: prev.playerNoEnergyNextTurn ? prev.energy : Math.min(10, prev.energy + energyR),
        playerNoEnergyNextTurn: false,
        enemyDamageDebuff: 0,
        bonsaiGuardThisTurn: false,
        tosaFreezeActive: false,
        playerStunTurns: Math.max(0, prev.playerStunTurns - 1),
      };
      // 借金カウント
      if (prev.saitoBorrowActive) {
        const bt = prev.saitoBorrowTurnsLeft - 1;
        if (bt <= 0) { next.energy = 0; next.saitoKitaiChi = 0; next.saitoBorrowActive = false; next.saitoBorrowTurnsLeft = 0; }
        else next.saitoBorrowTurnsLeft = bt;
      }
      next.logs = ['あなたのターン！', ...prev.logs].slice(0, 5);
      return next;
    });
    setEnergyGain(3);
    setTimeout(() => setEnergyGain(0), 1000);
  }, []);

  // Stable refs — channel listener が最新のコールバックを参照するため（宣言は関数より前）
  const applyGuestSkillRef   = useRef<((id: string) => void) | null>(null);
  const handleGuestEndTurnRef = useRef<(() => void) | null>(null);
  // refs を最新関数で更新（applyGuestSkill / handleGuestEndTurn 定義後に useEffect で更新）

  // ── HOST: ゲストのスキルを適用（CPUロジックを流用）───────────────────────
  const applyGuestSkill = useCallback((skillId: string) => {
    const curGs = gameStateRef.current;
    if (curGs.turn !== 'enemy' || showResultRef.current) return;

    const curEnemy  = curGs.enemyTeam[curGs.activeEnemyIndex];
    const curPlayer = curGs.playerTeam[curGs.activePlayerIndex];
    const skill     = curEnemy.skills.find(s => s.id === skillId);
    if (!skill || curGs.enemyEnergy < skill.cost) return;

    // ゲストアニメーション（敵キャラが攻撃）
    if (curEnemy.id !== GORYO_ID && skill.type === 'attack') {
      enemySpriteRef.current?.playAnimation('ATTACK');
      setTimeout(() => {
        if (curPlayer.id !== GORYO_ID) playerSpriteRef.current?.playAnimation('DAMAGE');
        else playerGoryoRef.current?.playAnimation('DAMAGE' as any);
      }, 280);
    } else if (curEnemy.id !== GORYO_ID) {
      enemySpriteRef.current?.playAnimation('SKILL');
    }

    // shake は updater 外で呼ぶ
    if (skill.type === 'attack') shake('player');

    setGameState(prev => {
      const enemy  = prev.enemyTeam[prev.activeEnemyIndex];
      const player = prev.playerTeam[prev.activePlayerIndex];
      let next = { ...prev };
      const logs: string[] = [];
      let rawDamage = 0;

      next.enemyEnergy = Math.max(0, prev.enemyEnergy - skill.cost);

      if (skill.type === 'attack') {
        if (skillId === 's22') { const u=Math.min(3,prev.cpuTapiocaStock); rawDamage=u*12; next.cpuTapiocaStock=prev.cpuTapiocaStock-u; logs.push(`${enemy.name}のプチプチ弾！${rawDamage}ダメージ！`); }
        else if (skillId === 's26') { rawDamage=prev.cpuTapiocaStock*15; next.cpuTapiocaStock=0; next.enemyEnergy=0; logs.push(`${enemy.name}のタピオカラッシュ！${rawDamage}ダメージ！`); }
        else if (skillId === 's33') { const u=Math.min(5,prev.cpuPotatoStock); rawDamage=u*5; next.cpuPotatoStock=prev.cpuPotatoStock-u; logs.push(`${enemy.name}のポテト投げ！${rawDamage}ダメージ！`); }
        else if (skillId === 's38') { const u=prev.cpuPotatoStock+5; rawDamage=u*4; next.cpuPotatoStock=0; logs.push(`${enemy.name}のポテトLサイズ！${rawDamage}ダメージ！`); }
        else if (skillId === 's39') { const r=Math.random(); rawDamage=prev.cpuKitaiChi>=8?(Math.random()<0.5?20:30):r<0.33?10:r<0.66?20:30; if(rawDamage===10)next.cpuHazureCount=prev.cpuHazureCount+1; logs.push(`🎰 ${enemy.name}のガチャ！${rawDamage}ダメージ！`); }
        else if (skillId === 's44') { rawDamage=Math.floor(player.hp*2/3); next.cpuKitaiChi=4; next.cpuHazureCount=0; logs.push(`🎆 ${enemy.name}のクライマックス！${rawDamage}ダメージ！`); }
        else if (skillId === 's45') { rawDamage=10; next.cpuBugCount=prev.cpuBugCount+1; logs.push(`${enemy.name}のスパム送信！10ダメージ＋バグ🐛`); }
        else if (skillId === 's49') { rawDamage=15; next.enemyEnergy=Math.min(10,prev.enemyEnergy+2); logs.push(`${enemy.name}のランサムウェア！15ダメージ！`); }
        else if (skillId === 's50') { rawDamage=70; next.cpuBugCount=0; logs.push(`💥 ${enemy.name}のブルースクリーン！70ダメージ！`); }
        else if (skillId === 's51') { rawDamage=15; logs.push(`${enemy.name}の資材ぶん投げ！15ダメージ！`); }
        else if (skillId === 's56') { rawDamage=Math.min(150,prev.cpuBuildingFloor*15); next.cpuBuildingFloor=0; logs.push(`💥 ${enemy.name}のビルヂング大崩落！${rawDamage}ダメージ！`); }
        else if (skillId === 's57') { rawDamage=10; logs.push(`🦊 ${enemy.name}の小銭投げ！10ダメージ！`); }
        else if (skillId === 's62') { rawDamage=Math.floor(player.hp/2); next.enemyEnergy=0; logs.push(`🦊 ${enemy.name}の自己破産手続き！HP半分！`); }
        else { rawDamage=skill.value; logs.push(`${enemy.name}の${skill.name}！${rawDamage}ダメージ！`); }
      } else {
        // バフ/デバフ
        if (skillId === 's21') { const g=Math.floor(Math.random()*3)+1; next.cpuTapiocaStock=Math.min(6,prev.cpuTapiocaStock+g); logs.push(`${enemy.name}がタピオカ生成！×${g}`); }
        else if (skillId === 's37') { next.cpuPotatoStock=Math.min(10,prev.cpuPotatoStock+5); logs.push(`${enemy.name}がポテト補充！`); }
        else if (skillId === 's40') { const le=Math.floor(Math.random()*3)+1; const lk=Math.floor(Math.random()*8)+1; next.enemyEnergy=Math.min(10,prev.enemyEnergy+le); next.cpuKitaiChi=Math.min(15,prev.cpuKitaiChi+lk); logs.push(`🎰 ${enemy.name}のラッキー！エナジー+${le}、期待値+${lk}`); }
        else if (skillId === 's41') { next.enemyEnergy=10; next.cpuKitaiChi=10; logs.push(`💸 ${enemy.name}が借金！MAX！`); }
        else if (skillId === 's52') { next.cpuBuildingFloor=prev.cpuBuildingFloor+3; logs.push(`${enemy.name}が突貫工事！階層→${next.cpuBuildingFloor}`); }
        else if (skillId === 's58') { next.tosaPlayerKaritateActive=true; next.tosaPlayerKaritateTurnsLeft=3; next.energy=Math.min(10,prev.energy+5); logs.push(`🦊 ${enemy.name}の押し貸し！取り立て3ターン開始！`); }
        else if (skillId === 's59') { next.tosaDantanActive=true; logs.push(`🦊 ${enemy.name}の担保没収！`); }
        else if (skillId === 's60') { next.tosaFreezeActive=true; logs.push(`🦊 ${enemy.name}の口座凍結！`); }
        else { logs.push(`${enemy.name}の${skill.name}！`); }
      }

      // コピペ反射
      if (prev.copyPasteActive && rawDamage > 0) {
        const et2 = [...next.enemyTeam ?? prev.enemyTeam];
        et2[prev.activeEnemyIndex] = { ...et2[prev.activeEnemyIndex], hp: Math.max(0, et2[prev.activeEnemyIndex].hp - rawDamage) };
        next.enemyTeam = et2; next.copyPasteActive = false;
        logs.push(`🔄 コピペ反射！${rawDamage}ダメージを反射！`);
        if (et2[prev.activeEnemyIndex].hp <= 0 && prev.activeEnemyIndex >= prev.enemyTeam.length - 1) setTimeout(() => setShowResult('win'), 200);
        rawDamage = 0;
      }
      // 耐震偽装
      if (prev.earthquakeProofActive && rawDamage > 0) {
        if (Math.random() < 0.5) next.buildingFloor = Math.floor(prev.buildingFloor / 2);
        next.earthquakeProofActive = false; rawDamage = 0; logs.push(`耐震偽装！ダメージ無効！`);
      }

      if (player.id === GORYO_ID) playerGoryoRef.current?.playAnimation('DAMAGE');

      if (prev.bonsaiGuardThisTurn) rawDamage = Math.max(0, rawDamage - 10);
      let actualDmg = rawDamage;
      if (rawDamage > 0 && prev.playerDamageNullify) { actualDmg = 0; next.playerDamageNullify = false; logs.push(`もちもちバリア無効！`); }
      else if (rawDamage > 0 && prev.playerDamageHalf) { actualDmg = Math.floor(actualDmg / 2); next.playerDamageHalf = false; logs.push(`ダメージ半減！`); }
      if (prev.ketchupBarrierActive) actualDmg = Math.floor(actualDmg * 0.9);

      let remDmg = actualDmg;
      if (prev.playerShield > 0) { const abs = Math.min(prev.playerShield, remDmg); remDmg -= abs; next.playerShield = prev.playerShield - abs; }

      let newHp = player.hp - remDmg;
      if (prev.criticalMomentActive && newHp <= 0) { newHp = 1; next.playerShield = 20; next.criticalMomentActive = false; logs.push(`危機一髪！生存！`); }
      newHp = Math.max(0, newHp);

      let newPlayerMonster = { ...player, hp: newHp };
      if (player.id === GORYO_ID && actualDmg > 0) newPlayerMonster.attacksReceived = (newPlayerMonster.attacksReceived ?? 0) + 1;

      const { evolved: evolvedQ, logs: evolLogs2 } = checkGoryoEvolution(newPlayerMonster, []);
      const newPT = [...prev.playerTeam]; newPT[prev.activePlayerIndex] = evolvedQ;
      next.playerTeam = newPT;

      if (prev.burgerOrderActive && actualDmg > 0) {
        const br = Math.floor(actualDmg * 2 / 3);
        next.playerTeam[prev.activePlayerIndex] = { ...next.playerTeam[prev.activePlayerIndex], hp: Math.min(next.playerTeam[prev.activePlayerIndex].maxHp, next.playerTeam[prev.activePlayerIndex].hp + br) };
        logs.push(`バーガー！${br}HP回復！`);
      }
      next.burgerOrderActive = false;

      if (prev.saltDebuffActive) { const t = prev.saltDebuffTurnsLeft - 1; next.saltDebuffActive = t > 0; next.saltDebuffTurnsLeft = Math.max(0, t); }
      if (prev.ketchupBarrierActive) { const t = prev.ketchupBarrierTurnsLeft - 1; next.ketchupBarrierActive = t > 0; next.ketchupBarrierTurnsLeft = Math.max(0, t); }

      next.logs = [...evolLogs2, ...logs, ...prev.logs].slice(0, 5);

      // プレイヤー撃破チェック
      if (newHp <= 0) {
        if (prev.activePlayerIndex < prev.playerTeam.length - 1) {
          setTimeout(() => setGameState(p => ({ ...p, activePlayerIndex: p.activePlayerIndex + 1 })), 300);
          next.logs = [`${player.name}がやられた！`, ...next.logs].slice(0, 5);
        } else {
          setTimeout(() => setShowResult('lose'), 200);
        }
      }
      return next;
    });
  }, []);

  // ── GUEST: スキルを送信 ──────────────────────────────────────────────────
  const handleGuestSkill = useCallback((skill: Skill) => {
    if (isHost || gs.turn !== 'enemy' || showResult || waiting) return;
    const { locked } = isGuestSkillLocked(skill, gs);
    if (gs.enemyEnergy < skill.cost || locked) return;
    setWaiting(true);
    // アニメーション
    const myCharId = gs.enemyTeam[gs.activeEnemyIndex]?.id;
    if (myCharId !== GORYO_ID) enemySpriteRef.current?.playAnimation(skill.type === 'attack' ? 'ATTACK' : 'SKILL');
    chRef.current
      ?.send({ type: 'broadcast', event: 'SKILL', payload: { id: skill.id } })
      .catch(() => setConnected(false));
  }, [isHost, gs, showResult, waiting]);

  const handleGuestEndTurnBtn = useCallback(() => {
    if (isHost || gs.turn !== 'enemy' || showResult) return;
    chRef.current
      ?.send({ type: 'broadcast', event: 'ENDTURN', payload: {} })
      .catch(() => setConnected(false));
    setWaiting(true);
  }, [isHost, gs.turn, showResult]);

  // refs を常に最新の関数で更新
  useEffect(() => { applyGuestSkillRef.current = applyGuestSkill; }, [applyGuestSkill]);
  useEffect(() => { handleGuestEndTurnRef.current = handleGuestEndTurn; }, [handleGuestEndTurn]);

  // ── 敵手札初期化 ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isHost) return;
    const pool = activeEnemy.skills;
    if (!pool || pool.length === 0) return;
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    setGameState(prev => ({
      ...prev,
      enemyHand: shuffled.slice(0, 4),
      enemyEnergy: 3,
      cpuTapiocaStock: 0,
      cpuPotatoStock: activeEnemy.id === 'm5' ? 10 : 0,
      cpuKitaiChi: 0, cpuHazureCount: 0, cpuBugCount: 0, cpuBuildingFloor: 0,
    }));
  }, [gs.activeEnemyIndex, isHost]);

  // ── UI 計算 ──────────────────────────────────────────────────────────────
  const isGoryo = (m: Monster) => m.id === GORYO_ID;

  // ゲスト視点: enemyTeam = 自分のチーム（下）, playerTeam = 相手（上）
  // ホスト視点: playerTeam = 自分（下）, enemyTeam = 相手（上）
  const bottomChar   = isHost ? activePlayer : activeEnemy;
  const topChar      = isHost ? activeEnemy  : activePlayer;
  const bottomHp     = bottomChar.hp;
  const bottomMaxHp  = bottomChar.maxHp;
  const topHp        = topChar.hp;
  const topMaxHp     = topChar.maxHp;
  const mySkills     = myChar.skills ?? [];
  const bottomIsGoryo = isGoryo(bottomChar);
  const topIsGoryo    = isGoryo(topChar);

  return (
    <div className="fixed inset-0 bg-neutral-900 text-white flex flex-col overflow-hidden font-sans">

      {/* ヘッダー */}
      <div className="p-4 flex items-center justify-between border-b border-white/10 bg-neutral-800/50 backdrop-blur-md">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div className="text-center">
          <h2 className="text-xs uppercase tracking-widest opacity-50 font-bold flex items-center gap-1 justify-center">
            {connected ? <Wifi size={10} className="text-green-400" /> : <WifiOff size={10} className="text-red-400" />}
            オンライン対戦
          </h2>
          <p className="text-sm font-mono">
            {!connected ? '⚠️ 切断されました'
              : showResult ? (showResult === 'win' ? '🎉 勝利！' : '💀 敗北…')
              : isMyTurn ? (waiting ? '⏳ 応答待ち…' : 'あなたのターン')
              : '相手のターン…'}
          </p>
        </div>
        <div className="flex gap-1">
          {[...Array(3)].map((_, i) => {
            const team = isHost ? gs.playerTeam : gs.enemyTeam;
            const alive = i < team.length && team[i].hp > 0;
            const past  = isHost ? i < gs.activePlayerIndex : i < gs.activeEnemyIndex;
            return <div key={i} className={`w-2 h-2 rounded-full ${past ? 'bg-red-500' : alive ? 'bg-green-500' : 'bg-neutral-600'}`} />;
          })}
        </div>
      </div>

      {/* バトルフィールド */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-4 gap-6">

        {/* 相手（上） */}
        <motion.div animate={isShaking[isHost ? 'enemy' : 'player'] ? { x: [-10,10,-10,10,0] } : {}} className="flex flex-col items-center gap-2">
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-neutral-800 border-4 flex items-center justify-center shadow-2xl overflow-hidden"
              style={{ borderColor: (topChar.color ?? '#ef4444') + '55', boxShadow: `0 0 18px 4px ${(topChar.color ?? '#ef4444')}33` }}>
              {topIsGoryo
                ? <GoryoCanvas ref={isHost ? enemyGoryoRef : playerGoryoRef} size={112} flipped form={topChar.form ?? 1} />
                : <CharacterSprite ref={isHost ? enemySpriteRef : playerSpriteRef} monsterId={topChar.id} size={112} flipped />
              }
            </div>
            <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-neutral-800 px-3 py-1 rounded-full border border-white/10 whitespace-nowrap">
              <p className="text-xs font-bold">{topChar.name} <span className="opacity-40 text-[9px]">（相手）</span></p>
            </div>
          </div>
          <div className="w-44 h-2.5 bg-neutral-800 rounded-full overflow-hidden border border-white/10">
            <motion.div animate={{ width: `${(topHp / topMaxHp) * 100}%` }} className="h-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
          </div>
          <p className="text-[10px] opacity-40">{topHp} / {topMaxHp}</p>
        </motion.div>

        {/* 自分（下） */}
        <motion.div animate={isShaking[isHost ? 'player' : 'enemy'] ? { x: [-10,10,-10,10,0] } : {}} className="flex flex-col items-center gap-2">
          <div className="w-44 h-2.5 bg-neutral-800 rounded-full overflow-hidden border border-white/10">
            <motion.div animate={{ width: `${(bottomHp / bottomMaxHp) * 100}%` }} className="h-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
          </div>
          <p className="text-[10px] opacity-40">{bottomHp} / {bottomMaxHp}</p>
          <div className="relative">
            <div className="w-36 h-36 rounded-full bg-neutral-800 border-4 flex items-center justify-center shadow-2xl overflow-hidden"
              style={{ borderColor: (bottomChar.color ?? '#22c55e') + '55', boxShadow: `0 0 22px 6px ${(bottomChar.color ?? '#22c55e')}33` }}>
              {bottomIsGoryo
                ? <GoryoCanvas ref={isHost ? playerGoryoRef : enemyGoryoRef} size={144} form={bottomChar.form ?? 1} />
                : <CharacterSprite ref={isHost ? playerSpriteRef : enemySpriteRef} monsterId={bottomChar.id} size={144} />
              }
            </div>
            <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 bg-neutral-800 px-3 py-1 rounded-full border border-white/10 whitespace-nowrap">
              <p className="text-xs font-bold">{bottomChar.name} <span className="text-green-400 text-[9px]">（自分）</span></p>
            </div>
            <AnimatePresence>
              {energyGain > 0 && (
                <motion.div initial={{ opacity: 0, y: 0 }} animate={{ opacity: 1, y: -50 }} exit={{ opacity: 0 }}
                  className="absolute top-0 right-0 text-yellow-400 font-black text-2xl drop-shadow-lg">
                  +{energyGain}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* コントロール */}
      <div className="p-3 bg-neutral-800/80 backdrop-blur-xl border-t border-white/10 flex flex-col gap-3">
        {/* エナジーとログ */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 bg-neutral-900/50 px-3 py-1.5 rounded-full border border-yellow-500/30">
            <Zap size={14} className="text-yellow-400 fill-yellow-400" />
            <span className="text-base font-black text-yellow-400">{myEnergy}</span>
          </div>
          <div className="flex-1 ml-3 h-9 overflow-hidden">
            {gs.logs.map((log, i) => (
              <motion.p key={i} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1 - i * 0.22, y: 0 }}
                className="text-[10px] text-white/70 truncate">{log}</motion.p>
            ))}
          </div>
        </div>

        {/* スキルグリッド */}
        {isMyTurn && !showResult && (
          <div className="grid grid-cols-2 gap-2">
            {mySkills.slice(0, 4).map((skill) => {
              const cost = isHost ? getEffectiveCost(skill, activePlayer, activeEnemy, gs) : skill.cost;
              const { locked, reason } = isHost ? isSkillLocked(skill, gs) : isGuestSkillLocked(skill, gs);
              const canAfford = myEnergy >= cost;
              const disabled  = locked || !canAfford || waiting;
              return (
                <motion.button
                  key={skill.id}
                  whileTap={{ scale: disabled ? 1 : 0.95 }}
                  onClick={() => isHost ? handlePlayerSkill(skill) : handleGuestSkill(skill)}
                  disabled={disabled}
                  className={`relative p-3 rounded-2xl border text-left transition-all
                    ${disabled ? 'opacity-40 border-white/10 bg-neutral-800'
                      : skill.type === 'attack'
                        ? 'border-red-500/40 bg-red-950/30 hover:bg-red-900/40'
                        : 'border-blue-500/40 bg-blue-950/30 hover:bg-blue-900/40'
                    }`}>
                  <div className="flex items-start justify-between mb-1">
                    <span className="text-xs font-black leading-tight">{skill.name}</span>
                    <span className={`text-xs font-black px-1.5 py-0.5 rounded-full
                      ${cost === 0 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                      {cost === 0 ? 'FREE' : cost}
                    </span>
                  </div>
                  <p className="text-[9px] opacity-50 leading-tight">{locked ? reason : skill.description}</p>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* 非アクティブ時（相手のターン）*/}
        {!isMyTurn && !showResult && (
          <div className="flex items-center justify-center h-16 opacity-40">
            <p className="text-sm">相手がスキルを選んでいます...</p>
          </div>
        )}

        {/* ターン終了ボタン */}
        {isMyTurn && !showResult && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => isHost ? handleEndTurn() : handleGuestEndTurnBtn()}
            disabled={waiting}
            className="w-full py-3 bg-neutral-700 hover:bg-neutral-600 rounded-2xl font-black text-sm border border-white/10 disabled:opacity-40 transition-colors"
          >
            {waiting ? '⏳ 待機中…' : 'ターン終了 →'}
          </motion.button>
        )}
      </div>

      {/* 結果モーダル */}
      <AnimatePresence>
        {showResult && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8">
            <motion.div initial={{ scale: 0.5, y: 50 }} animate={{ scale: 1, y: 0 }}
              className="bg-neutral-800 p-8 rounded-[3rem] border-4 border-yellow-500/50 shadow-2xl text-center max-w-xs w-full">
              <p className="text-7xl mb-4">{showResult === 'win' ? '🏆' : '💀'}</p>
              <h2 className="text-3xl font-black text-yellow-400 mb-2">{showResult === 'win' ? '勝利！' : '敗北…'}</h2>
              <p className="opacity-60 text-sm mb-8">{showResult === 'win' ? 'おめでとうございます！' : 'また挑戦しよう！'}</p>
              <button onClick={onBack} className="w-full py-4 bg-white text-black rounded-2xl font-black text-lg">
                ロビーに戻る
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
