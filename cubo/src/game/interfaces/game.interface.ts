import { dificultadBot, playerController, Room } from '../../rooms/interfaces/room.interface';
import { Card } from './card.interface';

export type FinPartidaMotivo =
    | 'sinCartasMazo'
    | 'unJugadorSinCartas'
    | 'cubo';

export interface Game {
    gameId : string;
    roomId : string;
    estado: 'activo' | 'parado' | 'terminado';
    ranking?: Array<{userId: string; puntaje: number}>;
    finPartidaMotivo?: FinPartidaMotivo;
    estadoGlobal: GameState;
    updatedAt : Date;
}

export type TurnPhase = 'WAIT_DRAW' | 'WAIT_DECISION' | 'WAIT_SKILL';

export interface GameState {
    turn : number;
    phase: TurnPhase;
    turnDeadlineAt: number;
    numBarajas: number;
    cuboActivado: boolean;
    cuboSolicitanteId: string | null;
    cuboTurnosRestantes?: number;
    cartasVigentes : Card[];
    cartasDescartadas : Card[];
    habilidadesActivadas : number[];
    turnoJugadores : string[];
    jugadores : PlayerState[];
}

export interface PlayerState {
    cartasMano : Card[];
    controlador: playerController;
    dificultadBot?: dificultadBot;
    nombreEnPartida?: string;
    saltarTurno : Boolean;
    habilidadesActivadas : number[];
    cartaPendiente?: Card;
}
