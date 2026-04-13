import { Injectable } from '@nestjs/common';
import { BotManager } from '../bot.manager';
import { Game } from '../../game/interfaces/game.interface';
import { BotAction } from '../interfaces/bot-action.interface';
import { PermisoHabilidad } from '../../game/game.manager';

/**
 * Estrategia HARD: IA avanzada con análisis de contexto
 * OBJETIVO: Minimizar puntos (quien MENOS tenga gana)
 * INFORMACIÓN: Solo ve cartas de su mano que ya ha visto (cartasVistas)
 * 
 * Cómo funciona:
 * - Turno 1: cartasVistas = [null, null, null, null, null] (no sabe nada)
 * - Roba una carta, decide si descartar (nunca la ve) o intercambiar (registra esa posición)
 * - Usa habilidad "ver-carta" → esa posición se añade a cartasVistas
 * - Análisis: proporciones, puntos = solo sobre cartasVistas (cartas conocidas)
 * 
 * Estrategia adaptativa:
 * - Sin info: juega seguro (descarta)
 * - Con info: análisis probabilístico según cartas vistas + fase del juego
 */
@Injectable()
export class HardBotStrategy extends BotManager {
  decidir(
    partida: Game,
    botId: string,
    contexto: PermisoHabilidad | null,
  ): BotAction {
    const phase = partida.estadoGlobal.phase;
    const estado = this.obtenerEstadoBot(partida, botId);

    // Inicializar cartas vistas si es el primer turno
    if (this.obtenerCartasVistas(botId).length === 0) {
      this.inicializarCartasVistas(botId, estado.cartasMano.length);
    }

    switch (phase) {
      case 'WAIT_DRAW':
        return { accion: 'robar' };

      case 'WAIT_DECISION':
        return this.decidirConPendiente(partida, botId);

      case 'WAIT_SKILL':
        return this.ejecutarHabilidad(partida, botId, contexto);

      default:
        return { accion: 'esperar' };
    }
  }

