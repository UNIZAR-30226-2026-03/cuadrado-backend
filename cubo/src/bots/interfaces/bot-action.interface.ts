export type BotActionType =
  | 'robar'
  | 'descartar-pendiente'
  | 'carta-por-pendiente'
  | 'ver-carta'
  | 'ver-carta-todos'
  | 'ver-carta-propia-y-rival'
  | 'intercambiar-carta'
  | 'intercambiar-carta-interactivo'
  | 'intercambiar-todas-cartas'
  | 'hacer-robar-carta'
  | 'proteger-carta'
  | 'saltar-turno-jugador'
  | 'jugador-menos-puntuacion'
  | 'resolver-j'
  | 'esperar'
  | 'resolver-habilidad'
  | 'no-action';

export interface BotAction {
  accion: BotActionType;
  cartaIndex?: number;
  targetUserId?: string;
  cartaIndexTarget?: number;
  intercambiar?: boolean;
  skillData?: Record<string, any>;
}
