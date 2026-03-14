import { Player } from './player.interface';
import { RulesConfig } from './rules-config.interface';

export interface PublicRoomSummary {
  name: string;
  code: string;
  playersCount: number;
  rules: RulesConfig;
  createdAt: Date;
}

export interface Room {
  name: string;
  code: string;
  hostId: string;
  players: Map<string, Player>;
  rules: RulesConfig;
  started: boolean;
  createdAt: Date;
}

export interface RoomState {
  name: string;
  code: string;
  hostId: string;
  players: {
    userId: string;
    socketId: string;
    isHost: boolean;
    joinedAt: Date;
    connected: boolean;
  }[];
  rules: RulesConfig;
  started: boolean;
  createdAt: Date;
}
