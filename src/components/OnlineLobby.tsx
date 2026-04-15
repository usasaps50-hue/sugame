/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { MONSTERS } from '../constants';
import { Monster } from '../types';
import CharacterSprite from './CharacterSprite';
import { ChevronLeft, Wifi, Copy, Loader, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Phase = 'choose' | 'hosting' | 'joining' | 'random-searching' | 'team-select' | 'waiting';

interface OnlineLobbyProps {
  onBack: () => void;
  onStartBattle: (config: {
    isHost: boolean;
    roomCode: string;
    myTeam: Monster[];
    opponentTeam: Monster[];
  }) => void;
  mode?: 'normal' | 'random';
}

const ALL_MONSTERS = MONSTERS.map(m => ({ ...m, hp: m.maxHp }));

function genCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function OnlineLobby({ onBack, onStartBattle, mode = 'normal' }: OnlineLobbyProps) {
  const [phase, setPhase]       = useState<Phase>('choose');
  const [roomCode, setRoomCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [isHost, setIsHost]     = useState(false);
  const [myTeam, setMyTeam]     = useState<Monster[]>([]);
  const [opponentTeam, setOpponentTeam] = useState<Monster[]>([]);
  const [status, setStatus]     = useState('');
  const [error, setError]       = useState('');
  const [myTeamSent, setMyTeamSent] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [toastMsg, setToastMsg] = useState('');

  const channelRef  = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const matchChRef  = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const codeRef     = useRef('');
  const myTeamRef   = useRef<Monster[]>([]);
  const matchedRef  = useRef(false);
  const toastTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { myTeamRef.current = myTeam; }, [myTeam]);

  useEffect(() => () => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    if (matchChRef.current) supabase.removeChannel(matchChRef.current);
  }, []);

  // 両チーム揃ったらバトル開始
  useEffect(() => {
    if (phase === 'waiting' && myTeamSent && opponentTeam.length === 3) {
      setTimeout(() => {
        onStartBattle({ isHost, roomCode: codeRef.current, myTeam, opponentTeam });
      }, 800);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, myTeamSent, opponentTeam]);

  // チーム選択30秒タイマー
  useEffect(() => {
    if (phase !== 'team-select') return;
    setTimeLeft(30);
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // タイムアップ時に自動決定
  useEffect(() => {
    if (phase !== 'team-select' || timeLeft !== 0) return;
    let team = [...myTeamRef.current];
    if (team.length < 3) {
      const rest = ALL_MONSTERS.filter(m => !team.find(t => t.id === m.id)).sort(() => 0.5 - Math.random());
      team = [...team, ...rest.slice(0, 3 - team.length)];
    }
    if (!channelRef.current) return;
    const event = isHost ? 'HOST_TEAM' : 'GUEST_TEAM';
    channelRef.current.send({ type: 'broadcast', event, payload: { team } });
    setMyTeam(team);
    setMyTeamSent(true);
    setPhase('waiting');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, phase]);

  // ランダムモード: マウント時に自動スタート
  useEffect(() => {
    if (mode === 'random') startRandomSearch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── トースト ──────────────────────────────────────────────────────────
  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(''), 2500);
  };

  const copyCode = () => {
    try {
      navigator.clipboard.writeText(roomCode)
        .then(() => showToast('コードをコピーしました！📋'))
        .catch(() => showToast('コードをコピーしました！📋'));
    } catch {
      showToast('コードをコピーしました！📋');
    }
  };

  // ── ロビーチャンネルセットアップ（ランダムマッチ用）──────────────────
  const setupLobbyChannel = (code: string, amHost: boolean) => {
    const ch = supabase.channel(`lobby:${code}`, { config: { broadcast: { self: false } } });
    channelRef.current = ch;

    if (amHost) {
      ch.on('broadcast', { event: 'GUEST_TEAM' }, ({ payload }: any) => {
        setOpponentTeam(payload.team);
      });
    } else {
      ch.on('broadcast', { event: 'HOST_TEAM' }, ({ payload }: any) => {
        setOpponentTeam(payload.team);
      });
    }

    ch.subscribe(() => {
      setPhase('team-select');
    });
  };

  // ── ランダムマッチング ────────────────────────────────────────────────
  const startRandomSearch = () => {
    const myCode = genCode();
    codeRef.current = myCode;
    setRoomCode(myCode);
    matchedRef.current = false;
    setPhase('random-searching');
    setError('');

    const matchCh = supabase.channel('random-matchmaking', {
      config: { presence: { key: myCode } },
    });
    matchChRef.current = matchCh;

    matchCh.on('presence', { event: 'sync' }, () => {
      if (matchedRef.current) return;
      const state = matchCh.presenceState<{ ts: number }>();
      const others = Object.keys(state).filter(k => k !== myCode);
      if (others.length === 0) return;

      matchedRef.current = true;
      const opponentCode = others.sort()[0];
      const amIHost = myCode > opponentCode;
      const battleCode = amIHost ? myCode : opponentCode;

      codeRef.current = battleCode;
      setIsHost(amIHost);
      setRoomCode(battleCode);
      setStatus('マッチング成功！');

      // マッチングチャンネルを離脱
      matchCh.untrack().finally(() => {
        supabase.removeChannel(matchCh);
        matchChRef.current = null;
      });

      // バトルロビーへ
      setupLobbyChannel(battleCode, amIHost);
    });

    matchCh.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await matchCh.track({ ts: Date.now() });
      } else if (status === 'CHANNEL_ERROR') {
        setError('接続エラーが発生しました');
        setPhase('choose');
      }
    });
  };

  // ── フレンドマッチ ────────────────────────────────────────────────────
  const createRoom = () => {
    const code = genCode();
    codeRef.current = code;
    setRoomCode(code);
    setIsHost(true);
    setStatus('接続を待っています...');
    setPhase('hosting');
    setError('');

    const ch = supabase.channel(`lobby:${code}`, { config: { broadcast: { self: false } } });
    channelRef.current = ch;

    ch.on('broadcast', { event: 'GUEST_JOINED' }, () => {
      setStatus('相手が接続しました！');
      setPhase('team-select');
    });
    ch.on('broadcast', { event: 'GUEST_TEAM' }, ({ payload }: any) => {
      setOpponentTeam(payload.team);
    });

    ch.subscribe();
  };

  const joinRoom = () => {
    const code = inputCode.toUpperCase().trim();
    if (code.length < 6) { setError('6文字のコードを入力してください'); return; }
    codeRef.current = code;
    setIsHost(false);
    setStatus('接続中...');
    setError('');
    setPhase('joining');

    const ch = supabase.channel(`lobby:${code}`, { config: { broadcast: { self: false } } });
    channelRef.current = ch;

    ch.on('broadcast', { event: 'HOST_TEAM' }, ({ payload }: any) => {
      setOpponentTeam(payload.team);
    });

    ch.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        ch.send({ type: 'broadcast', event: 'GUEST_JOINED', payload: {} });
        setStatus('接続成功！');
        setPhase('team-select');
      } else if (status === 'CHANNEL_ERROR') {
        setError('接続失敗。コードを確認してください');
        setPhase('choose');
      }
    });
  };

  const toggleChar = (m: Monster) => {
    setMyTeam(prev => {
      if (prev.find(p => p.id === m.id)) return prev.filter(p => p.id !== m.id);
      if (prev.length >= 3) return prev;
      return [...prev, { ...m, hp: m.maxHp }];
    });
  };

  const confirmTeam = () => {
    if (myTeam.length < 3 || !channelRef.current) return;
    const event = isHost ? 'HOST_TEAM' : 'GUEST_TEAM';
    channelRef.current.send({ type: 'broadcast', event, payload: { team: myTeam } });
    setMyTeamSent(true);
    setPhase('waiting');
  };

  return (
    <div className="fixed inset-0 bg-neutral-900 text-white flex flex-col font-sans overflow-hidden">

      {/* トースト通知 */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-neutral-700 text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-bold border border-white/10 whitespace-nowrap"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ヘッダー */}
      <div className="p-4 flex items-center gap-3 border-b border-white/10 bg-neutral-800/60 backdrop-blur-md">
        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </button>
        <Wifi size={20} className="text-blue-400" />
        <h1 className="text-lg font-black">
          {mode === 'random' ? 'ランダムマッチ' : 'オンライン対戦'}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* フレンドマッチ選択画面 */}
        {phase === 'choose' && (
          <div className="flex flex-col items-center justify-center h-full gap-8 p-8">
            <div className="text-center">
              <p className="text-3xl font-black mb-2">🌐</p>
              <p className="text-xl font-black">友達と対戦！</p>
              <p className="text-xs opacity-50 mt-1">インターネット経由でどこでもOK</p>
            </div>
            <div className="flex flex-col gap-4 w-full max-w-xs">
              <motion.button whileTap={{ scale: 0.95 }} onClick={createRoom}
                className="w-full py-5 bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl font-black text-xl shadow-lg border-b-4 border-blue-800">
                🏠 ルームを作る
                <p className="text-xs font-normal opacity-70 mt-1">コードを友達に送る</p>
              </motion.button>
              <div className="text-center text-xs opacity-40">— または —</div>
              <div className="flex flex-col gap-2">
                <input type="text" value={inputCode} onChange={e => setInputCode(e.target.value.toUpperCase())}
                  placeholder="6文字のコード入力" maxLength={6}
                  className="w-full py-4 px-5 bg-neutral-800 rounded-2xl text-center text-2xl font-black tracking-[0.3em] border border-white/10 focus:border-green-500 outline-none uppercase" />
                <motion.button whileTap={{ scale: 0.95 }} onClick={joinRoom} disabled={inputCode.length < 6}
                  className="w-full py-4 bg-gradient-to-r from-green-600 to-green-500 rounded-2xl font-black text-lg shadow-lg border-b-4 border-green-800 disabled:opacity-40 disabled:border-b-2">
                  🔗 ルームに参加
                </motion.button>
              </div>
              {error && <p className="text-red-400 text-xs text-center bg-red-900/20 p-3 rounded-xl">{error}</p>}
            </div>
          </div>
        )}

        {/* ランダムマッチング待機中 */}
        {phase === 'random-searching' && (
          <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-yellow-500/30 border-t-yellow-400 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-3xl">⚔️</div>
            </div>
            <p className="text-xl font-black">対戦相手を探しています...</p>
            <p className="text-xs opacity-40">しばらくお待ちください</p>
            {error && <p className="text-red-400 text-xs text-center bg-red-900/20 p-3 rounded-xl">{error}</p>}
            <motion.button whileTap={{ scale: 0.95 }} onClick={onBack}
              className="mt-4 px-8 py-3 bg-neutral-700 rounded-2xl font-bold text-sm border border-white/10">
              キャンセル
            </motion.button>
          </div>
        )}

        {/* フレンドマッチ: ルーム作成/参加待機 */}
        {(phase === 'hosting' || phase === 'joining') && (
          <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
            <Loader size={48} className="text-blue-400 animate-spin" />
            <p className="text-lg font-bold">{status}</p>
            {phase === 'hosting' && roomCode && (
              <div className="bg-neutral-800 rounded-2xl p-6 w-full max-w-xs border border-white/10 text-center">
                <p className="text-xs opacity-50 mb-2">ルームコード（友達に伝える）</p>
                <p className="text-5xl font-black tracking-[0.4em] text-yellow-400 mb-4">{roomCode}</p>
                <motion.button whileTap={{ scale: 0.95 }} onClick={copyCode}
                  className="flex items-center gap-2 mx-auto text-sm bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full transition-colors">
                  <Copy size={14} />
                  コピー
                </motion.button>
              </div>
            )}
            {error && <p className="text-red-400 text-xs text-center">{error}</p>}
          </div>
        )}

        {/* チーム選択 */}
        {phase === 'team-select' && (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-white/10 bg-neutral-800/50">
              <div className="flex items-center justify-between mb-1">
                <p className="font-black text-lg">チームを選んでください（3体）</p>
                <div className="flex items-center gap-2">
                  {opponentTeam.length === 3 && (
                    <div className="flex items-center gap-1 bg-green-600/20 border border-green-500/40 px-2 py-1 rounded-full">
                      <CheckCircle size={12} className="text-green-400" />
                      <span className="text-[10px] font-bold text-green-400">相手準備完了</span>
                    </div>
                  )}
                  <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-black text-sm
                    ${timeLeft <= 10 ? 'border-red-500 text-red-400 animate-pulse' : 'border-yellow-500 text-yellow-400'}`}>
                    {timeLeft}
                  </div>
                </div>
              </div>
              <div className="flex justify-center gap-3 mt-3">
                {[0,1,2].map(i => (
                  <div key={i} className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center
                    ${myTeam[i] ? 'border-yellow-500 bg-neutral-700' : 'border-white/10 bg-neutral-800'}`}>
                    {myTeam[i] ? <CharacterSprite monsterId={myTeam[i].id} size={56} /> : <span className="text-xs opacity-30">空き</span>}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-3 gap-3">
                {ALL_MONSTERS.map(m => {
                  const selected = !!myTeam.find(p => p.id === m.id);
                  return (
                    <button key={m.id} onClick={() => toggleChar(m)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all
                        ${selected ? 'border-yellow-500 bg-yellow-500/10' : 'border-white/10 bg-neutral-800 hover:border-white/30'}`}>
                      <CharacterSprite monsterId={m.id} size={64} />
                      <p className="text-[10px] font-bold text-center leading-tight">{m.name}</p>
                      {selected && <div className="w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center text-[8px] font-black">✓</div>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="p-4 border-t border-white/10">
              <motion.button whileTap={{ scale: 0.97 }} onClick={confirmTeam} disabled={myTeam.length < 3}
                className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl font-black text-lg shadow-lg border-b-4 border-orange-800 disabled:opacity-40 disabled:border-b-2">
                決定！バトル開始 →
              </motion.button>
            </div>
          </div>
        )}

        {/* 待機中 */}
        {phase === 'waiting' && (
          <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
            <div className="flex gap-3">
              {myTeam.map(m => (
                <div key={m.id} className="flex flex-col items-center gap-1">
                  <CharacterSprite monsterId={m.id} size={72} />
                  <p className="text-[10px]">{m.name}</p>
                </div>
              ))}
            </div>
            <p className="text-lg font-bold">チームを送信しました！</p>
            <div className="flex items-center gap-2 text-sm opacity-60">
              <Loader size={16} className="animate-spin" />
              相手のチームを待っています...
            </div>
            {opponentTeam.length === 3 && <p className="text-green-400 font-bold animate-pulse">バトル開始！</p>}
          </div>
        )}

      </div>
    </div>
  );
}
