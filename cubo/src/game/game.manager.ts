import { GameState } from "./interfaces/game.interface";
import { PlayerState } from "./interfaces/game.interface";
import { Game} from "./interfaces/game.interface";
import { RoomManager } from "src/rooms/room.manager";
import {Card} from "./interfaces/card.interface"

export class GameManager {

    private readonly games = new Map<string, Game>();
    private readonly salas = new RoomManager();
    private static rellenarBaraja(): Card[] {
        const baraja : Card[] = [];
        const vtipo: Array<'corazones' | 'picas' | 'treboles' | 'rombos'> = [
        'corazones',
        'picas',
        'treboles',
        'rombos',
        ];
        for (let tipo = 0; tipo < vtipo.length; tipo++) {
        for (let i = 1; i <= 13; i++) {
            const carta = new Card();
            carta.carta = i;
            carta.palo = vtipo[tipo];
            carta.habilidad = 'ninguna';
            baraja.push(carta);
        }
    }
    const barajaJuego = GameManager.rellenarBaraja();


    for (let i = 1; i <= 3; i++) {
        const carta = new Card();
        carta.carta = 52 + i;
        carta.palo = 'jocker';
        carta.habilidad = 'ninguna';
        baraja.push(carta);
    }
    return baraja;
}
    inicioPartida(game : Game) {
        if (game.estado == null) {
            game.estado = 'activo';
        } else {
            throw new Error('Al iniciar partida no puede \
                    tener estado previo'); 
        }

        //generar las cartas de la baraja aleatoriamente

    }
}