// Ball Breaker - Roguelite Breakout Game
// Game Configuration
const CONFIG = {
    canvasWidth: 800,
    canvasHeight: 600,
    playerSize: 40,
    playerSpeed: 5,
    ballSize: 8,
    enemySize: 30,
    enemySpeed: 1,
    ballFireRate: 800,
    enemySpawnRate: 2000,
    waveDuration: 30000,
};

// Game State
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();

        this.gameState = 'start'; // start, playing, upgrade, gameover
        this.level = 1;
        this.score = 0;
        this.playerHP = 100;
        this.maxHP = 100;

        this.player = null;
        this.balls = [];
        this.enemies = [];
        this.particles = [];
        this.powerups = [];

        this.ballTypes = new Map();
        this.playerUpgrades = {
            ballDamage: 1,
            ballSpeed: 1,
            fireRate: 1,
            ballCount: 1,
            piercing: 0,
            multishot: 0,
        };

        this.lastBallFire = 0;
        this.lastEnemySpawn = 0;
        this.waveStartTime = 0;
        this.enemiesKilled = 0;
        this.waveEnemiesKilled = 0;

        this.inputHandler = new InputHandler(this);
        this.initializeBallTypes();
        this.setupEventListeners();
    }

    setupCanvas() {
        const container = this.canvas.parentElement;
        const containerRect = container.getBoundingClientRect();

        // Set canvas size for mobile
        const aspectRatio = CONFIG.canvasWidth / CONFIG.canvasHeight;
        let width = Math.min(CONFIG.canvasWidth, window.innerWidth - 20);
        let height = width / aspectRatio;

        if (height > window.innerHeight - 20) {
            height = window.innerHeight - 20;
            width = height * aspectRatio;
        }

        this.canvas.width = CONFIG.canvasWidth;
        this.canvas.height = CONFIG.canvasHeight;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';

        // Calculate scale for input
        this.scale = {
            x: CONFIG.canvasWidth / width,
            y: CONFIG.canvasHeight / height
        };
    }

    initializeBallTypes() {
        this.ballTypes.set('normal', {
            name: 'Normal Ball',
            color: '#ffffff',
            damage: 1,
            speed: 6,
            effect: null
        });

        this.ballTypes.set('fire', {
            name: 'Fire Ball',
            color: '#ff6b6b',
            damage: 2,
            speed: 5,
            effect: 'burn'
        });

        this.ballTypes.set('ice', {
            name: 'Ice Ball',
            color: '#4ecdc4',
            damage: 1,
            speed: 4,
            effect: 'slow'
        });

        this.ballTypes.set('lightning', {
            name: 'Lightning Ball',
            color: '#f7f740',
            damage: 1.5,
            speed: 8,
            effect: 'chain'
        });

        this.ballTypes.set('explosive', {
            name: 'Explosive Ball',
            color: '#ff8800',
            damage: 3,
            speed: 5,
            effect: 'explode'
        });
    }

    setupEventListeners() {
        document.getElementById('start-btn').addEventListener('click', () => {
            this.startGame();
        });

        document.getElementById('restart-btn').addEventListener('click', () => {
            this.resetGame();
            this.startGame();
        });
    }

    startGame() {
        document.getElementById('start-screen').classList.add('hidden');
        this.gameState = 'playing';
        this.player = new Player(CONFIG.canvasWidth / 2, CONFIG.canvasHeight - 80, this);
        this.waveStartTime = Date.now();
        this.gameLoop();
    }

    resetGame() {
        this.level = 1;
        this.score = 0;
        this.playerHP = this.maxHP;
        this.balls = [];
        this.enemies = [];
        this.particles = [];
        this.powerups = [];
        this.enemiesKilled = 0;
        this.waveEnemiesKilled = 0;
        document.getElementById('gameover-screen').classList.add('hidden');
    }

    gameLoop() {
        if (this.gameState === 'playing') {
            this.update();
            this.render();
            requestAnimationFrame(() => this.gameLoop());
        }
    }

    update() {
        const now = Date.now();

        // Update player
        if (this.player) {
            this.player.update();

            // Auto-fire balls
            const fireRate = CONFIG.ballFireRate / this.playerUpgrades.fireRate;
            if (now - this.lastBallFire > fireRate) {
                this.fireBall();
                this.lastBallFire = now;
            }
        }

        // Spawn enemies
        const spawnRate = Math.max(500, CONFIG.enemySpawnRate - (this.level * 100));
        if (now - this.lastEnemySpawn > spawnRate) {
            this.spawnEnemy();
            this.lastEnemySpawn = now;
        }

        // Update balls
        this.balls = this.balls.filter(ball => {
            ball.update();
            return ball.active;
        });

        // Update enemies
        this.enemies = this.enemies.filter(enemy => {
            enemy.update();
            return enemy.active;
        });

        // Update particles
        this.particles = this.particles.filter(particle => {
            particle.update();
            return particle.life > 0;
        });

        // Update powerups
        this.powerups = this.powerups.filter(powerup => {
            powerup.update();
            return powerup.active;
        });

        // Check collisions
        this.checkCollisions();

        // Check wave completion
        if (now - this.waveStartTime > CONFIG.waveDuration) {
            this.completeWave();
        }

        // Update UI
        this.updateUI();

        // Check game over
        if (this.playerHP <= 0) {
            this.gameOver();
        }
    }

    fireBall() {
        const ballCount = 1 + this.playerUpgrades.multishot;
        const spreadAngle = Math.PI / 8;

        for (let i = 0; i < ballCount; i++) {
            let angle = -Math.PI / 2; // Up

            if (ballCount > 1) {
                const offset = (i - (ballCount - 1) / 2) * spreadAngle;
                angle += offset;
            }

            const ball = new Ball(
                this.player.x,
                this.player.y - 20,
                angle,
                this
            );
            this.balls.push(ball);
        }
    }

    spawnEnemy() {
        const x = Math.random() * (CONFIG.canvasWidth - CONFIG.enemySize);
        const enemy = new Enemy(x, -CONFIG.enemySize, this);
        this.enemies.push(enemy);
    }

    checkCollisions() {
        // Ball vs Enemy
        for (let ball of this.balls) {
            for (let enemy of this.enemies) {
                if (this.checkCircleCollision(ball, enemy)) {
                    this.handleBallEnemyCollision(ball, enemy);
                }
            }
        }

        // Player vs Enemy
        if (this.player) {
            for (let enemy of this.enemies) {
                if (this.checkCircleCollision(this.player, enemy)) {
                    this.handlePlayerEnemyCollision(enemy);
                }
            }

            // Player vs Powerup
            for (let powerup of this.powerups) {
                if (this.checkCircleCollision(this.player, powerup)) {
                    this.collectPowerup(powerup);
                }
            }
        }
    }

    checkCircleCollision(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < a.radius + b.radius;
    }

    handleBallEnemyCollision(ball, enemy) {
        const damage = ball.damage * this.playerUpgrades.ballDamage;
        enemy.takeDamage(damage);

        // Apply ball effects
        if (ball.type === 'fire') {
            enemy.burning = true;
            enemy.burnTime = Date.now();
        } else if (ball.type === 'ice') {
            enemy.slowed = true;
            enemy.slowTime = Date.now();
        } else if (ball.type === 'lightning') {
            this.chainLightning(enemy);
        } else if (ball.type === 'explosive') {
            this.explode(enemy.x, enemy.y, 50, damage);
        }

        if (this.playerUpgrades.piercing === 0) {
            ball.active = false;
        } else {
            ball.pierceCount = (ball.pierceCount || 0) + 1;
            if (ball.pierceCount > this.playerUpgrades.piercing) {
                ball.active = false;
            }
        }

        if (!enemy.active) {
            this.enemyKilled(enemy);
        }
    }

    handlePlayerEnemyCollision(enemy) {
        this.playerHP -= 10;
        enemy.active = false;
        this.createExplosion(enemy.x, enemy.y, '#ff6b6b');
    }

    chainLightning(sourceEnemy) {
        const range = 100;
        const maxChains = 3;
        let chained = 0;

        for (let enemy of this.enemies) {
            if (enemy === sourceEnemy || !enemy.active) continue;

            const dx = enemy.x - sourceEnemy.x;
            const dy = enemy.y - sourceEnemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < range && chained < maxChains) {
                enemy.takeDamage(this.playerUpgrades.ballDamage);
                chained++;

                // Visual lightning effect
                this.createLightning(sourceEnemy.x, sourceEnemy.y, enemy.x, enemy.y);
            }
        }
    }

    explode(x, y, radius, damage) {
        for (let enemy of this.enemies) {
            const dx = enemy.x - x;
            const dy = enemy.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < radius) {
                const falloff = 1 - (distance / radius);
                enemy.takeDamage(damage * falloff);
            }
        }

        this.createExplosion(x, y, '#ff8800', radius);
    }

    enemyKilled(enemy) {
        this.score += enemy.scoreValue;
        this.enemiesKilled++;
        this.waveEnemiesKilled++;

        this.createExplosion(enemy.x, enemy.y, enemy.color);

        // Drop powerup chance
        if (Math.random() < 0.15) {
            const powerup = new Powerup(enemy.x, enemy.y, this);
            this.powerups.push(powerup);
        }
    }

    collectPowerup(powerup) {
        powerup.active = false;

        // Heal player
        this.playerHP = Math.min(this.maxHP, this.playerHP + 10);
        this.score += 50;

        this.createExplosion(powerup.x, powerup.y, '#ffd700');
    }

    completeWave() {
        this.gameState = 'upgrade';
        this.level++;
        this.waveStartTime = Date.now();
        this.waveEnemiesKilled = 0;
        this.showUpgradeMenu();
    }

    showUpgradeMenu() {
        const menu = document.getElementById('upgrade-menu');
        const optionsContainer = document.getElementById('upgrade-options');
        optionsContainer.innerHTML = '';

        // Generate 3 random upgrade options
        const upgrades = this.generateUpgradeOptions(3);

        upgrades.forEach(upgrade => {
            const card = document.createElement('div');
            card.className = 'upgrade-card';
            card.innerHTML = `
                <h3>${upgrade.name}</h3>
                <p>${upgrade.description}</p>
            `;
            card.addEventListener('click', () => {
                this.applyUpgrade(upgrade);
                menu.classList.add('hidden');
                this.gameState = 'playing';
                this.gameLoop();
            });
            optionsContainer.appendChild(card);
        });

        menu.classList.remove('hidden');
    }

    generateUpgradeOptions(count) {
        const allUpgrades = [
            {
                id: 'damage',
                name: 'Power Boost',
                description: 'Increase ball damage by 50%',
                apply: () => this.playerUpgrades.ballDamage *= 1.5
            },
            {
                id: 'speed',
                name: 'Swift Balls',
                description: 'Increase ball speed by 30%',
                apply: () => this.playerUpgrades.ballSpeed *= 1.3
            },
            {
                id: 'firerate',
                name: 'Rapid Fire',
                description: 'Increase fire rate by 30%',
                apply: () => this.playerUpgrades.fireRate *= 1.3
            },
            {
                id: 'multishot',
                name: 'Multi-Shot',
                description: 'Fire an additional ball',
                apply: () => this.playerUpgrades.multishot++
            },
            {
                id: 'piercing',
                name: 'Piercing Shots',
                description: 'Balls pierce through 2 enemies',
                apply: () => this.playerUpgrades.piercing += 2
            },
            {
                id: 'health',
                name: 'Health Boost',
                description: 'Increase max HP by 25 and heal fully',
                apply: () => {
                    this.maxHP += 25;
                    this.playerHP = this.maxHP;
                }
            },
            {
                id: 'fireball',
                name: 'Fire Ball Fusion',
                description: 'Unlock fire balls that deal DoT',
                apply: () => this.player.ballType = 'fire'
            },
            {
                id: 'iceball',
                name: 'Ice Ball Fusion',
                description: 'Unlock ice balls that slow enemies',
                apply: () => this.player.ballType = 'ice'
            },
            {
                id: 'lightning',
                name: 'Lightning Evolution',
                description: 'Unlock lightning that chains to nearby enemies',
                apply: () => this.player.ballType = 'lightning'
            },
            {
                id: 'explosive',
                name: 'Explosive Evolution',
                description: 'Unlock explosive balls with AoE damage',
                apply: () => this.player.ballType = 'explosive'
            },
        ];

        // Shuffle and pick random upgrades
        const shuffled = allUpgrades.sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    applyUpgrade(upgrade) {
        upgrade.apply();
    }

    createExplosion(x, y, color, radius = 30) {
        const particleCount = 15;
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = 2 + Math.random() * 3;
            this.particles.push(new Particle(x, y, angle, speed, color));
        }
    }

    createLightning(x1, y1, x2, y2) {
        // Simple lightning visualization using particles
        const segments = 5;
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const x = x1 + (x2 - x1) * t;
            const y = y1 + (y2 - y1) * t;
            this.particles.push(new Particle(x, y, 0, 0, '#f7f740', 10));
        }
    }

    updateUI() {
        document.getElementById('level').textContent = this.level;
        document.getElementById('score').textContent = this.score;
        document.getElementById('hp').textContent = Math.max(0, Math.floor(this.playerHP));
    }

    gameOver() {
        this.gameState = 'gameover';
        document.getElementById('final-score').textContent = this.score;
        document.getElementById('final-level').textContent = this.level;
        document.getElementById('gameover-screen').classList.remove('hidden');
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

        // Draw grid background
        this.drawGrid();

        // Draw entities
        this.particles.forEach(p => p.render(this.ctx));
        this.powerups.forEach(p => p.render(this.ctx));
        this.enemies.forEach(e => e.render(this.ctx));
        this.balls.forEach(b => b.render(this.ctx));
        if (this.player) this.player.render(this.ctx);

        // Draw wave progress
        this.drawWaveProgress();
    }

    drawGrid() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;

        const gridSize = 40;
        for (let x = 0; x < CONFIG.canvasWidth; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, CONFIG.canvasHeight);
            this.ctx.stroke();
        }

        for (let y = 0; y < CONFIG.canvasHeight; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(CONFIG.canvasWidth, y);
            this.ctx.stroke();
        }
    }

    drawWaveProgress() {
        const elapsed = Date.now() - this.waveStartTime;
        const progress = Math.min(1, elapsed / CONFIG.waveDuration);

        const barWidth = CONFIG.canvasWidth * 0.8;
        const barHeight = 10;
        const x = (CONFIG.canvasWidth - barWidth) / 2;
        const y = CONFIG.canvasHeight - 30;

        // Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(x, y, barWidth, barHeight);

        // Progress
        this.ctx.fillStyle = '#ffd700';
        this.ctx.fillRect(x, y, barWidth * progress, barHeight);

        // Border
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, barWidth, barHeight);

        // Text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Wave Progress', CONFIG.canvasWidth / 2, y - 5);
    }
}

