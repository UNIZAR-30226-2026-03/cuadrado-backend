import { GameState } from "./interfaces/game.interface";
import { PlayerState } from "./interfaces/game.interface";
import { Game} from "./interfaces/game.interface";
import { Card, PaloCarta } from "./interfaces/card.interface"

const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export class GameManager {
////////////////////////////////////////////////////////////////////////////////
//                           ATRIBUTOS                                        //
////////////////////////////////////////////////////////////////////////////////

    //representa el acceso a una sala mediante su identificador
    private readonly games = new Map<string, Game>();
    //representa las partidas activas por sala (roomId -> gameId)
    private readonly roomToGame = new Map<string, string>();

    //variables usadas para controlar la acción de colocar una carta sobre otra
    //en el momento de descartar una carta
    private reaccionCarta = new Map<string, boolean>();
    private reaccionUserId = new Map <string, string>();

    getGameById(gameId: string): Game {
        const partida = this.games.get(gameId);

        if (!partida) {
            throw new Error('Partida no encontrada');
         }

        return partida;
    }

    getGameByRoomId(roomId: string): Game {
        const gameId = this.roomToGame.get(roomId);

        if (!gameId) {
            throw new Error('No hay partida activa para la sala');
        }

        return this.getGameById(gameId);
    }

    
    private static crearCarta(carta: number, palo: PaloCarta, habilidad = 'ninguna', puntos: number): Card {
        return {
            carta,
            palo,
            habilidad,
            puntos
        };
    }

    //función que crea la baraja inicial del juego
    private static rellenarBaraja(): Card[] {
        const baraja : Card[] = [];
        const vtipo: PaloCarta[] = [
        'corazones',
        'picas',
        'treboles',
        'rombos',
        ];
        for (let tipo = 0; tipo < vtipo.length; tipo++) {
        for (let i = 1; i <= 13; i++) {
            let puntos = 0;
            if (i == 13 && (vtipo[tipo] == 'corazones' || vtipo[tipo] == 'rombos')){
                puntos = 0;
            } else if (i == 13 && (vtipo[tipo] == 'picas' || vtipo[tipo] == 'treboles')){
                puntos = 20;
            } else {
                puntos = i;
            }
            baraja.push(GameManager.crearCarta(i, vtipo[tipo], 'ninguna', puntos));
        }
    }

    for (let i = 1; i <= 3; i++) {
        baraja.push(GameManager.crearCarta(52 + i, 'jocker', 'ninguna', -1));
    }
    return baraja;
}

private static mezclarArray<T>(array: T[]): T[] {
  const resultado = [...array];

  for (let i = resultado.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [resultado[i], resultado[j]] = [resultado[j], resultado[i]];
  }

  return resultado;
}

 private generateRoomCode(): string {
    let code = '';

    for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
      const randomIndex = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
      code += ROOM_CODE_CHARS[randomIndex];
    }

    return code;
  }

  private generateUniqueRoomCode(): string {
    let candidate = this.generateRoomCode();

    while (this.games.has(candidate)) {
      candidate = this.generateRoomCode();
    }

    return candidate;
  }

  private static asignarCartasJugadores(baraja : Card[],
                estadoJugadores : PlayerState[], numJugadores : number){
    for(let cartas=0; cartas <= 3 ; cartas++){
        for(let jugador = 0; jugador <= numJugadores-1; jugador++){
            const carta = baraja.pop();
            if (!carta) {
                throw new Error('No quedan cartas en la baraja');
            }
            estadoJugadores[jugador].cartasMano.push(carta);
        }
    }
  }
    
    inicioPartida(
        numJugadores : number, 
        codigoSala : string,
        idJugadores: string[],
        ) : Game {
        if (this.roomToGame.has(codigoSala)) {
            throw new Error('Ya existe una partida activa para la sala');
        }

        const aux : Card[] = GameManager.rellenarBaraja();
        const baraja : Card[] = GameManager.mezclarArray(aux);
        const gameCode = this.generateUniqueRoomCode();
        const estadoJugadores: PlayerState[] = Array.from(
            { length: numJugadores },
            () => ({
                cartasMano: [],
                habilidadesActivadas: [],
            }),
        );

        GameManager.asignarCartasJugadores(baraja, estadoJugadores,
                                numJugadores);
        const estadoGlobal : GameState =  {
            turn:0,
            cartasVigentes: baraja,
            cartasDescartadas: [],
            habilidadesActivadas: [],
            turnoJugadores : idJugadores,
            jugadores: estadoJugadores,
        };

        const partida : Game = {
            gameId: gameCode,
            roomId: codigoSala,
            estado: 'activo',
            estadoGlobal: estadoGlobal,
            updatedAt: new Date(),
        }
        this.reaccionCarta.set(gameCode,true);
        this.games.set(gameCode, partida);
        this.roomToGame.set(codigoSala, gameCode);
        return partida;
    }

    //FIX de seguridad
    robarCarta(partida : Game, userId :string) {
        //comprobar que sea el turno del jugador
        const turno = partida.estadoGlobal.turn;
        const turnUserId = partida.estadoGlobal.turnoJugadores[turno];
        if(userId == turnUserId){
            const idEnPartida = partida.estadoGlobal.turnoJugadores.    
                                                        indexOf(userId);
            const cartaRobada = partida.estadoGlobal.cartasVigentes.pop();
            if(!cartaRobada){
                //TODO: rebarajar, decir al front que se rebaraja y darle la carta robada
                throw new Error("No quedan cartas para robar")
            }
            partida.estadoGlobal.jugadores[idEnPartida].cartaPendiente
                = cartaRobada;
        } else {
            throw new Error('No es el turno del jugador que intenta jugar');
        }      
    }

    descartarCarta(partida: Game , userId : string, cartaSobreOtra : boolean
        , numCarta : number
    ){
        if(!cartaSobreOtra){
            const turno = partida.estadoGlobal.turn;
            const turnUserId = partida.estadoGlobal.turnoJugadores[turno];
            if(userId != turnUserId){
                throw new Error('No es el turno del jugador que intenta jugar');
            }
        } else {
            //operativa de poner carta sobre otra, no hace falta comprobar el 
            //turno del jugador
            const idEnPartida = partida.estadoGlobal.turnoJugadores.indexOf(userId);
            const carta = partida.estadoGlobal.jugadores[idEnPartida]
                .cartasMano[numCarta];
            partida.estadoGlobal.cartasDescartadas.push(carta);
            partida.estadoGlobal.jugadores[idEnPartida]
                        .cartasMano.splice(numCarta, 1);
            //this.reaccionCarta.set(partida.gameId,true);

        }
    }
    descartarCartaPendiente(partida: Game, userId : string) : Card{
        const turno = partida.estadoGlobal.turn;
        const turnUserId = partida.estadoGlobal.turnoJugadores[turno];
        if(userId == turnUserId){
            const idEnPartida = partida.estadoGlobal.turnoJugadores.    
                                                        indexOf(userId);
            const cartaPendiente = partida.estadoGlobal.jugadores[idEnPartida]
                                                            .cartaPendiente;
            if(!cartaPendiente){
                throw new Error('No hay carta pendiente');
            }
            partida.estadoGlobal.cartasDescartadas.push(cartaPendiente);
            partida.estadoGlobal.jugadores[idEnPartida].cartaPendiente 
                = undefined;
            this.reaccionCarta.set(partida.gameId,true); //Reactivo la posibilidad de que otro jugador pueda colocar carta sobre otra
            return cartaPendiente; 
        } else {
            throw new Error('No es el turno del jugador que intenta jugar');
        }     
    }

    descartarCartaPorPendiente(partida: Game, numCarta: number, userId: string)
    : Card{
        const turno = partida.estadoGlobal.turn;
        const turnUserId = partida.estadoGlobal.turnoJugadores[turno]
        if(userId == turnUserId){
            const idEnPartida = partida.estadoGlobal.turnoJugadores.    
                                                        indexOf(userId);
            const cartaPendiente = partida.estadoGlobal.jugadores[idEnPartida]
                                                            .cartaPendiente;
            if(!cartaPendiente){
                throw new Error('No hay carta pendiente');
            }
            const cartaDescartar = partida.estadoGlobal.jugadores[idEnPartida]
                                                        .cartasMano[numCarta];
            if(!cartaDescartar){
                throw new Error('No tienes esa carta en la mano');
            }
            partida.estadoGlobal.cartasDescartadas.push(cartaDescartar);
            partida.estadoGlobal.jugadores[idEnPartida].cartasMano[numCarta]
                = cartaPendiente;  
            partida.estadoGlobal.jugadores[idEnPartida].cartaPendiente = undefined;  
            this.reaccionCarta.set(partida.gameId,true); //Reactivo la posibilidad de que otro jugador pueda colocar carta sobre otra
            return cartaDescartar;
        } else {
            throw new Error('No es el turno del jugador que intenta jugar');
        }
    }

    intercambiarCarta(partida: Game, remitenteId:string, destinatarioId:string,
        numCartaRemitente: number, numCartaDestinatario: number
    ){  
        const turno = partida.estadoGlobal.turn;
        const turnUserId = partida.estadoGlobal.turnoJugadores[turno]
        if(remitenteId == turnUserId){
            const idEnPartidaR = partida.estadoGlobal.turnoJugadores.    
                                                        indexOf(remitenteId);
            const idEnPartidaD = partida.estadoGlobal.turnoJugadores.    
                                                        indexOf(destinatarioId);
            if (idEnPartidaD == -1){
                throw new Error('El destinatario no está registrado en la \
                    partida');
            }
            const cartaRemitente = partida.estadoGlobal.jugadores[idEnPartidaR]
            .cartasMano[numCartaRemitente];

            if(!cartaRemitente){
                throw new Error('No tienes en la mano la carta seleccionada');
            }
            const cartaDestinatario = partida.estadoGlobal.jugadores[idEnPartidaD]
            .cartasMano[numCartaDestinatario]
            if(!cartaDestinatario){
                throw new Error('El destinatario no tiene en la mano la carta \
                    seleccionada');
            }

            partida.estadoGlobal.jugadores[idEnPartidaD]
            .cartasMano[numCartaDestinatario] = cartaRemitente;
            
            partida.estadoGlobal.jugadores[idEnPartidaR]
            .cartasMano[numCartaRemitente] = cartaDestinatario;

        } else {
            throw new Error('No es el turno del jugador que intenta jugar');
        }
    
    }

    verCarta(partida: Game, numCarta: number, userId: string) : Card{

        const turno = partida.estadoGlobal.turn;
        const turnUserId = partida.estadoGlobal.turnoJugadores[turno]
        if(userId == turnUserId){
            const idEnPartida = partida.estadoGlobal.turnoJugadores.    
                                                        indexOf(userId);
            if (idEnPartida == -1){
                throw new Error('El usuario no está registrado en la \
                    partida');
            }
            const cartaAVer = partida.estadoGlobal.jugadores[idEnPartida]
            .cartasMano[numCarta];

            if(!cartaAVer){
                throw new Error('No tienes en la mano la carta seleccionada');
            }
           
            return cartaAVer;

        } else {
            throw new Error('No es el turno del jugador que intenta jugar');
        }
    }

    intercambiarTodasCartas(partida: Game, remitenteId:string, destinatarioId:string){
        const turno = partida.estadoGlobal.turn;
        const turnUserId = partida.estadoGlobal.turnoJugadores[turno]
        if(remitenteId === turnUserId){
            const idEnPartidaR = partida.estadoGlobal.turnoJugadores.    
                                                        indexOf(remitenteId);
            const idEnPartidaD = partida.estadoGlobal.turnoJugadores.    
                                                        indexOf(destinatarioId);
            if (idEnPartidaD === -1){
                throw new Error('El destinatario no está registrado en la \
                    partida');
            }

            //intercambiar cartas. (... para shallow copy y no referencia)
            const cartasRemitente = [...partida.estadoGlobal.jugadores[idEnPartidaR].cartasMano];
            partida.estadoGlobal.jugadores[idEnPartidaR].cartasMano = [...partida.estadoGlobal.jugadores[idEnPartidaD].cartasMano];
            partida.estadoGlobal.jugadores[idEnPartidaD].cartasMano = cartasRemitente;

        } else {
            throw new Error('No es el turno del jugador que intenta jugar');
        }

    }    
    
    calcularPuntosJugador(partida: Game, userId: string) : number{
        
        const idEnPartida = partida.estadoGlobal.turnoJugadores.    
                                                        indexOf(userId);
        if (idEnPartida == -1){
            throw new Error('El usuario no está registrado en la \
                    partida');
        }
            
        const cartasJugador = partida.estadoGlobal.jugadores[idEnPartida]
            .cartasMano;
        const puntosJugador = cartasJugador.reduce((total, carta) => total + carta.puntos, 0);
        return puntosJugador;
        
    }


    //esta función la puede invocar cualquier jugador en cualquier momento de la
    //partida después de que otro jugador descarte una carta
    solicitarColocarCartaSobreOtra(idPartida: string, userId : string) : boolean {
        const reaccionCarta = this.reaccionCarta.get(idPartida);
        if(reaccionCarta == true){
            this.reaccionCarta.set(idPartida,false);
            this.reaccionUserId.set(idPartida,userId);
            return true;
        } else{
            return false;
        }
    }

    private finalizarPartida(partida: Game, ganadorId: string): void {
        // TODO: notificar a gateway/service con el resultado final y limpieza global.
        partida.estado = 'terminado';
        partida.updatedAt = new Date();
        this.reaccionCarta.delete(partida.gameId);
        this.reaccionUserId.delete(partida.gameId);
    }

    private validarFinPartidaPorSinCartas(partida: Game, userId: string): boolean {
        const idEnPartida = partida.estadoGlobal.turnoJugadores.indexOf(userId);
        if (idEnPartida === -1) {
            return false;
        }

        const numCartas = partida.estadoGlobal.jugadores[idEnPartida].cartasMano.length;
        if (numCartas === 0) {
            this.finalizarPartida(partida, userId);
            return true;
        }

        return false;
    }

    ponerCartaSobreOtra(partida: Game, userId : string, numCarta : number){
        let accionCorrecta;
        let numCartas;
        
        const idPartida = partida.gameId;
        const reaccionUserId = this.reaccionUserId.get(idPartida);
        if(userId == reaccionUserId){
            const idEnPartida = partida.estadoGlobal.turnoJugadores
                .indexOf(userId);
            numCartas = partida.estadoGlobal.jugadores[idEnPartida]
                            .cartasMano.length
            if(numCarta < 0 || numCarta > numCartas-1){
                throw new Error('La carta que se quiere jugar no \
                    está disponible');
            }

            const carta = partida.estadoGlobal.jugadores[idEnPartida].
                cartasMano[numCarta];
            const ultimaCartaPendiente = partida.estadoGlobal.cartasDescartadas[
                partida.estadoGlobal.cartasDescartadas.length -1];
            
            if(ultimaCartaPendiente != null){
                
                //gestionar la excepción de que los reyes tienen distinta 
                //puntuación en función del palo pero siguen siendo el mismo
                //número
            
                if(carta.carta == ultimaCartaPendiente.carta){
                    //actividad normal, deja poner la carta encima de la otra
                    //descartar carta
                    this.descartarCarta(partida, userId, true, numCarta);
                    numCartas = partida.estadoGlobal.jugadores[idEnPartida]
                            .cartasMano.length
                    this.validarFinPartidaPorSinCartas(partida, userId);
                    accionCorrecta = true;
                } else {
                    //el jugador ha fallado a la hora de elegir la carta
                    const cartaRobada = partida.estadoGlobal.cartasVigentes.pop();
                    if(!cartaRobada){
                        throw new Error("No quedan cartas para robar")
                    }
                    partida.estadoGlobal.jugadores[idEnPartida].cartasMano[
                        partida.estadoGlobal.jugadores[idEnPartida].cartasMano.length
                    ] = cartaRobada;
                    numCartas = partida.estadoGlobal.jugadores[idEnPartida]
                            .cartasMano.length
                    accionCorrecta = false;
                }
                return {accionCorrecta: accionCorrecta, numCartas: numCartas};
            } else {
                throw new Error('Ya no quedan cartas en el mazo para robar');
            }        
        } else {
            throw new Error('El jugador no tiene permiso para realizar esta \
                acción en este turno');
        }
    }
}


