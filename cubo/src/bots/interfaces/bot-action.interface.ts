export type BotActionType =
  | 'robar'
  | 'descartar-pendiente'
  | 'carta-por-pendiente'
  | 'ver-carta'
  | 'ver-carta-propia-y-rival'
  | 'intercambiar-carta'
  | 'intercambiar-todas-cartas'
  | 'hacer-robar-carta'
  | 'proteger-carta'
  | 'saltar-turno-jugador'
  | 'jugador-menos-puntuacion'
  | 'esperar'
  | 'resolver-habilidad'
  | 'no-action';

export interface BotAction {
  accion: BotActionType;
  cartaIndex?: number;
  targetUserId?: string;
  cartaIndexTarget?: number;
  skillData?: Record<string, any>;
}
