export type PaloCarta = 'corazones' | 'picas' | 'rombos' | 'treboles' | 'joker';

export type Habilidad =
  | 'AS: intercambiar todas'
  | '2: que alguien robe una'
  | '3: proteger'
  | '4: saltar turno'
  | '5: mirar una de cada uno'
  | '6: robar una'
  | '7: menos puntos'
  | '8: escudo'
  | '9: pactar intercambio'
  | '10: ver carta'
  | 'J: ver y cambiar'
  | 'ninguna';

export interface Card {
  carta: number;
  palo: PaloCarta;
  habilidad: Habilidad;
}
