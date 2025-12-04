import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Player, Enemy, Projectile, Particle, GameState, Vector2D } from '../types';
import { getAICommentary } from '../services/geminiService';

// --- Constants ---
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const PLAYER_SPEED = 4;
const DASH_SPEED = 15;
const DASH_DURATION = 10;
const DASH_COOLDOWN = 60;
const FRICTION = 0.92;
const ENEMY_SPAWN_RATE_INITIAL = 60;

// Helper Math
const getDist = (p1: Vector2D, p2: Vector2D) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
const normalize = (v: Vector2D): Vector2D => {
  const m = Math.hypot(v.x, v.y);
  return m === 0 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
};

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [hp, setHp] = useState(100);
  const [commentary, setCommentary] = useState<string>("System: Waiting for pilot...");
  const [wave, setWave] = useState(1);
  const [dashReady, setDashReady] = useState(true);

  // Game State Refs (Mutable for performance)
  const playerRef = useRef<Player>({
    id: 'p1', pos: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 }, velocity: { x: 0, y: 0 },
    radius: 15, color: '#00f3ff', active: true,
    hp: 100, maxHp: 100, score: 0, dashCooldown: 0, weaponCooldown: 0, level: 1, xp: 0, iframe: 0
  });
  
  const enemiesRef = useRef<Enemy[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const mouseRef = useRef<Vector2D>({ x: 0, y: 0 });
  const frameRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const scoreRef = useRef<number>(0); // Ref for sync inside loop
  
  // Audio placeholders (browser policy often blocks auto audio, visuals focus here)
  
  const createParticle = (x: number, y: number, color: string, count: number = 5) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      particlesRef.current.push({
        id: Math.random().toString(),
        pos: { x, y },
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        radius: Math.random() * 2 + 1,
        color: color,
        active: true,
        life: 30 + Math.random() * 20,
        maxLife: 50,
        size: Math.random() * 3
      });
    }
  };

  const spawnEnemy = () => {
    const edge = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
    let x = 0, y = 0;
    const padding = 50;
    
    switch(edge) {
      case 0: x = Math.random() * CANVAS_WIDTH; y = -padding; break;
      case 1: x = CANVAS_WIDTH + padding; y = Math.random() * CANVAS_HEIGHT; break;
      case 2: x = Math.random() * CANVAS_WIDTH; y = CANVAS_HEIGHT + padding; break;
      case 3: x = -padding; y = Math.random() * CANVAS_HEIGHT; break;
    }

    const typeRoll = Math.random();
    let type: Enemy['type'] = 'basic';
    let hp = 10 + (wave * 2);
    let speed = 2 + (wave * 0.1);
    let radius = 12;
    let color = '#ff00ff';
    let value = 10;

    if (typeRoll > 0.8 && wave > 2) {
      type = 'tank';
      hp = 40 + (wave * 5);
      speed = 1.5;
      radius = 20;
      color = '#ffe600'; // Yellow
      value = 30;
    } else if (typeRoll > 0.6 && wave > 1) {
      type = 'dasher';
      hp = 15 + (wave * 2);
      speed = 4.5;
      radius = 10;
      color = '#0aff00'; // Green
      value = 20;
    }

    enemiesRef.current.push({
      id: Math.random().toString(),
      pos: { x, y },
      velocity: { x: 0, y: 0 },
      radius, color, active: true,
      type, hp, value
    });
  };

  const startGame = useCallback(async () => {
    // Reset State
    playerRef.current = {
      id: 'p1', pos: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 }, velocity: { x: 0, y: 0 },
      radius: 15, color: '#00f3ff', active: true,
      hp: 100, maxHp: 100, score: 0, dashCooldown: 0, weaponCooldown: 0, level: 1, xp: 0, iframe: 0
    };
    enemiesRef.current = [];
    projectilesRef.current = [];
    particlesRef.current = [];
    scoreRef.current = 0;
    setScore(0);
    setHp(100);
    setWave(1);
    setGameState(GameState.PLAYING);
    
    const comment = await getAICommentary('start', { score: 0, wave: 1 });
    setCommentary(comment);
  }, []);

  const handleGameOver = async () => {
    setGameState(GameState.GAME_OVER);
    const comment = await getAICommentary('game_over', { score: scoreRef.current, wave: Math.floor(scoreRef.current / 500) + 1 });
    setCommentary(comment);
  };

  // --- Input Handlers ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.code] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
    const handleMouseMove = (e: MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            mouseRef.current = {
                x: (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width),
                y: (e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height)
            };
        }
    };
    const handleMouseDown = () => { keysRef.current['MouseLeft'] = true; };
    const handleMouseUp = () => { keysRef.current['MouseLeft'] = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // --- Main Game Loop ---
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;

    let animationFrameId: number;

    const loop = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      const player = playerRef.current;

      // 1. Update Player Movement
      let dx = 0;
      let dy = 0;
      if (keysRef.current['KeyW'] || keysRef.current['ArrowUp']) dy -= 1;
      if (keysRef.current['KeyS'] || keysRef.current['ArrowDown']) dy += 1;
      if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']) dx -= 1;
      if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']) dx += 1;

      // Normalize input vector
      const input = normalize({ x: dx, y: dy });

      // Dash Logic
      if (player.dashCooldown > 0) player.dashCooldown--;
      else setDashReady(true);

      const isDashing = player.dashCooldown > (DASH_COOLDOWN - DASH_DURATION);

      if (keysRef.current['Space'] && player.dashCooldown <= 0) {
        player.dashCooldown = DASH_COOLDOWN;
        setDashReady(false);
        // Dash towards mouse if moving, or input direction
        const dashDir = (input.x === 0 && input.y === 0) 
            ? normalize({ x: mouseRef.current.x - player.pos.x, y: mouseRef.current.y - player.pos.y })
            : input;
        
        player.velocity.x = dashDir.x * DASH_SPEED;
        player.velocity.y = dashDir.y * DASH_SPEED;
        player.iframe = 10; // Invulnerable during dash
        createParticle(player.pos.x, player.pos.y, '#00f3ff', 8);
      } else if (!isDashing) {
        // Normal movement
        player.velocity.x += input.x * 0.5;
        player.velocity.y += input.y * 0.5;
        
        // Friction
        player.velocity.x *= FRICTION;
        player.velocity.y *= FRICTION;

        // Cap speed
        const currentSpeed = Math.hypot(player.velocity.x, player.velocity.y);
        if (currentSpeed > PLAYER_SPEED) {
            player.velocity.x = (player.velocity.x / currentSpeed) * PLAYER_SPEED;
            player.velocity.y = (player.velocity.y / currentSpeed) * PLAYER_SPEED;
        }
      }

      player.pos.x += player.velocity.x;
      player.pos.y += player.velocity.y;

      // Boundaries
      player.pos.x = Math.max(player.radius, Math.min(CANVAS_WIDTH - player.radius, player.pos.x));
      player.pos.y = Math.max(player.radius, Math.min(CANVAS_HEIGHT - player.radius, player.pos.y));

      // 2. Update Weapons (Auto-shoot or Mouse Click)
      if (player.weaponCooldown > 0) player.weaponCooldown--;
      if ((keysRef.current['MouseLeft'] || true) && player.weaponCooldown <= 0) { // Auto-fire enabled by default for "gameplay flow"
        const angle = Math.atan2(mouseRef.current.y - player.pos.y, mouseRef.current.x - player.pos.x);
        projectilesRef.current.push({
          id: Math.random().toString(),
          pos: { x: player.pos.x + Math.cos(angle) * 20, y: player.pos.y + Math.sin(angle) * 20 },
          velocity: { x: Math.cos(angle) * 12, y: Math.sin(angle) * 12 },
          radius: 4,
          color: '#ffffff',
          active: true,
          damage: 10 + (player.level * 2),
          isEnemy: false
        });
        player.weaponCooldown = 8; // Fire rate
      }

      // 3. Update Projectiles
      projectilesRef.current.forEach(p => {
        p.pos.x += p.velocity.x;
        p.pos.y += p.velocity.y;
        if (p.pos.x < 0 || p.pos.x > CANVAS_WIDTH || p.pos.y < 0 || p.pos.y > CANVAS_HEIGHT) {
          p.active = false;
        }
      });

      // 4. Update Enemies & Spawning
      spawnTimerRef.current++;
      const currentSpawnRate = Math.max(20, ENEMY_SPAWN_RATE_INITIAL - (scoreRef.current / 100)); // Harder over time
      if (spawnTimerRef.current > currentSpawnRate) {
        spawnEnemy();
        spawnTimerRef.current = 0;
      }

      enemiesRef.current.forEach(e => {
        // Simple AI: Move towards player
        const angle = Math.atan2(player.pos.x - e.pos.x, player.pos.y - e.pos.y);
        // Flocking behavior (separation)
        let pushX = 0, pushY = 0;
        enemiesRef.current.forEach(other => {
          if (e === other) return;
          const d = getDist(e.pos, other.pos);
          if (d < e.radius + other.radius) {
            pushX += (e.pos.x - other.pos.x) / d;
            pushY += (e.pos.y - other.pos.y) / d;
          }
        });

        e.velocity.x = Math.sin(angle) * e.velocity.x + (Math.sin(angle) * 0.2) + pushX; // Smooth turn
        e.velocity.y = Math.cos(angle) * e.velocity.y + (Math.cos(angle) * 0.2) + pushY;

        // Simplify velocity for standard tracking
        const dx = player.pos.x - e.pos.x;
        const dy = player.pos.y - e.pos.y;
        const dist = Math.hypot(dx, dy);
        
        let moveSpeed = 2;
        if (e.type === 'dasher') moveSpeed = 4;
        if (e.type === 'tank') moveSpeed = 1;

        if (dist > 0) {
            e.pos.x += (dx / dist) * moveSpeed + pushX;
            e.pos.y += (dy / dist) * moveSpeed + pushY;
        }
        
        // Collision: Enemy <-> Player
        if (player.iframe <= 0 && getDist(e.pos, player.pos) < e.radius + player.radius) {
            player.hp -= 10;
            player.iframe = 30; // 0.5s invincibility
            setHp(player.hp);
            createParticle(player.pos.x, player.pos.y, '#ff0000', 10);
            
            // Screen shake effect (simulated by offsetting canvas context next frame, simplified here)
            if (player.hp <= 30) {
                getAICommentary('low_health', { score: scoreRef.current, wave: Math.floor(scoreRef.current/500)+1 }).then(setCommentary);
            }
            if (player.hp <= 0) {
                handleGameOver();
            }
        }
      });

      // 5. Collisions: Projectile <-> Enemy
      projectilesRef.current.forEach(p => {
        if (!p.active) return;
        enemiesRef.current.forEach(e => {
          if (!e.active) return;
          if (getDist(p.pos, e.pos) < p.radius + e.radius) {
            p.active = false;
            e.hp -= p.damage;
            createParticle(e.pos.x, e.pos.y, e.color, 2);
            
            if (e.hp <= 0) {
              e.active = false;
              createParticle(e.pos.x, e.pos.y, e.color, 8);
              scoreRef.current += e.value;
              setScore(scoreRef.current);
              
              // Wave management logic based on score
              const newWave = Math.floor(scoreRef.current / 500) + 1;
              if (newWave > wave) {
                  setWave(newWave);
                  getAICommentary('level_up', { score: scoreRef.current, wave: newWave }).then(setCommentary);
              }
              
              // Random AI comment on streaks (simplified random chance)
              if (Math.random() < 0.05) {
                  getAICommentary('kill_streak', { score: scoreRef.current, wave: Math.floor(scoreRef.current/500)+1 }).then(setCommentary);
              }
            }
          }
        });
      });

      // 6. Update Particles
      particlesRef.current.forEach(p => {
        p.pos.x += p.velocity.x;
        p.pos.y += p.velocity.y;
        p.life--;
        p.velocity.x *= 0.95;
        p.velocity.y *= 0.95;
        if (p.life <= 0) p.active = false;
      });

      // Cleanup inactive entities
      projectilesRef.current = projectilesRef.current.filter(p => p.active);
      enemiesRef.current = enemiesRef.current.filter(e => e.active);
      particlesRef.current = particlesRef.current.filter(p => p.active);
      if (player.iframe > 0) player.iframe--;

      // --- Draw Phase ---
      // Clear
      ctx.fillStyle = '#050505'; // Very dark grey, almost black
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Grid background (Cyberpunk style)
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 1;
      const gridSize = 50;
      // Parallax-ish effect based on player pos
      const offsetX = -(player.pos.x / 10) % gridSize;
      const offsetY = -(player.pos.y / 10) % gridSize;
      
      ctx.beginPath();
      for (let x = offsetX; x < CANVAS_WIDTH; x += gridSize) {
        ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_HEIGHT);
      }
      for (let y = offsetY; y < CANVAS_HEIGHT; y += gridSize) {
        ctx.moveTo(0, y); ctx.lineTo(CANVAS_WIDTH, y);
      }
      ctx.stroke();

      // Enable Glow
      ctx.shadowBlur = 15;

      // Draw Particles
      particlesRef.current.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Draw Projectiles
      projectilesRef.current.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Enemies
      enemiesRef.current.forEach(e => {
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 3;
        ctx.shadowColor = e.color;
        ctx.fillStyle = '#000';
        
        ctx.beginPath();
        if (e.type === 'tank') {
            // Square for tanks
            ctx.rect(e.pos.x - e.radius, e.pos.y - e.radius, e.radius * 2, e.radius * 2);
        } else if (e.type === 'dasher') {
            // Triangle for dashers
            ctx.moveTo(e.pos.x, e.pos.y - e.radius);
            ctx.lineTo(e.pos.x + e.radius, e.pos.y + e.radius);
            ctx.lineTo(e.pos.x - e.radius, e.pos.y + e.radius);
            ctx.closePath();
        } else {
            // Circle for basic
            ctx.arc(e.pos.x, e.pos.y, e.radius, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();
      });

      // Draw Player
      if (player.active) {
        ctx.save();
        ctx.translate(player.pos.x, player.pos.y);
        
        // Rotate towards mouse
        const angle = Math.atan2(mouseRef.current.y - player.pos.y, mouseRef.current.x - player.pos.x);
        ctx.rotate(angle + Math.PI / 2); // Adjust so top of ship points to mouse

        ctx.shadowColor = player.color;
        ctx.shadowBlur = 20;
        ctx.fillStyle = player.iframe > 0 && Math.floor(Date.now() / 50) % 2 === 0 ? '#fff' : player.color;

        // Draw Ship Shape (Triangle)
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(15, 15);
        ctx.lineTo(0, 10);
        ctx.lineTo(-15, 15);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
      }

      // Draw Crosshair
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(mouseRef.current.x, mouseRef.current.y, 10, 0, Math.PI * 2);
      ctx.moveTo(mouseRef.current.x - 15, mouseRef.current.y);
      ctx.lineTo(mouseRef.current.x + 15, mouseRef.current.y);
      ctx.moveTo(mouseRef.current.x, mouseRef.current.y - 15);
      ctx.lineTo(mouseRef.current.x, mouseRef.current.y + 15);
      ctx.stroke();

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, startGame, wave]);

  return (
    <div className="relative w-full h-screen bg-slate-900 flex items-center justify-center overflow-hidden">
      
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="w-full h-full object-contain cursor-none"
      />

      {/* UI Overlay: HUD */}
      {gameState === GameState.PLAYING && (
        <>
          <div className="absolute top-4 left-4 text-neon-blue font-bold text-2xl tracking-widest pointer-events-none select-none drop-shadow-[0_0_10px_rgba(0,243,255,0.8)]">
            SCORE: {score.toString().padStart(6, '0')}
          </div>
          
          <div className="absolute top-4 right-4 pointer-events-none select-none">
            <div className="flex flex-col items-end gap-2">
                <div className="text-neon-pink font-bold text-xl drop-shadow-[0_0_10px_rgba(255,0,255,0.8)]">
                    HP: {hp}%
                </div>
                <div className="w-48 h-4 border-2 border-neon-pink rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-neon-pink transition-all duration-200"
                        style={{ width: `${hp}%`, boxShadow: '0 0 15px #ff00ff' }}
                    />
                </div>
            </div>
          </div>

          <div className="absolute bottom-8 right-8 pointer-events-none">
             <div className="flex flex-col items-center">
                <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center transition-all ${dashReady ? 'border-neon-green shadow-[0_0_20px_#0aff00]' : 'border-gray-600 opacity-50'}`}>
                    <span className="text-white font-bold text-sm">DASH</span>
                </div>
                <span className="text-white text-xs mt-1">SPACEBAR</span>
             </div>
          </div>

          {/* AI Commentary Box */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-3/4 max-w-2xl pointer-events-none">
            <div className="bg-black/60 border border-neon-blue/30 backdrop-blur-sm p-4 rounded-lg text-center transform transition-all duration-300">
                <p className="text-neon-blue font-mono text-lg animate-pulse-fast drop-shadow-md">
                   &gt; {commentary} <span className="animate-pulse">_</span>
                </p>
            </div>
          </div>
        </>
      )}

      {/* Main Menu */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10 backdrop-blur-sm">
          <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-pink mb-4 drop-shadow-[0_0_25px_rgba(0,243,255,0.5)] tracking-tighter">
            NEON NEXUS
          </h1>
          <p className="text-white/80 mb-8 text-xl font-light tracking-widest">SURVIVOR PROTOCOL_V1</p>
          <div className="flex gap-4">
              <div className="text-slate-400 text-sm mb-8 border border-slate-700 p-4 rounded bg-slate-900/50">
                  <p>WASD / ARROWS to Move</p>
                  <p>MOUSE to Aim</p>
                  <p>AUTO-FIRE ACTIVE</p>
                  <p>SPACE to Dash (Immune)</p>
              </div>
          </div>
          <button
            onClick={startGame}
            className="px-12 py-4 bg-neon-blue/10 border-2 border-neon-blue text-neon-blue font-bold text-xl rounded hover:bg-neon-blue hover:text-black transition-all duration-300 shadow-[0_0_30px_rgba(0,243,255,0.3)] hover:shadow-[0_0_50px_rgba(0,243,255,0.8)]"
          >
            INITIALIZE RUN
          </button>
        </div>
      )}

      {/* Game Over */}
      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-10">
          <h2 className="text-6xl font-bold text-red-500 mb-2 tracking-widest drop-shadow-[0_0_30px_rgba(255,0,0,0.8)]">CRITICAL FAILURE</h2>
          <div className="text-neon-blue text-3xl mb-8 font-mono">FINAL SCORE: {score}</div>
          
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg mb-8 max-w-lg text-center">
             <p className="text-slate-300 italic">"{commentary}"</p>
             <p className="text-slate-600 text-xs mt-2">- System AI</p>
          </div>

          <button
            onClick={startGame}
            className="px-8 py-3 bg-neon-pink/10 border-2 border-neon-pink text-neon-pink font-bold text-lg rounded hover:bg-neon-pink hover:text-black transition-all duration-300 shadow-[0_0_30px_rgba(255,0,255,0.3)]"
          >
            REBOOT SYSTEM
          </button>
        </div>
      )}
    </div>
  );
};

export default GameCanvas;