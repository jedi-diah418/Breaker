// Ball Breaker - Roguelite Twin Stick Shooter
// Game Configuration
const CONFIG = {
    canvasWidth: 500,
    canvasHeight: 900,
    playerSize: 40,
    playerSpeed: 6,
    playerBounce: 0.8,
    ballSize: 8,
    enemySize: 30,
    enemySpeed: 0.4,
    ballFireRate: 150,
    enemySpawnRate: 800,
    waveDuration: 30000,
    bossInterval: 5, // Boss every 5 levels
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

        // XP System
        this.playerLevel = 1;
        this.playerXP = 0;
        this.xpToNextLevel = 10;
        this.xpMultiplier = 1.5; // Each level requires 1.5x more XP

        this.player = null;
        this.balls = [];
        this.enemies = [];
        this.particles = [];
        this.powerups = [];
        this.bosses = [];
        this.xpGems = [];

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
        this.bosses = [];
        this.particles = [];
        this.powerups = [];
        this.xpGems = [];
        this.enemiesKilled = 0;
        this.waveEnemiesKilled = 0;
        this.playerLevel = 1;
        this.playerXP = 0;
        this.xpToNextLevel = 10;
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

            // Fire balls when aiming
            if (this.player.isAiming) {
                const fireRate = CONFIG.ballFireRate / this.playerUpgrades.fireRate;
                if (now - this.lastBallFire > fireRate) {
                    this.fireBall();
                    this.lastBallFire = now;
                }
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

        // Update bosses
        this.bosses = this.bosses.filter(boss => {
            boss.update();
            return boss.active;
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

        // Update XP gems
        this.xpGems = this.xpGems.filter(gem => {
            gem.update();
            return gem.active;
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
            let angle = this.player.aimAngle;

            if (ballCount > 1) {
                const offset = (i - (ballCount - 1) / 2) * spreadAngle;
                angle += offset;
            }

            const ball = new Ball(
                this.player.x,
                this.player.y,
                angle,
                this
            );
            this.balls.push(ball);
        }
    }

    spawnEnemy() {
        // Spawn enemies in tighter clusters
        const clusterCount = 2 + Math.floor(Math.random() * 3); // 2-4 enemies per cluster
        const clusterX = Math.random() * (CONFIG.canvasWidth - CONFIG.enemySize * 3);

        for (let i = 0; i < clusterCount; i++) {
            const offsetX = (Math.random() - 0.5) * CONFIG.enemySize * 2;
            const offsetY = (Math.random() - 0.5) * CONFIG.enemySize;
            const x = Math.max(CONFIG.enemySize / 2, Math.min(CONFIG.canvasWidth - CONFIG.enemySize / 2, clusterX + offsetX));
            const y = -CONFIG.enemySize + offsetY;
            const enemy = new Enemy(x, y, this);
            this.enemies.push(enemy);
        }
    }

    checkCollisions() {
        // Ball vs Enemy
        for (let ball of this.balls) {
            for (let enemy of this.enemies) {
                if (this.checkCircleCollision(ball, enemy)) {
                    this.handleBallEnemyCollision(ball, enemy);
                }
            }
            // Ball vs Boss
            for (let boss of this.bosses) {
                if (this.checkCircleCollision(ball, boss)) {
                    this.handleBallEnemyCollision(ball, boss);
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

            // Player vs Boss
            for (let boss of this.bosses) {
                if (this.checkCircleCollision(this.player, boss)) {
                    this.handlePlayerEnemyCollision(boss);
                }
            }

            // Player vs Powerup
            for (let powerup of this.powerups) {
                if (this.checkCircleCollision(this.player, powerup)) {
                    this.collectPowerup(powerup);
                }
            }

            // Player vs XP Gem
            for (let gem of this.xpGems) {
                if (this.checkCircleCollision(this.player, gem)) {
                    this.collectXP(gem);
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

        // Drop XP gems
        const xpValue = enemy.type === 'boss' ? 50 : enemy.type === 'tank' ? 5 : enemy.type === 'fast' ? 2 : 3;
        const gemCount = enemy.type === 'boss' ? 10 : Math.floor(Math.random() * 3) + 1;

        for (let i = 0; i < gemCount; i++) {
            const angle = (Math.PI * 2 * i) / gemCount + Math.random() * 0.5;
            const speed = 2 + Math.random() * 3;
            const gem = new XPGem(enemy.x, enemy.y, xpValue, angle, speed, this);
            this.xpGems.push(gem);
        }

        // Drop powerup chance (reduced since we have XP now)
        if (Math.random() < 0.1) {
            const powerup = new Powerup(enemy.x, enemy.y, this);
            this.powerups.push(powerup);
        }
    }

    collectXP(gem) {
        gem.active = false;
        this.playerXP += gem.value;

        // Check for level up
        if (this.playerXP >= this.xpToNextLevel) {
            this.levelUp();
        }

        // XP pickup particles
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 2;
            this.particles.push(new Particle(gem.x, gem.y, angle, speed, gem.color, 20));
        }
    }

    levelUp() {
        this.playerLevel++;
        this.playerXP -= this.xpToNextLevel;
        this.xpToNextLevel = Math.floor(this.xpToNextLevel * this.xpMultiplier);

        // Level up effects
        this.createExplosion(this.player.x, this.player.y, '#ffd700', 60);

        // Show upgrade menu
        this.gameState = 'upgrade';
        this.showUpgradeMenu();

        // Heal a bit on level up
        this.playerHP = Math.min(this.maxHP, this.playerHP + 20);
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

        // Spawn boss every 5 levels
        if (this.level % CONFIG.bossInterval === 0) {
            this.spawnBoss();
        }

        this.waveStartTime = Date.now();
        this.waveEnemiesKilled = 0;
        this.showUpgradeMenu();
    }

    spawnBoss() {
        const boss = new Boss(CONFIG.canvasWidth / 2, -100, this);
        this.bosses.push(boss);
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
        document.getElementById('player-level').textContent = this.playerLevel;

        // Update XP bar
        const xpPercent = this.playerXP / this.xpToNextLevel;
        const xpBar = document.getElementById('xp-bar');
        if (xpBar) {
            xpBar.style.width = (xpPercent * 100) + '%';
        }
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
        this.xpGems.forEach(g => g.render(this.ctx));
        this.powerups.forEach(p => p.render(this.ctx));
        this.enemies.forEach(e => e.render(this.ctx));
        this.bosses.forEach(b => b.render(this.ctx));
        this.balls.forEach(b => b.render(this.ctx));
        if (this.player) this.player.render(this.ctx);

        // Draw twin stick control zones (visual aid)
        if (this.player) this.drawControlZones();

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

    drawControlZones() {
        const leftZone = this.inputHandler.leftStick;
        const rightZone = this.inputHandler.rightStick;

        this.ctx.globalAlpha = 0.2;

        // Left stick (movement)
        if (leftZone.active) {
            this.ctx.fillStyle = '#4ecdc4';
            this.ctx.beginPath();
            this.ctx.arc(leftZone.baseX, leftZone.baseY, 60, 0, Math.PI * 2);
            this.ctx.fill();

            // Direction indicator
            this.ctx.globalAlpha = 0.5;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(leftZone.currentX, leftZone.currentY, 20, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Right stick (aiming)
        if (rightZone.active) {
            this.ctx.fillStyle = '#ff6b6b';
            this.ctx.beginPath();
            this.ctx.arc(rightZone.baseX, rightZone.baseY, 60, 0, Math.PI * 2);
            this.ctx.fill();

            // Direction indicator
            this.ctx.globalAlpha = 0.5;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(rightZone.currentX, rightZone.currentY, 20, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.globalAlpha = 1;
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
        this.vx = 0;
        this.vy = 0;
        this.moveAngle = 0;
        this.aimAngle = -Math.PI / 2; // Default up
        this.isMoving = false;
        this.isAiming = false;
    }

    update() {
        // Apply velocity
        this.x += this.vx;
        this.y += this.vy;

        // Bounce off walls
        if (this.x < this.radius) {
            this.x = this.radius;
            this.vx = -this.vx * CONFIG.playerBounce;
        } else if (this.x > CONFIG.canvasWidth - this.radius) {
            this.x = CONFIG.canvasWidth - this.radius;
            this.vx = -this.vx * CONFIG.playerBounce;
        }

        if (this.y < this.radius) {
            this.y = this.radius;
            this.vy = -this.vy * CONFIG.playerBounce;
        } else if (this.y > CONFIG.canvasHeight - this.radius) {
            this.y = CONFIG.canvasHeight - this.radius;
            this.vy = -this.vy * CONFIG.playerBounce;
        }

        // Apply friction
        this.vx *= 0.85;
        this.vy *= 0.85;
    }

    setMovement(dx, dy) {
        if (dx !== 0 || dy !== 0) {
            this.isMoving = true;
            this.moveAngle = Math.atan2(dy, dx);
            this.vx = dx * CONFIG.playerSpeed;
            this.vy = dy * CONFIG.playerSpeed;
        } else {
            this.isMoving = false;
        }
    }

    setAim(dx, dy) {
        if (dx !== 0 || dy !== 0) {
            this.isAiming = true;
            this.aimAngle = Math.atan2(dy, dx);
        } else {
            this.isAiming = false;
        }
    }

    render(ctx) {
        // Draw player character (gun turret style)
        ctx.fillStyle = '#4ecdc4';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw outline
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Draw gun barrel pointing in aim direction
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        const barrelLength = this.radius * 1.5;
        ctx.lineTo(
            this.x + Math.cos(this.aimAngle) * barrelLength,
            this.y + Math.sin(this.aimAngle) * barrelLength
        );
        ctx.stroke();

        // Draw movement indicator (small circle)
        if (this.isMoving) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(
                this.x + Math.cos(this.moveAngle) * this.radius * 0.7,
                this.y + Math.sin(this.moveAngle) * this.radius * 0.7,
                5,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
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

        // Bounce off left and right walls
        if (this.x < this.radius || this.x > CONFIG.canvasWidth - this.radius) {
            this.vx = -this.vx;
            this.x = Math.max(this.radius, Math.min(CONFIG.canvasWidth - this.radius, this.x));
        }

        // Bounce off top wall
        if (this.y < this.radius) {
            this.vy = -this.vy;
            this.y = this.radius;
        }

        // Remove if out of bounds (bottom only)
        if (this.y > CONFIG.canvasHeight + this.radius) {
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

        // Random enemy type with increased tankiness
        const rand = Math.random();
        if (rand < 0.6) {
            this.type = 'normal';
            this.hp = 5 + game.level * 2;
            this.maxHP = this.hp;
            this.color = '#ff6b6b';
            this.speed = CONFIG.enemySpeed;
            this.scoreValue = 10;
        } else if (rand < 0.85) {
            this.type = 'tank';
            this.hp = 12 + game.level * 4;
            this.maxHP = this.hp;
            this.color = '#845EC2';
            this.speed = CONFIG.enemySpeed * 0.5;
            this.scoreValue = 25;
            this.radius *= 1.3;
        } else {
            this.type = 'fast';
            this.hp = 3 + game.level;
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
        ctx.save();

        // Monster shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + this.radius * 1.5, this.radius * 1.2, this.radius * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw monster body with tentacles/appendages
        ctx.fillStyle = this.color;

        // Tentacles/legs based on type
        if (this.type === 'normal' || this.type === 'fast') {
            // Draw squiggly tentacles
            for (let i = 0; i < 3; i++) {
                const angle = Math.PI / 2 + (i - 1) * 0.5;
                const wobble = Math.sin(Date.now() / 200 + i) * 0.2;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y + this.radius * 0.5);
                ctx.quadraticCurveTo(
                    this.x + Math.cos(angle + wobble) * this.radius,
                    this.y + this.radius * 1.2,
                    this.x + Math.cos(angle) * this.radius * 0.7,
                    this.y + this.radius * 2
                );
                ctx.lineWidth = this.radius * 0.3;
                ctx.strokeStyle = this.color;
                ctx.stroke();
            }
        }

        // Main body blob
        const bodyWidth = this.radius * 1.4;
        const bodyHeight = this.radius * 1.6;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, bodyWidth, bodyHeight, 0, 0, Math.PI * 2);
        ctx.fill();

        // Darker body segments for depth
        ctx.fillStyle = this.type === 'tank' ? '#6b4ea0' : 'rgba(0, 0, 0, 0.2)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + this.radius * 0.3, bodyWidth * 0.8, bodyHeight * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Draw scary eyes (glowing)
        const eyeSize = this.radius * 0.35;
        const eyeOffset = this.radius * 0.5;

        // Eye glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffff00';
        ctx.fillStyle = '#ffff00';

        // Left eye
        ctx.beginPath();
        ctx.arc(this.x - eyeOffset, this.y - this.radius * 0.4, eyeSize, 0, Math.PI * 2);
        ctx.fill();

        // Right eye
        ctx.beginPath();
        ctx.arc(this.x + eyeOffset, this.y - this.radius * 0.4, eyeSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;

        // Evil pupils
        ctx.fillStyle = '#000000';
        const pupilSize = eyeSize * 0.4;
        ctx.beginPath();
        ctx.arc(this.x - eyeOffset, this.y - this.radius * 0.4, pupilSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x + eyeOffset, this.y - this.radius * 0.4, pupilSize, 0, Math.PI * 2);
        ctx.fill();

        // Menacing mouth with sharp teeth
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + this.radius * 0.4, this.radius * 0.6, this.radius * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Sharp triangular teeth
        ctx.fillStyle = '#ffffff';
        const toothCount = this.type === 'tank' ? 6 : 5;
        for (let i = 0; i < toothCount; i++) {
            const tx = this.x - this.radius * 0.5 + (i * this.radius / toothCount);
            const ty = this.y + this.radius * 0.25;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx + this.radius * 0.15, ty);
            ctx.lineTo(tx + this.radius * 0.075, ty + this.radius * 0.3);
            ctx.closePath();
            ctx.fill();
        }

        // Horns/spikes for tank type
        if (this.type === 'tank') {
            ctx.fillStyle = '#6b4ea0';
            const hornCount = 3;
            for (let i = 0; i < hornCount; i++) {
                const angle = -Math.PI + (i * Math.PI / (hornCount - 1));
                const hx = this.x + Math.cos(angle) * this.radius * 0.9;
                const hy = this.y + Math.sin(angle) * this.radius * 1.3;
                ctx.beginPath();
                ctx.moveTo(hx, hy);
                ctx.lineTo(hx + Math.cos(angle) * this.radius * 0.5, hy + Math.sin(angle) * this.radius * 0.5 - this.radius * 0.3);
                ctx.lineTo(hx + Math.cos(angle + 0.3) * this.radius * 0.3, hy + Math.sin(angle + 0.3) * this.radius * 0.3);
                ctx.closePath();
                ctx.fill();
            }
        }

        // Speed lines for fast type
        if (this.type === 'fast') {
            ctx.strokeStyle = 'rgba(0, 217, 255, 0.5)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(this.x - this.radius - i * 5, this.y - 10 + i * 8);
                ctx.lineTo(this.x - this.radius - 15 - i * 5, this.y - 10 + i * 8);
                ctx.stroke();
            }
        }

        // HP bar
        const barWidth = this.radius * 2.5;
        const barHeight = 5;
        const hpPercent = this.hp / this.maxHP;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(this.x - barWidth / 2, this.y - this.radius * 2.2, barWidth, barHeight);

        const hpColor = hpPercent > 0.5 ? '#00ff00' : hpPercent > 0.25 ? '#ffff00' : '#ff0000';
        ctx.fillStyle = hpColor;
        ctx.fillRect(this.x - barWidth / 2, this.y - this.radius * 2.2, barWidth * hpPercent, barHeight);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x - barWidth / 2, this.y - this.radius * 2.2, barWidth, barHeight);

        // Status effect indicators
        if (this.burning) {
            ctx.font = '18px Arial';
            ctx.fillText('🔥', this.x - this.radius - 10, this.y - this.radius * 2.3);
        }

        if (this.slowed) {
            ctx.font = '18px Arial';
            ctx.fillText('❄️', this.x + this.radius - 5, this.y - this.radius * 2.3);
        }

        ctx.restore();
    }
}

// Boss Class
class Boss {
    constructor(x, y, game) {
        this.x = x;
        this.y = y;
        this.game = game;
        this.radius = CONFIG.enemySize * 3;
        this.active = true;
        this.type = 'boss';

        // Boss stats scale with level
        this.hp = 50 + game.level * 20;
        this.maxHP = this.hp;
        this.color = '#9b59b6';
        this.speed = CONFIG.enemySpeed * 0.3;
        this.scoreValue = 500;

        // Boss movement pattern
        this.phase = 0;
        this.phaseTimer = 0;
        this.targetX = x;
        this.vx = 0;
        this.vy = 1;

        this.burning = false;
        this.burnTime = 0;
        this.slowed = false;
        this.slowTime = 0;
    }

    update() {
        // Boss movement AI
        this.phaseTimer++;

        // Move down until in screen, then start pattern
        if (this.y < 150) {
            this.y += this.vy;
        } else {
            // Horizontal movement pattern
            if (this.phaseTimer > 120) {
                this.phaseTimer = 0;
                this.targetX = this.radius + Math.random() * (CONFIG.canvasWidth - this.radius * 2);
            }

            const dx = this.targetX - this.x;
            this.vx = dx * 0.02;
            this.x += this.vx;

            // Slight vertical wobble
            this.y += Math.sin(Date.now() / 500) * 0.5;
        }

        // Apply status effects
        let speedMod = 1;

        if (this.burning) {
            if (Date.now() - this.burnTime > 3000) {
                this.burning = false;
            } else {
                if (Date.now() - this.burnTime > 500 && (Date.now() - this.burnTime) % 500 < 16) {
                    this.takeDamage(1);
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

        // Keep in bounds
        this.x = Math.max(this.radius, Math.min(CONFIG.canvasWidth - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(CONFIG.canvasHeight / 3, this.y));
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.active = false;
        }
    }

    render(ctx) {
        ctx.save();

        // Boss shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + this.radius * 1.8, this.radius * 1.5, this.radius * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pulsating aura
        const pulseSize = this.radius + Math.sin(Date.now() / 200) * 10;
        ctx.fillStyle = 'rgba(155, 89, 182, 0.2)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, pulseSize, 0, Math.PI * 2);
        ctx.fill();

        // Main body
        const bodyWidth = this.radius * 1.6;
        const bodyHeight = this.radius * 1.8;

        // Dark core
        ctx.fillStyle = '#6c3483';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, bodyWidth * 0.7, bodyHeight * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main body
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, bodyWidth, bodyHeight, 0, 0, Math.PI * 2);
        ctx.fill();

        // Multiple glowing eyes
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff0000';
        ctx.fillStyle = '#ff0000';

        const eyePositions = [
            [-this.radius * 0.5, -this.radius * 0.6],
            [this.radius * 0.5, -this.radius * 0.6],
            [0, -this.radius * 0.3],
        ];

        for (const [ex, ey] of eyePositions) {
            ctx.beginPath();
            ctx.arc(this.x + ex, this.y + ey, this.radius * 0.25, 0, Math.PI * 2);
            ctx.fill();

            // Pupils
            ctx.fillStyle = '#000000';
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.arc(this.x + ex, this.y + ey, this.radius * 0.1, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ff0000';
            ctx.fillStyle = '#ff0000';
        }

        ctx.shadowBlur = 0;

        // Giant mouth
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + this.radius * 0.5, this.radius * 0.9, this.radius * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Many sharp teeth
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 10; i++) {
            const tx = this.x - this.radius * 0.8 + (i * this.radius * 0.18);
            const ty = this.y + this.radius * 0.3;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx + this.radius * 0.12, ty);
            ctx.lineTo(tx + this.radius * 0.06, ty + this.radius * 0.4);
            ctx.closePath();
            ctx.fill();
        }

        // Horns/spikes all around
        ctx.fillStyle = '#6c3483';
        const spikeCount = 8;
        for (let i = 0; i < spikeCount; i++) {
            const angle = (Math.PI * 2 * i) / spikeCount;
            const sx = this.x + Math.cos(angle) * this.radius;
            const sy = this.y + Math.sin(angle) * this.radius * 1.3;

            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(
                sx + Math.cos(angle) * this.radius * 0.6,
                sy + Math.sin(angle) * this.radius * 0.6
            );
            const perpAngle = angle + Math.PI / 2;
            ctx.lineTo(
                sx + Math.cos(perpAngle) * this.radius * 0.15,
                sy + Math.sin(perpAngle) * this.radius * 0.15
            );
            ctx.closePath();
            ctx.fill();
        }

        // Tentacles
        for (let i = 0; i < 4; i++) {
            const angle = Math.PI / 2 + (i - 1.5) * 0.6;
            const wobble = Math.sin(Date.now() / 150 + i) * 0.3;
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.radius * 0.4;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + this.radius);
            ctx.quadraticCurveTo(
                this.x + Math.cos(angle + wobble) * this.radius * 1.5,
                this.y + this.radius * 2,
                this.x + Math.cos(angle) * this.radius,
                this.y + this.radius * 3
            );
            ctx.stroke();
        }

        // HP bar
        const barWidth = this.radius * 3;
        const barHeight = 8;
        const hpPercent = this.hp / this.maxHP;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(this.x - barWidth / 2, this.y - this.radius * 2.5, barWidth, barHeight);

        // Color gradient based on HP
        const hpColor = hpPercent > 0.5 ? '#00ff00' : hpPercent > 0.25 ? '#ffff00' : '#ff0000';
        ctx.fillStyle = hpColor;
        ctx.fillRect(this.x - barWidth / 2, this.y - this.radius * 2.5, barWidth * hpPercent, barHeight);

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x - barWidth / 2, this.y - this.radius * 2.5, barWidth, barHeight);

        // Boss label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('BOSS', this.x, this.y - this.radius * 2.8);

        // Status indicators
        if (this.burning) {
            ctx.font = '20px Arial';
            ctx.fillText('🔥', this.x - this.radius - 15, this.y - this.radius * 2.5);
        }

        if (this.slowed) {
            ctx.font = '20px Arial';
            ctx.fillText('❄️', this.x + this.radius + 15, this.y - this.radius * 2.5);
        }

        ctx.restore();
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

// XP Gem Class
class XPGem {
    constructor(x, y, value, angle, speed, game) {
        this.x = x;
        this.y = y;
        this.game = game;
        this.value = value;
        this.radius = 6 + (value / 10); // Bigger gems for more XP
        this.active = true;
        this.rotation = 0;

        // Initial velocity from enemy death
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;

        // Magnetic attraction settings
        this.magnetRange = 80;
        this.magnetStrength = 0.3;

        // Color based on value
        if (value >= 50) {
            this.color = '#ff00ff'; // Purple for boss XP
        } else if (value >= 5) {
            this.color = '#00d9ff'; // Blue for high value
        } else {
            this.color = '#4ecdc4'; // Cyan for normal
        }

        // Fade in effect
        this.age = 0;
        this.maxAge = 600; // 10 seconds before fading
    }

    update() {
        this.age++;

        // Apply velocity with friction
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.95;
        this.vy *= 0.95;

        // Gravity
        this.vy += 0.15;

        // Magnetic attraction to player
        if (this.game.player) {
            const dx = this.game.player.x - this.x;
            const dy = this.game.player.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < this.magnetRange) {
                const pullStrength = this.magnetStrength * (1 - distance / this.magnetRange);
                this.vx += (dx / distance) * pullStrength * 2;
                this.vy += (dy / distance) * pullStrength * 2;
            }
        }

        // Bounce off walls
        if (this.x < this.radius || this.x > CONFIG.canvasWidth - this.radius) {
            this.vx = -this.vx * 0.5;
            this.x = Math.max(this.radius, Math.min(CONFIG.canvasWidth - this.radius, this.x));
        }

        if (this.y < this.radius) {
            this.vy = -this.vy * 0.5;
            this.y = this.radius;
        }

        // Remove if falls off screen or too old
        if (this.y > CONFIG.canvasHeight + this.radius || this.age > this.maxAge) {
            this.active = false;
        }

        this.rotation += 0.05;
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Fade out if old
        const alpha = this.age > this.maxAge - 120 ? (this.maxAge - this.age) / 120 : 1;
        ctx.globalAlpha = alpha;

        // Outer glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;

        // Draw crystal/gem shape
        ctx.fillStyle = this.color;
        ctx.beginPath();

        // Hexagonal gem
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 * i) / 6;
            const x = Math.cos(angle) * this.radius;
            const y = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();

        // Inner highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI * 2 * i) / 6;
            const x = Math.cos(angle) * this.radius * 0.5;
            const y = Math.sin(angle) * this.radius * 0.5;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.restore();
        ctx.globalAlpha = 1;
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

// Input Handler - Twin Stick Controls
class InputHandler {
    constructor(game) {
        this.game = game;

        // Left stick for movement
        this.leftStick = {
            active: false,
            baseX: 0,
            baseY: 0,
            currentX: 0,
            currentY: 0,
            touchId: null
        };

        // Right stick for aiming
        this.rightStick = {
            active: false,
            baseX: 0,
            baseY: 0,
            currentX: 0,
            currentY: 0,
            touchId: null
        };

        this.setupListeners();
    }

    setupListeners() {
        // Touch input for mobile
        this.game.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleTouchStart(e);
        }, { passive: false });

        this.game.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handleTouchMove(e);
        }, { passive: false });

        this.game.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleTouchEnd(e);
        }, { passive: false });

        // Mouse input for desktop (simulate twin stick)
        let mouseDown = false;
        this.game.canvas.addEventListener('mousedown', (e) => {
            mouseDown = true;
            this.handleMouseInput(e, true);
        });

        this.game.canvas.addEventListener('mousemove', (e) => {
            if (mouseDown) {
                this.handleMouseInput(e, false);
            }
        });

        this.game.canvas.addEventListener('mouseup', (e) => {
            mouseDown = false;
            this.resetSticks();
        });

        this.game.canvas.addEventListener('mouseleave', (e) => {
            mouseDown = false;
            this.resetSticks();
        });
    }

    handleTouchStart(e) {
        if (this.game.gameState !== 'playing' || !this.game.player) return;

        const rect = this.game.canvas.getBoundingClientRect();

        for (let touch of e.touches) {
            const x = (touch.clientX - rect.left) * this.game.scale.x;
            const y = (touch.clientY - rect.top) * this.game.scale.y;

            // Left side = movement, Right side = aiming
            if (x < CONFIG.canvasWidth / 2) {
                if (!this.leftStick.active) {
                    this.leftStick.active = true;
                    this.leftStick.touchId = touch.identifier;
                    this.leftStick.baseX = x;
                    this.leftStick.baseY = y;
                    this.leftStick.currentX = x;
                    this.leftStick.currentY = y;
                }
            } else {
                if (!this.rightStick.active) {
                    this.rightStick.active = true;
                    this.rightStick.touchId = touch.identifier;
                    this.rightStick.baseX = x;
                    this.rightStick.baseY = y;
                    this.rightStick.currentX = x;
                    this.rightStick.currentY = y;
                }
            }
        }

        this.updatePlayer();
    }

    handleTouchMove(e) {
        if (this.game.gameState !== 'playing' || !this.game.player) return;

        const rect = this.game.canvas.getBoundingClientRect();

        for (let touch of e.touches) {
            const x = (touch.clientX - rect.left) * this.game.scale.x;
            const y = (touch.clientY - rect.top) * this.game.scale.y;

            // Update left stick
            if (this.leftStick.active && touch.identifier === this.leftStick.touchId) {
                this.leftStick.currentX = x;
                this.leftStick.currentY = y;
            }

            // Update right stick
            if (this.rightStick.active && touch.identifier === this.rightStick.touchId) {
                this.rightStick.currentX = x;
                this.rightStick.currentY = y;
            }
        }

        this.updatePlayer();
    }

    handleTouchEnd(e) {
        const touchIds = Array.from(e.touches).map(t => t.identifier);

        // Check if left stick touch ended
        if (this.leftStick.active && !touchIds.includes(this.leftStick.touchId)) {
            this.leftStick.active = false;
            this.leftStick.touchId = null;
        }

        // Check if right stick touch ended
        if (this.rightStick.active && !touchIds.includes(this.rightStick.touchId)) {
            this.rightStick.active = false;
            this.rightStick.touchId = null;
        }

        this.updatePlayer();
    }

    handleMouseInput(e, isStart) {
        if (this.game.gameState !== 'playing' || !this.game.player) return;

        const rect = this.game.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * this.game.scale.x;
        const y = (e.clientY - rect.top) * this.game.scale.y;

        // Use player position as base for both sticks
        const playerX = this.game.player.x;
        const playerY = this.game.player.y;

        // Mouse controls both movement and aiming toward cursor
        this.leftStick.active = true;
        this.leftStick.baseX = playerX;
        this.leftStick.baseY = playerY;
        this.leftStick.currentX = x;
        this.leftStick.currentY = y;

        this.rightStick.active = true;
        this.rightStick.baseX = playerX;
        this.rightStick.baseY = playerY;
        this.rightStick.currentX = x;
        this.rightStick.currentY = y;

        this.updatePlayer();
    }

    resetSticks() {
        this.leftStick.active = false;
        this.rightStick.active = false;
        this.updatePlayer();
    }

    updatePlayer() {
        if (!this.game.player) return;

        // Update movement from left stick
        if (this.leftStick.active) {
            const dx = this.leftStick.currentX - this.leftStick.baseX;
            const dy = this.leftStick.currentY - this.leftStick.baseY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Deadzone and normalization
            if (distance > 10) {
                const normalizedDx = dx / distance;
                const normalizedDy = dy / distance;
                const strength = Math.min(1, distance / 60);

                this.game.player.setMovement(
                    normalizedDx * strength,
                    normalizedDy * strength
                );
            } else {
                this.game.player.setMovement(0, 0);
            }
        } else {
            this.game.player.setMovement(0, 0);
        }

        // Update aiming from right stick
        if (this.rightStick.active) {
            const dx = this.rightStick.currentX - this.rightStick.baseX;
            const dy = this.rightStick.currentY - this.rightStick.baseY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Deadzone
            if (distance > 10) {
                this.game.player.setAim(dx, dy);
            } else {
                this.game.player.setAim(0, 0);
            }
        } else {
            this.game.player.setAim(0, 0);
        }
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
