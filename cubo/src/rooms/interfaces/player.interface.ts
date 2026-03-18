export interface Player {
  userId: string;
  idInRoom : number;
  socketId: string;
  isHost: boolean;
  joinedAt: Date;
  connected: boolean;
  disconnectTimeout?: NodeJS.Timeout;
}