// Player Class
class Player {
    constructor(x, y, game) {
        this.x = x;
        this.y = y;
        this.radius = CONFIG.playerSize / 2;
        this.game = game;
        this.ballType = 'normal';
        this.targetX = x;
        this.targetY = y;
    }

    update() {
        // Smooth movement towards target
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 2) {
            const speed = CONFIG.playerSpeed;
            this.x += (dx / distance) * speed;
            this.y += (dy / distance) * speed;
        }

        // Keep in bounds
        this.x = Math.max(this.radius, Math.min(CONFIG.canvasWidth - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(CONFIG.canvasHeight - this.radius, this.y));
    }

    moveTo(x, y) {
        this.targetX = x;
        this.targetY = y;
    }

    render(ctx) {
        // Draw player character
        ctx.fillStyle = '#4ecdc4';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw outline
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw directional indicator
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.radius / 2, 5, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Ball Class
class Ball {
    constructor(x, y, angle, game) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.game = game;
        this.active = true;
        this.type = game.player.ballType;

        const ballData = game.ballTypes.get(this.type);
        this.radius = CONFIG.ballSize;
        this.speed = ballData.speed * game.playerUpgrades.ballSpeed;
        this.damage = ballData.damage;
        this.color = ballData.color;

        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        // Remove if out of bounds
        if (this.y < -this.radius || this.x < -this.radius ||
            this.x > CONFIG.canvasWidth + this.radius) {
            this.active = false;
        }
    }

    render(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Add glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

// Enemy Class
class Enemy {
    constructor(x, y, game) {
        this.x = x;
        this.y = y;
        this.game = game;
        this.radius = CONFIG.enemySize / 2;
        this.active = true;

        // Random enemy type
        const rand = Math.random();
        if (rand < 0.6) {
            this.type = 'normal';
            this.hp = 2 + game.level;
            this.maxHP = this.hp;
            this.color = '#ff6b6b';
            this.speed = CONFIG.enemySpeed;
            this.scoreValue = 10;
        } else if (rand < 0.85) {
            this.type = 'tank';
            this.hp = 5 + game.level * 2;
            this.maxHP = this.hp;
            this.color = '#845EC2';
            this.speed = CONFIG.enemySpeed * 0.5;
            this.scoreValue = 25;
            this.radius *= 1.2;
        } else {
            this.type = 'fast';
            this.hp = 1 + Math.floor(game.level / 2);
            this.maxHP = this.hp;
            this.color = '#00d9ff';
            this.speed = CONFIG.enemySpeed * 2;
            this.scoreValue = 15;
            this.radius *= 0.8;
        }

        this.burning = false;
        this.burnTime = 0;
        this.slowed = false;
        this.slowTime = 0;
    }

    update() {
        // Apply status effects
        let speedMod = 1;

        if (this.burning) {
            if (Date.now() - this.burnTime > 3000) {
                this.burning = false;
            } else {
                if (Date.now() - this.burnTime > 500 && (Date.now() - this.burnTime) % 500 < 16) {
                    this.takeDamage(0.5);
                }
            }
        }

        if (this.slowed) {
            if (Date.now() - this.slowTime > 2000) {
                this.slowed = false;
            } else {
                speedMod = 0.5;
            }
        }

        // Move down
        this.y += this.speed * speedMod;

        // Remove if out of bounds
        if (this.y > CONFIG.canvasHeight + this.radius) {
            this.active = false;
        }
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.active = false;
        }
    }

    render(ctx) {
        // Draw enemy
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw HP bar
        const barWidth = this.radius * 2;
        const barHeight = 4;
        const hpPercent = this.hp / this.maxHP;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(this.x - barWidth / 2, this.y - this.radius - 10, barWidth, barHeight);

        ctx.fillStyle = '#00ff00';
        ctx.fillRect(this.x - barWidth / 2, this.y - this.radius - 10, barWidth * hpPercent, barHeight);

        // Status effect indicators
        if (this.burning) {
            ctx.fillStyle = '#ff6b6b';
            ctx.font = '16px Arial';
            ctx.fillText('🔥', this.x - 8, this.y - this.radius - 15);
        }

        if (this.slowed) {
            ctx.fillStyle = '#4ecdc4';
            ctx.font = '16px Arial';
            ctx.fillText('❄️', this.x + 8, this.y - this.radius - 15);
        }
    }
}

// Powerup Class
class Powerup {
    constructor(x, y, game) {
        this.x = x;
        this.y = y;
        this.game = game;
        this.radius = 12;
        this.active = true;
        this.speed = 2;
        this.color = '#ffd700';
        this.rotation = 0;
    }

    update() {
        this.y += this.speed;
        this.rotation += 0.1;

        if (this.y > CONFIG.canvasHeight + this.radius) {
            this.active = false;
        }
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Draw star shape
        ctx.fillStyle = this.color;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
            const x = Math.cos(angle) * this.radius;
            const y = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);

            const innerAngle = angle + Math.PI / 5;
            const innerX = Math.cos(innerAngle) * this.radius * 0.5;
            const innerY = Math.sin(innerAngle) * this.radius * 0.5;
            ctx.lineTo(innerX, innerY);
        }
        ctx.closePath();
        ctx.fill();

        // Glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.fill();

        ctx.restore();
        ctx.shadowBlur = 0;
    }
}

