export interface Player {
  userId: string;
  socketId: string;
  isHost: boolean;
  joinedAt: Date;
  connected: boolean
  disconnectTimeout?: NodeJS.Timeout
}
