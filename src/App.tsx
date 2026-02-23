/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Target, Trophy, RotateCcw, Play, Languages } from 'lucide-react';
import { GameStatus, Point, EnemyRocket, InterceptorMissile, Explosion, City, Battery } from './types';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const WIN_SCORE = 1000;
const EXPLOSION_MAX_RADIUS = 70; // Doubled from 35
const EXPLOSION_SPEED = 0.02;
const ROCKET_SPAWN_RATE = 0.0167; // 1 rocket per 1s (1 per sec) at 60fps

export default function App() {
  const [status, setStatus] = useState<GameStatus>(GameStatus.START);
  const [score, setScore] = useState(0);
  const [lang, setLang] = useState<'en' | 'zh'>('zh');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  
  // Game state refs (for performance in the loop)
  const gameState = useRef({
    rockets: [] as EnemyRocket[],
    missiles: [] as InterceptorMissile[],
    explosions: [] as Explosion[],
    cities: [] as City[],
    batteries: [] as Battery[],
    score: 0,
    lastTime: 0,
    spawnTimer: 0
  });

  const t = {
    en: {
      title: "Eric Nova Defense",
      start: "Start Mission",
      restart: "Play Again",
      win: "Victory!",
      lose: "Defeat!",
      score: "Score",
      ammo: "Ammo",
      objective: "Protect the cities from incoming rockets.",
      winMsg: "You have successfully defended the sector!",
      loseMsg: "All defenses have been neutralized.",
      lang: "中文"
    },
    zh: {
      title: "Eric新星防御",
      start: "开始任务",
      restart: "再玩一次",
      win: "胜利！",
      lose: "失败！",
      score: "得分",
      ammo: "弹药",
      objective: "保护城市免受火箭袭击。",
      winMsg: "你成功保卫了该区域！",
      loseMsg: "所有防御设施已被摧毁。",
      lang: "English"
    }
  }[lang];

  const initGame = useCallback(() => {
    const cities: City[] = [];
    // 6 cities
    const citySpacing = CANVAS_WIDTH / 9;
    [1.5, 2.5, 3.5, 5.5, 6.5, 7.5].forEach((pos, i) => {
      cities.push({
        id: `city-${i}`,
        x: pos * citySpacing,
        y: CANVAS_HEIGHT - 30,
        destroyed: false,
        shields: 3
      });
    });

    const batteries: Battery[] = [
      { id: 'bat-0', x: 40, y: CANVAS_HEIGHT - 40, ammo: 40, maxAmmo: 40, destroyed: false, shields: 3 },
      { id: 'bat-1', x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 40, ammo: 80, maxAmmo: 80, destroyed: false, shields: 3 },
      { id: 'bat-2', x: CANVAS_WIDTH - 40, y: CANVAS_HEIGHT - 40, ammo: 40, maxAmmo: 40, destroyed: false, shields: 3 }
    ];

    gameState.current = {
      rockets: [],
      missiles: [],
      explosions: [],
      cities,
      batteries,
      score: 0,
      lastTime: performance.now(),
      spawnTimer: 0
    };
    setScore(0);
  }, []);

  const spawnRocket = useCallback(() => {
    const startX = Math.random() * CANVAS_WIDTH;
    const targets = [...gameState.current.cities, ...gameState.current.batteries].filter(t => !t.destroyed);
    
    if (targets.length === 0) return;
    
    const target = targets[Math.floor(Math.random() * targets.length)];
    
    const rocket: EnemyRocket = {
      id: `rocket-${Date.now()}-${Math.random()}`,
      x: startX,
      y: 0,
      startX,
      startY: 0,
      targetX: target.x,
      targetY: target.y,
      progress: 0,
      speed: 0.0005 + (gameState.current.score / 20000) // All rockets have the same speed, scaling with score
    };
    
    gameState.current.rockets.push(rocket);
  }, []);

  const fireMissile = useCallback((targetX: number, targetY: number) => {
    if (status !== GameStatus.PLAYING) return;

    // Find nearest battery with ammo
    let bestBattery: Battery | null = null;
    let minDist = Infinity;

    gameState.current.batteries.forEach(bat => {
      if (!bat.destroyed && bat.ammo > 0) {
        const d = Math.sqrt(Math.pow(bat.x - targetX, 2) + Math.pow(bat.y - targetY, 2));
        if (d < minDist) {
          minDist = d;
          bestBattery = bat;
        }
      }
    });

    if (bestBattery) {
      const bat = bestBattery as Battery;
      bat.ammo--;
      
      const dx = targetX - bat.x;
      const dy = targetY - bat.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const speed = 20;
      
      const createMissile = (angleOffset = 0) => {
        const angle = Math.atan2(dy, dx) + angleOffset;
        return {
          id: `missile-${Date.now()}-${Math.random()}`,
          x: bat.x,
          y: bat.y,
          startX: bat.x,
          startY: bat.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          speed
        };
      };

      if (bat.id === 'bat-1') {
        // Triple shot for middle battery
        gameState.current.missiles.push(createMissile(0));
        gameState.current.missiles.push(createMissile(-0.1));
        gameState.current.missiles.push(createMissile(0.1));
      } else {
        gameState.current.missiles.push(createMissile(0));
      }
    }
  }, [status]);

  const update = useCallback((time: number) => {
    if (status !== GameStatus.PLAYING) return;

    const state = gameState.current;
    
    // Spawn rockets
    if (Math.random() < ROCKET_SPAWN_RATE) {
      spawnRocket();
    }

    // Update rockets
    state.rockets = state.rockets.filter(rocket => {
      rocket.progress += rocket.speed;
      rocket.x = rocket.startX + (rocket.targetX - rocket.startX) * rocket.progress;
      rocket.y = rocket.startY + (rocket.targetY - rocket.startY) * rocket.progress;

      if (rocket.progress >= 1) {
        // Hit target
        const target = [...state.cities, ...state.batteries].find(t => 
          Math.abs(t.x - rocket.targetX) < 5 && Math.abs(t.y - rocket.targetY) < 5
        );
        if (target) {
          if (target.shields > 0) {
            target.shields--;
          } else {
            target.destroyed = true;
          }
        }
        
        state.explosions.push({
          id: `exp-hit-${Date.now()}`,
          x: rocket.x,
          y: rocket.y,
          radius: 0,
          maxRadius: 20,
          growing: true,
          life: 1
        });
        return false;
      }
      return true;
    });

    // Update missiles
    state.missiles = state.missiles.filter(missile => {
      missile.x += missile.vx;
      missile.y += missile.vy;

      // Check collision with rockets
      let hitRocket = false;
      state.rockets = state.rockets.filter(rocket => {
        const dist = Math.sqrt(Math.pow(rocket.x - missile.x, 2) + Math.pow(rocket.y - missile.y, 2));
        if (dist < 10) { // Direct hit radius
          hitRocket = true;
          state.score += 20;
          setScore(state.score);
          return false;
        }
        return true;
      });

      if (hitRocket) {
        state.explosions.push({
          id: `exp-hit-${Date.now()}`,
          x: missile.x,
          y: missile.y,
          radius: 0,
          maxRadius: EXPLOSION_MAX_RADIUS,
          growing: true,
          life: 1
        });
        return false;
      }

      // Check out of bounds
      if (missile.x < -100 || missile.x > CANVAS_WIDTH + 100 || missile.y < -100 || missile.y > CANVAS_HEIGHT + 100) {
        return false;
      }

      return true;
    });

    // Update explosions
    state.explosions = state.explosions.filter(exp => {
      if (exp.growing) {
        exp.radius += 4; // Faster explosion growth
        if (exp.radius >= exp.maxRadius) exp.growing = false;
      } else {
        exp.radius -= 1;
      }
      
      // Collision with rockets
      state.rockets = state.rockets.filter(rocket => {
        const dist = Math.sqrt(Math.pow(rocket.x - exp.x, 2) + Math.pow(rocket.y - exp.y, 2));
        if (dist < exp.radius) {
          state.score += 20;
          setScore(state.score);
          return false;
        }
        return true;
      });

      return exp.radius > 0;
    });

    // Check game over
    if (state.batteries.every(b => b.destroyed)) {
      setStatus(GameStatus.LOST);
    } else if (state.score >= WIN_SCORE) {
      setStatus(GameStatus.WON);
    }

    draw();
    requestRef.current = requestAnimationFrame(update);
  }, [status, spawnRocket]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = gameState.current;

    // Clear
    ctx.fillStyle = '#0c0c14';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw cities
    state.cities.forEach(city => {
      if (city.destroyed) return;
      
      // Draw shield
      if (city.shields > 0) {
        ctx.strokeStyle = `rgba(59, 130, 246, ${city.shields / 3})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(city.x, city.y, 25, Math.PI, 0);
        ctx.stroke();
      }

      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.roundRect(city.x - 15, city.y - 10, 30, 20, 4);
      ctx.fill();
      // Windows
      ctx.fillStyle = '#ffffff33';
      ctx.fillRect(city.x - 10, city.y - 5, 5, 5);
      ctx.fillRect(city.x + 5, city.y - 5, 5, 5);
    });

    // Draw batteries
    state.batteries.forEach(bat => {
      if (bat.destroyed) {
        ctx.fillStyle = '#444';
      } else {
        // Draw shield
        if (bat.shields > 0) {
          ctx.strokeStyle = `rgba(0, 255, 157, ${bat.shields / 3})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(bat.x, bat.y, 35, Math.PI, 0);
          ctx.stroke();
        }
        ctx.fillStyle = '#00ff9d';
      }
      ctx.beginPath();
      ctx.moveTo(bat.x - 25, bat.y + 10);
      ctx.lineTo(bat.x, bat.y - 20);
      ctx.lineTo(bat.x + 25, bat.y + 10);
      ctx.closePath();
      ctx.fill();

      // Ammo count
      if (!bat.destroyed) {
        ctx.fillStyle = 'white';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(bat.ammo.toString(), bat.x, bat.y + 25);
      }
    });

    // Draw rockets
    ctx.strokeStyle = '#ff3e3e';
    ctx.lineWidth = 2; // Doubled from 1
    state.rockets.forEach(rocket => {
      ctx.beginPath();
      ctx.moveTo(rocket.startX, rocket.startY);
      ctx.lineTo(rocket.x, rocket.y);
      ctx.stroke();
      
      ctx.fillStyle = '#ff3e3e';
      ctx.beginPath();
      ctx.arc(rocket.x, rocket.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw missiles
    ctx.strokeStyle = '#00ff9d';
    ctx.lineWidth = 2; // Doubled from 1
    state.missiles.forEach(missile => {
      ctx.beginPath();
      ctx.moveTo(missile.startX, missile.startY);
      ctx.lineTo(missile.x, missile.y);
      ctx.stroke();
    });

    // Draw explosions
    state.explosions.forEach(exp => {
      const gradient = ctx.createRadialGradient(exp.x, exp.y, 0, exp.x, exp.y, exp.radius);
      gradient.addColorStop(0, 'white');
      gradient.addColorStop(0.4, '#00ff9d');
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }, []);

  useEffect(() => {
    if (status === GameStatus.PLAYING) {
      requestRef.current = requestAnimationFrame(update);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [status, update]);

  const handleCanvasClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (status !== GameStatus.PLAYING) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    // Don't fire too low
    if (y < CANVAS_HEIGHT - 60) {
      fireMissile(x, y);
    }
  };

  const startGame = () => {
    initGame();
    setStatus(GameStatus.PLAYING);
  };

  const toggleLang = () => setLang(l => l === 'en' ? 'zh' : 'en');

  return (
    <div className="min-h-screen bg-[#0c0c14] flex flex-col items-center justify-center p-4 font-sans text-white overflow-hidden">
      {/* Header */}
      <div className="w-full max-w-[800px] flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <Shield className="w-6 h-6 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight glow-text">{t.title}</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-widest text-emerald-400/60 font-mono">{t.score}</span>
            <span className="text-2xl font-mono font-bold">{score.toString().padStart(5, '0')}</span>
          </div>
          <button 
            onClick={toggleLang}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <Languages className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Game Area */}
      <div className="relative w-full max-w-[800px] aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onMouseDown={handleCanvasClick}
          onTouchStart={handleCanvasClick}
          className="w-full h-full cursor-crosshair"
        />

        {/* Overlays */}
        <AnimatePresence>
          {status !== GameStatus.PLAYING && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 text-center"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="max-w-md"
              >
                {status === GameStatus.START && (
                  <>
                    <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Target className="w-10 h-10 text-emerald-400" />
                    </div>
                    <h2 className="text-4xl font-bold mb-4">{t.title}</h2>
                    <p className="text-white/60 mb-8 leading-relaxed">{t.objective}</p>
                    <button
                      onClick={startGame}
                      className="group relative px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all hover:scale-105 flex items-center gap-3 mx-auto"
                    >
                      <Play className="w-5 h-5 fill-current" />
                      {t.start}
                    </button>
                  </>
                )}

                {status === GameStatus.WON && (
                  <>
                    <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Trophy className="w-10 h-10 text-yellow-400" />
                    </div>
                    <h2 className="text-4xl font-bold mb-2 text-yellow-400">{t.win}</h2>
                    <p className="text-white/60 mb-4">{t.winMsg}</p>
                    <div className="text-5xl font-mono font-bold mb-8 text-white">{score}</div>
                    <button
                      onClick={startGame}
                      className="px-8 py-4 bg-white text-black font-bold rounded-xl transition-all hover:scale-105 flex items-center gap-3 mx-auto"
                    >
                      <RotateCcw className="w-5 h-5" />
                      {t.restart}
                    </button>
                  </>
                )}

                {status === GameStatus.LOST && (
                  <>
                    <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Shield className="w-10 h-10 text-red-400" />
                    </div>
                    <h2 className="text-4xl font-bold mb-2 text-red-400">{t.lose}</h2>
                    <p className="text-white/60 mb-4">{t.loseMsg}</p>
                    <div className="text-5xl font-mono font-bold mb-8 text-white">{score}</div>
                    <button
                      onClick={startGame}
                      className="px-8 py-4 bg-red-500 text-white font-bold rounded-xl transition-all hover:scale-105 flex items-center gap-3 mx-auto"
                    >
                      <RotateCcw className="w-5 h-5" />
                      {t.restart}
                    </button>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer / Instructions */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-[800px]">
        <div className="bg-white/5 p-4 rounded-xl border border-white/10">
          <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">Controls</h3>
          <p className="text-sm text-white/60">Click or tap anywhere to intercept. Aim ahead of the rockets!</p>
        </div>
        <div className="bg-white/5 p-4 rounded-xl border border-white/10">
          <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">Objective</h3>
          <p className="text-sm text-white/60">Protect your cities. If all missile batteries are destroyed, you lose.</p>
        </div>
        <div className="bg-white/5 p-4 rounded-xl border border-white/10">
          <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">Victory</h3>
          <p className="text-sm text-white/60">Reach 1000 points to win. Each rocket destroyed is worth 20 points.</p>
        </div>
      </div>
    </div>
  );
}