  /**
   * Análisis contextual sin ver cartas de otros
   * Considera: composición de cartas CONOCIDAS, carta pendiente, fase del juego
   * 
   * Estrategia: 
   * - Sin info pero con oportunidad: intercambia desconocidas por cartas buenas (descubre)
   * - Con info: análisis probabilístico según cartas vistas + fase del juego
   */
  private decidirConPendiente(partida: Game, botId: string): BotAction {
    const estado = this.obtenerEstadoBot(partida, botId);
    const pendiente = estado.cartaPendiente;
    const mano = estado.cartasMano;
    const cartasConocidas = this.obtenerCartasConocidas(botId);
    const indicesDesconocidas = this.obtenerIndicesDesconocidas(botId);

    if (!pendiente || !mano) {
      return { accion: 'descartar-pendiente' };
    }

    //Evaluación de pendiente (ANTES de analizar mano)
    const pendienteEsAlta = pendiente.puntos > 8;
    const pendienteEsBaja = pendiente.puntos <= 4;

    // Situación especial: Sin info pero tiene desconocidas
    // Si roba algo bueno, intenta descubrir intercambiando
    if (cartasConocidas.length === 0 && indicesDesconocidas.length > 0) {
      if (pendienteEsBaja) {
        // Roba baja → intercambia por desconocida (apuesta para descubrir)
        const indiceDesconocida = indicesDesconocidas[
          Math.floor(Math.random() * indicesDesconocidas.length)
        ];
        this.registrarIntercambioPendiente(botId, indiceDesconocida, pendiente);
        return { accion: 'carta-por-pendiente', cartaIndex: indiceDesconocida };
      }
      // Roba alta → descarta (juega seguro)
      return { accion: 'descartar-pendiente' };
    }

    // Análisis 1: Mis puntos actuales EN CARTAS CONOCIDAS
    const cartasAltasConocidas = cartasConocidas.filter(c => c.puntos > 8);
    const cartasBajasConocidas = cartasConocidas.filter(c => c.puntos <= 4);
    const proporcionAltasEnConocidas = 
      cartasConocidas.length > 0 ? cartasAltasConocidas.length / cartasConocidas.length : 0;
    const proporcionBajasEnConocidas = 
      cartasConocidas.length > 0 ? cartasBajasConocidas.length / cartasConocidas.length : 0;

    // Análisis 2: Fase del juego
    const mazosRestantes = partida.estadoGlobal.cartasVigentes.length;
    const esTempranoEnPartida = mazosRestantes > 30;
    const esFinEnPartida = mazosRestantes < 16;

    // ESTRATEGIA HARD CON INFORMACIÓN IMPERFECTA

    // Situación 1: Cartas conocidas desbalanceadas hacia altos + pendiente baja = INTERCAMBIA
    if (proporcionAltasEnConocidas > 0.5 && pendienteEsBaja) {
      const cartaAlta = this.cartaMasAlta(cartasConocidas);
      if (cartaAlta) {
        // Buscar en mano dónde está esta carta
        const indexAlta = mano.indexOf(cartaAlta);
        if (indexAlta !== -1) {
          this.registrarIntercambioPendiente(botId, indexAlta, pendiente);
          return { accion: 'carta-por-pendiente', cartaIndex: indexAlta };
        }
      }
    }

    // Situación 2: Cartas conocidas desbalanceadas hacia altos + pendiente alta = DESCARTA
    if (proporcionAltasEnConocidas > 0.5 && pendienteEsAlta) {
      return { accion: 'descartar-pendiente' };
    }

    // Situación 3: Cartas conocidas bien balanceadas
    if (proporcionAltasEnConocidas <= 0.4 && proporcionBajasEnConocidas >= 0.4) {
      // Si estoy al inicio: sé conservador (mantén buen estado)
      if (esTempranoEnPartida) {
        if (pendienteEsBaja && this.decisonAleatoria(0.6)) {
          // 60% probabilidad intercambiar si es beneficiosa
          const cartaAlta = this.cartaMasAlta(cartasConocidas);
          if (cartaAlta) {
            const indexAlta = mano.indexOf(cartaAlta);
            if (indexAlta !== -1) {
              this.registrarIntercambioPendiente(botId, indexAlta, pendiente);
              return { accion: 'carta-por-pendiente', cartaIndex: indexAlta };
            }
          }
        }
        // 40% descarta
        return { accion: 'descartar-pendiente' };
      }

      // Si estoy al final: sé más agresivo
      if (esFinEnPartida) {
        if (pendienteEsBaja && this.decisonAleatoria(0.8)) {
          // 80% intercambiar si es baja
          const cartaAlta = this.cartaMasAlta(cartasConocidas);
          if (cartaAlta) {
            const indexAlta = mano.indexOf(cartaAlta);
            if (indexAlta !== -1) {
              this.registrarIntercambioPendiente(botId, indexAlta, pendiente);
              return { accion: 'carta-por-pendiente', cartaIndex: indexAlta };
            }
          }
        }
        // 20% descarta
        return { accion: 'descartar-pendiente' };
      }

      // Game normal (ni temprano ni final)
      if (pendienteEsBaja && this.decisonAleatoria(0.7)) {
        const cartaAlta = this.cartaMasAlta(cartasConocidas);
        if (cartaAlta) {
          const indexAlta = mano.indexOf(cartaAlta);
          if (indexAlta !== -1) {
            this.registrarIntercambioPendiente(botId, indexAlta, pendiente);
            return { accion: 'carta-por-pendiente', cartaIndex: indexAlta };
          }
        }
      }
    }

    // Situación 4: Cartas conocidas con muchas bajas (ideal) + pendiente media/alta = DESCARTA
    if (proporcionBajasEnConocidas > 0.6 && pendienteEsAlta) {
      return { accion: 'descartar-pendiente' };
    }

    // Situación 5: No tengo claridad, pero tengo desconocidas y pendiente buena = INTERCAMBIA UNA DESCONOCIDA
    if (indicesDesconocidas.length > 0 && pendienteEsBaja && proporcionAltasEnConocidas <= 0.5) {
      // Intercambia por una carta que no conoce (apuesta)
      const indiceDesconocida = indicesDesconocidas[
        Math.floor(Math.random() * indicesDesconocidas.length)
      ];
      this.registrarIntercambioPendiente(botId, indiceDesconocida, pendiente);
      return { accion: 'carta-por-pendiente', cartaIndex: indiceDesconocida };
    }

    // Default: descarta
    return { accion: 'descartar-pendiente' };
  }

