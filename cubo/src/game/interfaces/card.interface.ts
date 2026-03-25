export type PaloCarta =
  | 'corazones'
  | 'picas'
  | 'rombos'
  | 'treboles'
  | 'jocker';

export interface Card {
  carta: number;
  palo: PaloCarta;
  // TODO: hay que cambiar la habilidad por el tipo cuando esté creado
  habilidad: string;
  puntos: number;
}
