export enum GameStatus {
  START = 'START',
  PLAYING = 'PLAYING',
  LEVEL_UP = 'LEVEL_UP',
  WON = 'WON',
  LOST = 'LOST'
}

export interface Point {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
}

export interface EnemyRocket extends Entity {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
}

export interface InterceptorMissile extends Entity {
  startX: number;
  startY: number;
  vx: number;
  vy: number;
  speed: number;
}

export interface Explosion extends Entity {
  radius: number;
  maxRadius: number;
  growing: boolean;
  life: number; // 0 to 1
}

export interface City extends Entity {
  destroyed: boolean;
  shields: number;
}

export interface Battery extends Entity {
  ammo: number;
  maxAmmo: number;
  destroyed: boolean;
  shields: number;
}