  /**
   * Ejecuta habilidades con decisiones estratégicas e información incompleta
   * 
   * Lógica:
   * - ver-carta-propia: ve una desconocida
   * - intercambiar-carta: intercambio interactivo bidireccional (Carta 9)
   *   * Paso 1 (esperando-iniciador): ofrece una carta CONOCIDA alta
   *   * Paso 2 (esperando-rival): responde eligiendo carta del rival
   * - intercambiar-todas: solo si conoce pocas o tiene muchas altas o rival tiene menos cartas
   * - proteger-carta: protege la más baja conocida (defensa)
   */
  private ejecutarHabilidad(
    partida: Game,
    botId: string,
    permiso: PermisoHabilidad | null,
  ): BotAction {
    if (!permiso) {
      return { accion: 'esperar' };
    }

    const idEnPartida = this.obtenerIndiceJugador(partida, botId);
    const estado = partida.estadoGlobal.jugadores[idEnPartida];
    const cartasConocidas = this.obtenerCartasConocidas(botId);
    const indicesDesconocidas = this.obtenerIndicesDesconocidas(botId);

    switch (permiso.tipo) {
      case 'ver-carta-propia': {
        // Elige una carta que NO conoce (descubrimiento)
        let indice: number;
        if (indicesDesconocidas.length > 0) {
          indice = indicesDesconocidas[
            Math.floor(Math.random() * indicesDesconocidas.length)
          ];
        } else {
          // Si todo es conocido, elige aleatoria
          indice = Math.floor(Math.random() * estado.cartasMano.length);
        }
        
        // Registra la carta vista directamente
        const cartaVista = estado.cartasMano[indice];
        if (cartaVista) {
          this.registrarCartaVista(botId, indice, cartaVista);
        }
        
        return { accion: 'ver-carta', cartaIndex: indice };
      }

      case 'intercambiar-carta': {
        // Manejo del intercambio interactivo bidireccional (Carta 9)
        // Primer paso: botId es quien inicia y elige qué carta ofrecer
        if (!permiso.estado || permiso.estado === 'esperando-iniciador') {
          // Estrategia: ofrece una carta CONOCIDA alta por una del rival
          const cartasAltasConocidas = cartasConocidas.filter(c => c.puntos > 8);
          
          if (cartasAltasConocidas.length === 0) {
            // Sin cartas altas conocidas, elige aleatoria
            let cartaIndex: number;
            
            if (cartasConocidas.length > 0) {
              // Si tiene cartas conocidas pero no altas, elige una aleatoria de las conocidas
              const cartaParaOfrecer = 
                cartasConocidas[Math.floor(Math.random() * cartasConocidas.length)];
              cartaIndex = estado.cartasMano.indexOf(cartaParaOfrecer);
              if (cartaIndex === -1) {
                return { accion: 'esperar' };
              }
            } else {
              // Si no conoce ninguna, elige una aleatoria de toda la mano
              cartaIndex = Math.floor(Math.random() * estado.cartasMano.length);
            }

            const rivalNum = this.obtenerIndiceRivalAleatorio(partida, idEnPartida);
            if (rivalNum === null) {
              return { accion: 'esperar' };
            }

            // Retorna acción del primer paso: preparar intercambio (este paso siempre es el iniciador)
            return {
              accion: 'intercambiar-carta',
              cartaIndex,
              targetUserId: partida.estadoGlobal.turnoJugadores[rivalNum],
            };
          }

          // Ofrece una carta alta conocida
          const cartaAlta = this.cartaMasAlta(cartasAltasConocidas);
          if (!cartaAlta) {
            return { accion: 'esperar' };
          }

          const cartaIndex = estado.cartasMano.indexOf(cartaAlta);
          if (cartaIndex === -1) {
            return { accion: 'esperar' };
          }

          const rivalNum = this.obtenerIndiceRivalAleatorio(partida, idEnPartida);
          if (rivalNum === null) {
            return { accion: 'esperar' };
          }

          return {
            accion: 'intercambiar-carta',
            cartaIndex,
            targetUserId: partida.estadoGlobal.turnoJugadores[rivalNum],
          };
        }

        // Segundo paso: botId es quien responde (el rival ya eligió su carta, ahora el bot elige la suya)
        if (permiso.estado === 'esperando-rival' && permiso.rivalId && permiso.indiceCartaIniciador !== undefined) {
          // El rival ya eligió qué carta del bot quiere
          // El bot elige qué carta de su propia mano quiere dar a cambio
          
          // Estrategia: elige una carta de su mano al azar
          const cartaIndex = Math.floor(Math.random() * estado.cartasMano.length);

          return {
            accion: 'intercambiar-carta',
            cartaIndex,
            targetUserId: permiso.rivalId,
          };
        }

        return { accion: 'esperar' };
      }

      case 'intercambiar-todas': {
        // Estrategia: intercambia TODAS solo si:
        // - Conoce pocas cartas (≤2)
        // - Las que conoce son muchas altas (>50%)
        // - El rival tiene menos cartas
        
        const conocePocas = cartasConocidas.length <= 2;
        const cartasAltasConocidas = cartasConocidas.filter(c => c.puntos > 8);
        const tieneMuchasAltas = cartasConocidas.length > 0 &&
          (cartasAltasConocidas.length / cartasConocidas.length) > 0.5;

        const rivalNum = this.obtenerIndiceRivalAleatorio(partida, idEnPartida);
        if (rivalNum === null) {
          return { accion: 'esperar' };
        }

        const numCartasRival = partida.estadoGlobal.jugadores[rivalNum].cartasMano.length;
        const rivalTieneMenos = numCartasRival < estado.cartasMano.length;

        if (conocePocas || tieneMuchasAltas || rivalTieneMenos) {
          return {
            accion: 'intercambiar-todas-cartas',
            targetUserId: partida.estadoGlobal.turnoJugadores[rivalNum],
          };
        }

        // No intercambia si no hay motivo
        return { accion: 'esperar' };
      }

      case 'hacer-robar-carta': {
        // Sin cambios: elige rival al azar
        const rivalNum = this.obtenerIndiceRivalAleatorio(partida, idEnPartida);
        if (rivalNum === null) {
          return { accion: 'esperar' };
        }

        return {
          accion: 'hacer-robar-carta',
          targetUserId: partida.estadoGlobal.turnoJugadores[rivalNum],
        };
      }

      case 'proteger-carta': {
        // Protege la carta más BAJA conocida (defensa óptima)
        if (cartasConocidas.length === 0) {
          // Sin cartas conocidas, protege aleatoria
          const cartaIndex = Math.floor(Math.random() * estado.cartasMano.length);
          return { accion: 'proteger-carta', cartaIndex };
        }

        const cartaBaja = this.cartaMasBaja(cartasConocidas);
        if (!cartaBaja) {
          return { accion: 'esperar' };
        }

        const cartaIndex = estado.cartasMano.indexOf(cartaBaja);

        if (cartaIndex === -1) {
          return { accion: 'esperar' };
        }

        return { accion: 'proteger-carta', cartaIndex };
      }

      case 'saltar-turno-jugador': {
        // Sin cambios: salta turno de rival al azar
        const rivalNum = this.obtenerIndiceRivalAleatorio(partida, idEnPartida);
        if (rivalNum === null) {
          return { accion: 'esperar' };
        }

        return {
          accion: 'saltar-turno-jugador',
          targetUserId: partida.estadoGlobal.turnoJugadores[rivalNum],
        };
      }

      case 'jugador-menos-puntuacion':
        // Sin cambios: activar habilidad
        return { accion: 'jugador-menos-puntuacion' };

      default:
        return { accion: 'esperar' };
    }
  }

  private obtenerIndiceRivalAleatorio(
    partida: Game,
    idEnPartida: number,
  ): number | null {
    const indicesRivales = partida.estadoGlobal.turnoJugadores
      .map((_, index) => index)
      .filter((index) => index !== idEnPartida);

    if (indicesRivales.length === 0) {
      return null;
    }

    const rivalPosicion = Math.floor(Math.random() * indicesRivales.length);
    return indicesRivales[rivalPosicion];
  }

}
