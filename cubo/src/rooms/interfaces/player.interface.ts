import { playerController } from "./room.interface";
import { dificultadBot } from "./room.interface";

export interface Player {
  userId: string;
  controlador: playerController;
  dificultadBot?: dificultadBot;
  nombreEnPartida?: string; //sólo si es bot
  idInRoom : number;
  socketId: string;
  isHost: boolean;
  joinedAt: Date;
  connected: boolean;
  disconnectTimeout?: NodeJS.Timeout;
}
