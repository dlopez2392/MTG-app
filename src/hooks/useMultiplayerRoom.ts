"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface MultiplayerPlayerState {
  playerId: string;
  name: string;
  color: string;
  life: number;
  poisonCounters: number;
  energyCounters: number;
  experienceCounters: number;
  isMonarch: boolean;
  hasInitiative: boolean;
  dungeonLevel: number;
  commanderDamage: Record<string, number>;
}

export interface GameEndPayload {
  players: Array<{
    name: string;
    finalLife: number;
    isWinner: boolean;
    color: string;
  }>;
  startingLife: number;
  playerCount: number;
  format: string;
  durationSecs: number;
  notes?: string;
  endedAt: string;
}

interface UseMultiplayerRoomReturn {
  roomCode: string | null;
  isHost: boolean;
  isConnected: boolean;
  remotePlayers: MultiplayerPlayerState[];
  gameStarted: boolean;
  gameEndPayload: GameEndPayload | null;
  createRoom: () => void;
  joinRoom: (code: string) => void;
  leaveRoom: () => void;
  trackState: (state: MultiplayerPlayerState) => void;
  broadcastGameStart: (startingLife: number) => void;
  broadcastGameEnd: (payload: GameEndPayload) => void;
  broadcastGameReset: () => void;
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function useMultiplayerRoom(): UseMultiplayerRoomReturn {
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [remotePlayers, setRemotePlayers] = useState<MultiplayerPlayerState[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEndPayload, setGameEndPayload] = useState<GameEndPayload | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const localPlayerIdRef = useRef<string>("");
  const isHostRef = useRef(false);

  const subscribe = useCallback((code: string) => {
    const supabase = getSupabaseClient();
    const channel = supabase.channel(`life-room-${code}`, {
      config: { presence: { key: localPlayerIdRef.current } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<MultiplayerPlayerState>();
        const players: MultiplayerPlayerState[] = [];
        for (const key of Object.keys(state)) {
          if (key === localPlayerIdRef.current) continue;
          const presences = state[key];
          if (presences && presences.length > 0) {
            players.push(presences[0] as unknown as MultiplayerPlayerState);
          }
        }
        setRemotePlayers(players);
      })
      .on("broadcast", { event: "game-start" }, () => {
        if (!isHostRef.current) {
          setGameStarted(true);
        }
      })
      .on("broadcast", { event: "game-end" }, ({ payload }) => {
        setGameEndPayload(payload as GameEndPayload);
      })
      .on("broadcast", { event: "game-reset" }, () => {
        setGameStarted(false);
        setGameEndPayload(null);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
        }
      });

    channelRef.current = channel;
  }, []);

  const createRoom = useCallback(() => {
    const code = generateRoomCode();
    localPlayerIdRef.current = crypto.randomUUID();
    setRoomCode(code);
    setIsHost(true);
    isHostRef.current = true;
    subscribe(code);
  }, [subscribe]);

  const joinRoom = useCallback((code: string) => {
    const normalized = code.toUpperCase().trim();
    localPlayerIdRef.current = crypto.randomUUID();
    setRoomCode(normalized);
    setIsHost(false);
    isHostRef.current = false;
    subscribe(normalized);
  }, [subscribe]);

  const leaveRoom = useCallback(() => {
    if (channelRef.current) {
      const supabase = getSupabaseClient();
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setRoomCode(null);
    setIsHost(false);
    isHostRef.current = false;
    setIsConnected(false);
    setRemotePlayers([]);
    setGameStarted(false);
    setGameEndPayload(null);
  }, []);

  const trackState = useCallback((state: MultiplayerPlayerState) => {
    if (channelRef.current) {
      channelRef.current.track(state);
    }
  }, []);

  const broadcastGameStart = useCallback((startingLife: number) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "game-start",
        payload: { startingLife },
      });
      setGameStarted(true);
    }
  }, []);

  const broadcastGameEnd = useCallback((payload: GameEndPayload) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "game-end",
        payload,
      });
    }
  }, []);

  const broadcastGameReset = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "game-reset",
        payload: {},
      });
      setGameStarted(false);
      setGameEndPayload(null);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        const supabase = getSupabaseClient();
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  return {
    roomCode,
    isHost,
    isConnected,
    remotePlayers,
    gameStarted,
    gameEndPayload,
    createRoom,
    joinRoom,
    leaveRoom,
    trackState,
    broadcastGameStart,
    broadcastGameEnd,
    broadcastGameReset,
  };
}
