import {Room} from '../../rooms/interfaces/room.interface'

export interface Game {
    gameId : string;
    roomId : string;
    estado: 'activo' | 'parado' | 'terminado';
    estadoGlobal: GameState;
    updatedAt : Date;
}

export interface GameState {
    turn : number;
    cartasVigentes : number[];
    cartasDescartadas : number[];
    habilidades_activadas : number[];
    jugadores : PlayerState[];
}

export interface PlayerState {
    userId : number;
    cartas_mano : number[];
    habilidades_activadas : number[];
}

