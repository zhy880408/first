export type Vector2D = {
  x: number;
  y: number;
};

export type EntityType = 'player' | 'enemy_basic' | 'enemy_dasher' | 'enemy_tank' | 'projectile' | 'particle';

export interface Entity {
  id: string;
  pos: Vector2D;
  velocity: Vector2D;
  radius: number;
  color: string;
  active: boolean;
}

export interface Player extends Entity {
  hp: number;
  maxHp: number;
  score: number;
  dashCooldown: number;
  weaponCooldown: number;
  level: number;
  xp: number;
  iframe: number; // invulnerability frames
}

export interface Enemy extends Entity {
  type: 'basic' | 'dasher' | 'tank';
  hp: number;
  value: number; // score value
}

export interface Projectile extends Entity {
  damage: number;
  isEnemy: boolean;
}

export interface Particle extends Entity {
  life: number;
  maxLife: number;
  size: number;
}

export enum GameState {
  MENU,
  PLAYING,
  GAME_OVER,
}

export interface GameStats {
  score: number;
  highScore: number;
  wave: number;
  enemiesKilled: number;
}