export type BotActionType =
  | 'robar'
  | 'descartar-pendiente'
  | 'carta-por-pendiente'
  | 'ver-carta'
  | 'intercambiar-carta'
  | 'intercambiar-todas-cartas'
  | 'hacer-robar-carta'
  | 'proteger-carta'
  | 'esperar'
  | 'resolver-habilidad';

export interface BotAction {
  accion: BotActionType;
  cartaIndex?: number;
  targetUserId?: string;
  skillData?: Record<string, any>;
}
