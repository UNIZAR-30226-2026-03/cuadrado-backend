import {Room} from '../../rooms/interfaces/room.interface'
import {Card} from './card.interface'

export interface Game {
    gameId : string;
    roomId : string;
    estado: 'activo' | 'parado' | 'terminado';
    estadoGlobal: GameState;
    updatedAt : Date;
}

export interface GameState {
    turn : number;
    cartasVigentes : Card[];
    cartasDescartadas : Card[];
    habilidadesActivadas : number[];
    turnoJugadores : string[];
    jugadores : PlayerState[];
}

export interface PlayerState {
    cartasMano : Card[];
    habilidadesActivadas : number[];
    cartaPendiente?: Card;
}