// Particle Class
class Particle {
    constructor(x, y, angle, speed, color, life = 30) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = 3 + Math.random() * 3;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.2; // Gravity
        this.life--;
    }

    render(ctx) {
        const alpha = this.life / this.maxLife;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

// Input Handler
class InputHandler {
    constructor(game) {
        this.game = game;
        this.setupListeners();
    }

    setupListeners() {
        // Mouse input
        this.game.canvas.addEventListener('mousemove', (e) => {
            this.handleInput(e.clientX, e.clientY);
        });

        this.game.canvas.addEventListener('click', (e) => {
            this.handleInput(e.clientX, e.clientY);
        });

        // Touch input
        this.game.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.handleInput(touch.clientX, touch.clientY);
        }, { passive: false });

        this.game.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.handleInput(touch.clientX, touch.clientY);
        }, { passive: false });
    }

    handleInput(clientX, clientY) {
        if (this.game.gameState !== 'playing' || !this.game.player) return;

        const rect = this.game.canvas.getBoundingClientRect();
        const x = (clientX - rect.left) * this.game.scale.x;
        const y = (clientY - rect.top) * this.game.scale.y;

        this.game.player.moveTo(x, y);
    }
}

// Initialize game
window.addEventListener('load', () => {
    const game = new Game();
});

// Prevent scrolling on mobile
document.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });
