// Game Configuration
const config = {
    canvas: null,
    ctx: null,
    width: 800,
    height: 600,
    roadWidth: 300,
    laneCount: 3,
    laneWidth: 100
};

// Game State
let gameState = {
    running: false,
    level: 1,
    baseSpeed: 3,
    currentSpeed: 3,
    distance: 0,
    player1: null,
    player2: null,
    obstacles: [],
    decorations: [],
    lastObstacleTime: 0,
    records: {
        player1: 0,
        player2: 0
    },
    dayTime: 0.5, // 0 = night, 1 = day (0.5 = dawn)
    isNight: false,
    weatherEvent: null, // 'storm', 'rain', null
    weatherTimer: 0,
    weatherCooldown: 0,
    gameTime: 0, // Time in frames
    laneLineOffset: 0 // For lane line animation
};

// Levels Configuration
const levels = {
    1: {
        name: 'HIGHWAY',
        bgColor: '#2a4a2a',
        roadColor: '#333333',
        lineColor: '#ffff00',
        obstacleTypes: ['car', 'ambulance', 'ambulance', 'barrier'],
        obstacleFrequency: 0.02,
        theme: 'highway'
    },
    2: {
        name: 'DESERT',
        bgColor: '#d4a574',
        roadColor: '#8b7355',
        lineColor: '#ffff00',
        obstacleTypes: ['car', 'tanker', 'tanker', 'barrier'],
        obstacleFrequency: 0.02,
        theme: 'desert'
    },
    3: {
        name: 'SNOW',
        bgColor: '#c0c0c0',
        roadColor: '#666666',
        lineColor: '#ffffff',
        obstacleTypes: ['car', 'snowplow', 'snowplow', 'barrier'],
        obstacleFrequency: 0.02,
        theme: 'snow'
    }
};

// Initialize Canvas
function initCanvas() {
    config.canvas = document.getElementById('gameCanvas');
    config.ctx = config.canvas.getContext('2d');
    config.canvas.width = config.width;
    config.canvas.height = config.height;
}

// Player Class
class Player {
    constructor(x, y, width, height, color, controls) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.speed = 5;
        this.score = 0;
        this.alive = true;
        this.controls = controls;
        this.name = 'Player';
    }

    update(keys) {
        if (!this.alive) return;

        const left = keys[this.controls.left] || keys[this.controls.left.toLowerCase()];
        const right = keys[this.controls.right] || keys[this.controls.right.toLowerCase()];
        const up = keys[this.controls.up] || keys[this.controls.up.toLowerCase()];
        const down = keys[this.controls.down] || keys[this.controls.down.toLowerCase()];

        if (left && this.x > config.width / 2 - config.roadWidth / 2) {
            this.x -= this.speed;
        }
        if (right && this.x < config.width / 2 + config.roadWidth / 2 - this.width) {
            this.x += this.speed;
        }
        if (up && this.y > 0) {
            this.y -= this.speed;
        }
        if (down && this.y < config.height - this.height) {
            this.y += this.speed;
        }
    }

    draw(ctx) {
        if (!this.alive) return;
        
        // Bike body
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x + 10, this.y + 20, this.width - 20, this.height - 30);
        
        // Bike wheels
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(this.x + 15, this.y + this.height - 10, 8, 0, Math.PI * 2);
        ctx.arc(this.x + this.width - 15, this.y + this.height - 10, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Bike seat
        ctx.fillStyle = this.color === '#000000' ? '#222' : '#ddd';
        ctx.fillRect(this.x + 15, this.y + 15, this.width - 30, 8);
        
        // Handlebars
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2 - 15, this.y + 10);
        ctx.lineTo(this.x + this.width / 2 + 15, this.y + 10);
        ctx.stroke();
        
        // Headlights (only at night)
        if (gameState.isNight) {
            ctx.fillStyle = '#ffffaa';
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2 - 12, this.y + 5, 4, 0, Math.PI * 2);
            ctx.arc(this.x + this.width / 2 + 12, this.y + 5, 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Light beam
            ctx.fillStyle = 'rgba(255, 255, 170, 0.3)';
            ctx.beginPath();
            ctx.moveTo(this.x + this.width / 2 - 12, this.y);
            ctx.lineTo(this.x + this.width / 2 - 20, this.y - 30);
            ctx.lineTo(this.x + this.width / 2 - 8, this.y - 30);
            ctx.closePath();
            ctx.fill();
            
            ctx.beginPath();
            ctx.moveTo(this.x + this.width / 2 + 12, this.y);
            ctx.lineTo(this.x + this.width / 2 + 8, this.y - 30);
            ctx.lineTo(this.x + this.width / 2 + 20, this.y - 30);
            ctx.closePath();
            ctx.fill();
        }
    }

    getBounds() {
        // Smaller hitbox (reduce by 30%)
        const shrink = 0.3;
        return {
            x: this.x + (this.width * shrink / 2),
            y: this.y + (this.height * shrink / 2),
            width: this.width * (1 - shrink),
            height: this.height * (1 - shrink)
        };
    }
}

// Obstacle Class
class Obstacle {
    constructor(x, y, width, height, type, level, isStatic = false) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type;
        this.speed = gameState.currentSpeed;
        this.level = level;
        this.isStatic = isStatic; // For decoration objects on the side
        this.setColor();
    }

    setColor() {
        const levelConfig = levels[this.level];
        switch(this.type) {
            case 'ambulance':
                this.color = '#ffffff';
                this.stripeColor = '#ff0000';
                break;
            case 'tanker':
                this.color = '#ffaa00';
                this.stripeColor = '#000000';
                break;
            case 'snowplow':
                this.color = '#ffff00';
                this.stripeColor = '#000000';
                break;
            case 'barrier':
                this.color = '#ff0000';
                this.stripeColor = '#ffff00';
                break;
            case 'storm':
                this.color = '#444444';
                this.stripeColor = '#888888';
                break;
            default:
                this.color = '#4444ff';
                this.stripeColor = '#000000';
        }
    }

    update() {
        if (!this.isStatic) {
            this.y += this.speed;
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        if (this.type === 'ambulance') {
            ctx.fillStyle = this.stripeColor;
            ctx.fillRect(this.x + 5, this.y, this.width - 10, 5);
            ctx.fillRect(this.x + 5, this.y + this.height - 5, this.width - 10, 5);
            // Cross
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(this.x + this.width / 2 - 3, this.y + 5, 6, this.height - 10);
        } else if (this.type === 'tanker') {
            ctx.fillStyle = this.stripeColor;
            ctx.fillRect(this.x, this.y + this.height / 3, this.width, 10);
            ctx.fillRect(this.x, this.y + 2 * this.height / 3, this.width, 10);
        } else if (this.type === 'snowplow') {
            ctx.fillStyle = this.stripeColor;
            ctx.fillRect(this.x, this.y, this.width, 5);
            // Plow blade
            ctx.fillStyle = '#cccccc';
            ctx.beginPath();
            ctx.moveTo(this.x + this.width / 2, this.y);
            ctx.lineTo(this.x + this.width / 2 - 10, this.y - 8);
            ctx.lineTo(this.x + this.width / 2 + 10, this.y - 8);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'barrier') {
            ctx.fillStyle = this.stripeColor;
            for (let i = 0; i < this.height; i += 10) {
                ctx.fillRect(this.x, this.y + i, this.width, 5);
            }
        } else if (this.type === 'storm') {
            // Storm object - dark and dangerous
            ctx.fillStyle = '#222222';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = '#666666';
            for (let i = 0; i < this.height; i += 8) {
                ctx.fillRect(this.x + (i % 3) * 5, this.y + i, 3, 3);
            }
        }
    }

    getBounds() {
        // Smaller hitbox for obstacles too
        const shrink = 0.2;
        return {
            x: this.x + (this.width * shrink / 2),
            y: this.y + (this.height * shrink / 2),
            width: this.width * (1 - shrink),
            height: this.height * (1 - shrink)
        };
    }
}

// Decoration Class (static objects on sides)
class Decoration {
    constructor(x, y, width, height, type, level) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type; // 'house', 'city', 'bridge', 'gasstation', 'house_snow'
        this.level = level;
        this.speed = gameState.currentSpeed;
    }

    update() {
        this.y += this.speed;
    }

    draw(ctx) {
        const levelConfig = levels[this.level];
        
        if (this.type === 'house') {
            // Simple house
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(this.x, this.y + this.height / 2, this.width, this.height / 2);
            // Roof
            ctx.fillStyle = '#654321';
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + this.height / 2);
            ctx.lineTo(this.x + this.width / 2, this.y);
            ctx.lineTo(this.x + this.width, this.y + this.height / 2);
            ctx.closePath();
            ctx.fill();
            // Window
            ctx.fillStyle = '#ffffaa';
            ctx.fillRect(this.x + this.width / 4, this.y + this.height * 0.6, this.width / 4, this.height / 4);
            ctx.fillRect(this.x + this.width * 0.625, this.y + this.height * 0.6, this.width / 4, this.height / 4);
        } else if (this.type === 'city') {
            // City buildings
            for (let i = 0; i < 3; i++) {
                const h = this.height * (0.5 + Math.random() * 0.5);
                const w = this.width / 4;
                const x = this.x + i * (this.width / 3);
                ctx.fillStyle = '#555555';
                ctx.fillRect(x, this.y + this.height - h, w, h);
                // Windows
                ctx.fillStyle = '#ffffaa';
                for (let j = 0; j < Math.floor(h / 15); j++) {
                    for (let k = 0; k < 2; k++) {
                        if (Math.random() > 0.3) {
                            ctx.fillRect(x + k * (w / 2) + 2, this.y + this.height - h + j * 15 + 3, 4, 6);
                        }
                    }
                }
            }
        } else if (this.type === 'bridge') {
            // Bridge structure
            ctx.fillStyle = '#888888';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            // Bridge supports
            ctx.fillStyle = '#666666';
            for (let i = 0; i < 3; i++) {
                ctx.fillRect(this.x + i * (this.width / 3), this.y + this.height, 10, 20);
            }
        } else if (this.type === 'gasstation') {
            // Gas station
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(this.x, this.y + this.height / 2, this.width, this.height / 2);
            // Roof
            ctx.fillStyle = '#cc0000';
            ctx.fillRect(this.x, this.y + this.height / 2, this.width, 5);
            // Sign
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(this.x + this.width / 2 - 5, this.y + this.height / 2 - 15, 10, 15);
        } else if (this.type === 'house_snow') {
            // House with snow
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(this.x, this.y + this.height / 2, this.width, this.height / 2);
            // Roof with snow
            ctx.fillStyle = '#654321';
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + this.height / 2);
            ctx.lineTo(this.x + this.width / 2, this.y);
            ctx.lineTo(this.x + this.width, this.y + this.height / 2);
            ctx.closePath();
            ctx.fill();
            // Snow on roof
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(this.x + this.width / 4, this.y, this.width / 2, 3);
            // Window
            ctx.fillStyle = '#ffffaa';
            ctx.fillRect(this.x + this.width / 4, this.y + this.height * 0.6, this.width / 2, this.height / 4);
        }
    }
}

// Input Handling
const keys = {};

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    keys[key] = true;
    keys[e.code] = true;
    keys[e.key] = true;
    
    // Prevent default for arrow keys to avoid scrolling
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    keys[key] = false;
    keys[e.code] = false;
    keys[e.key] = false;
});

// Collision Detection
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

// Generate Obstacles
function generateObstacle() {
    const levelConfig = levels[gameState.level];
    const roadLeft = config.width / 2 - config.roadWidth / 2;
    const laneWidth = config.roadWidth / 3;
    
    const lane = Math.floor(Math.random() * 3);
    const x = roadLeft + lane * laneWidth + (laneWidth - 40) / 2;
    const y = -60;
    
    const obstacleType = levelConfig.obstacleTypes[
        Math.floor(Math.random() * levelConfig.obstacleTypes.length)
    ];
    
    gameState.obstacles.push(new Obstacle(x, y, 40, 60, obstacleType, gameState.level));
}

// Generate Decorations
function generateDecoration() {
    const levelConfig = levels[gameState.level];
    const roadLeft = config.width / 2 - config.roadWidth / 2;
    const sideWidth = 50;
    
    // Left side
    if (Math.random() < 0.3) {
        let type = 'house';
        if (gameState.level === 1) {
            const rand = Math.random();
            if (rand < 0.3) type = 'city';
            else if (rand < 0.6) type = 'house';
            else type = 'bridge';
        } else if (gameState.level === 2) {
            type = Math.random() < 0.7 ? 'house' : 'gasstation';
        } else if (gameState.level === 3) {
            type = 'house_snow';
        }
        
        gameState.decorations.push(new Decoration(
            roadLeft - sideWidth - 30,
            -80,
            30,
            60,
            type,
            gameState.level
        ));
    }
    
    // Right side
    if (Math.random() < 0.3) {
        let type = 'house';
        if (gameState.level === 1) {
            const rand = Math.random();
            if (rand < 0.3) type = 'city';
            else if (rand < 0.6) type = 'house';
            else type = 'bridge';
        } else if (gameState.level === 2) {
            type = Math.random() < 0.7 ? 'house' : 'gasstation';
        } else if (gameState.level === 3) {
            type = 'house_snow';
        }
        
        gameState.decorations.push(new Decoration(
            roadLeft + config.roadWidth + 30,
            -80,
            30,
            60,
            type,
            gameState.level
        ));
    }
}

// Draw Road
function drawRoad() {
    const levelConfig = levels[gameState.level];
    const roadLeft = config.width / 2 - config.roadWidth / 2;
    
    // Day/Night background
    let bgColor = levelConfig.bgColor;
    if (gameState.isNight) {
        // Darken background for night
        bgColor = darkenColor(bgColor, 0.7);
    }
    config.ctx.fillStyle = bgColor;
    config.ctx.fillRect(0, 0, config.width, config.height);
    
    // Road
    let roadColor = levelConfig.roadColor;
    if (gameState.isNight) {
        roadColor = darkenColor(roadColor, 0.8);
    }
    config.ctx.fillStyle = roadColor;
    config.ctx.fillRect(roadLeft, 0, config.roadWidth, config.height);
    
    // Lane lines (animated) - use constant speed to prevent dizziness
    let lineColor = levelConfig.lineColor;
    if (gameState.isNight) {
        lineColor = '#ffff00';
    }
    config.ctx.strokeStyle = lineColor;
    config.ctx.lineWidth = 3;
    // Use constant speed instead of distance-based to prevent too fast scrolling
    const lineSpeed = 3; // Constant speed for lane lines
    const lineOffset = (gameState.laneLineOffset * lineSpeed) % 40;
    
    for (let i = 0; i < 3; i++) {
        const x = roadLeft + (i + 1) * (config.roadWidth / 3);
        for (let y = lineOffset - 40; y < config.height; y += 40) {
            config.ctx.beginPath();
            config.ctx.moveTo(x, y);
            config.ctx.lineTo(x, y + 20);
            config.ctx.stroke();
        }
    }
    
    // Road edges
    config.ctx.strokeStyle = '#ffffff';
    config.ctx.lineWidth = 4;
    config.ctx.strokeRect(roadLeft, 0, config.roadWidth, config.height);
    
    // Desert dust effect
    if (gameState.level === 2 && !gameState.isNight) {
        drawDustEffect();
    }
    
    // Weather effects
    if (gameState.weatherEvent === 'storm' || gameState.weatherEvent === 'rain') {
        drawWeatherEffect();
    }
}

// Darken color helper
function darkenColor(color, factor) {
    const hex = color.replace('#', '');
    const r = Math.floor(parseInt(hex.substr(0, 2), 16) * factor);
    const g = Math.floor(parseInt(hex.substr(2, 2), 16) * factor);
    const b = Math.floor(parseInt(hex.substr(4, 2), 16) * factor);
    return `rgb(${r},${g},${b})`;
}

// Draw dust effect for desert
function drawDustEffect() {
    config.ctx.fillStyle = 'rgba(212, 165, 116, 0.3)';
    for (let i = 0; i < 20; i++) {
        const x = (config.width / 2) + Math.sin((gameState.distance + i * 50) / 100) * 100;
        const y = (gameState.distance * 2 + i * 30) % config.height;
        const size = 15 + Math.sin(gameState.distance / 50 + i) * 5;
        config.ctx.beginPath();
        config.ctx.arc(x, y, size, 0, Math.PI * 2);
        config.ctx.fill();
    }
}

// Draw weather effect
function drawWeatherEffect() {
    if (gameState.weatherEvent === 'rain') {
        config.ctx.strokeStyle = 'rgba(200, 200, 255, 0.6)';
        config.ctx.lineWidth = 2;
        for (let i = 0; i < 50; i++) {
            const x = (i * 20 + gameState.distance) % config.width;
            const y = (i * 15 + gameState.distance * 3) % config.height;
            config.ctx.beginPath();
            config.ctx.moveTo(x, y);
            config.ctx.lineTo(x + 2, y + 8);
            config.ctx.stroke();
        }
    } else if (gameState.weatherEvent === 'storm') {
        // Dark overlay
        config.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        config.ctx.fillRect(0, 0, config.width, config.height);
        
        // Lightning flashes
        if (Math.random() < 0.1) {
            config.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            config.ctx.fillRect(0, 0, config.width, config.height);
        }
    }
}

// Update Day/Night Cycle
function updateDayNight() {
    // Cycle every 30000 frames (about 500 seconds at 60fps) - much slower
    gameState.dayTime = (gameState.gameTime / 30000) % 1;
    gameState.isNight = gameState.dayTime < 0.25 || gameState.dayTime > 0.75;
}

// Update Weather Events
function updateWeather() {
    if (gameState.weatherEvent) {
        // Weather event is active, count down timer
        gameState.weatherTimer++;
        // Clear weather after about 5 seconds (300 frames at 60fps)
        if (gameState.weatherTimer > 300) {
            gameState.weatherEvent = null;
            gameState.weatherTimer = 0;
            gameState.weatherCooldown = 900; // 15 seconds cooldown (900 frames at 60fps)
        }
        
        // Generate storm obstacles during storm
        if (gameState.weatherEvent === 'storm' && Math.random() < 0.05) {
            const roadLeft = config.width / 2 - config.roadWidth / 2;
            const laneWidth = config.roadWidth / 3;
            const lane = Math.floor(Math.random() * 3);
            const x = roadLeft + lane * laneWidth + (laneWidth - 40) / 2;
            gameState.obstacles.push(new Obstacle(x, -60, 40, 60, 'storm', gameState.level));
        }
    } else {
        // No weather event active
        if (gameState.weatherCooldown > 0) {
            gameState.weatherCooldown--;
        } else {
            // Check if we can spawn a new weather event
            // 1 loop = 5000 distance, want 2-3 events per loop (approximately)
            // Random chance every frame after cooldown (but not too frequent)
            // About 2-3 events per loop means approximately every 1666-2500 distance
            // At average speed, this is roughly every 15-20 seconds
            if (Math.random() < 0.0003) { // Low chance per frame
                gameState.weatherEvent = Math.random() < 0.5 ? 'storm' : 'rain';
                gameState.weatherTimer = 0;
            }
        }
    }
}

// Update UI
function updateUI() {
    document.getElementById('player1Score').textContent = gameState.player1.score;
    document.getElementById('player2Score').textContent = gameState.player2.score;
    document.getElementById('levelName').textContent = levels[gameState.level].name;
    document.getElementById('speed').textContent = `Speed: ${Math.floor((gameState.currentSpeed / gameState.baseSpeed) * 100)}%`;
    
    // Show record badge for each player separately
    if (gameState.player1.score > gameState.records.player1) {
        document.getElementById('player1Record').textContent = 'NEW RECORD!';
        document.getElementById('player1Record').classList.remove('hidden');
    } else if (gameState.records.player1 > 0) {
        document.getElementById('player1Record').textContent = `Record: ${gameState.records.player1}`;
        document.getElementById('player1Record').classList.remove('hidden');
    } else {
        document.getElementById('player1Record').classList.add('hidden');
    }
    
    if (gameState.player2.score > gameState.records.player2) {
        document.getElementById('player2Record').textContent = 'NEW RECORD!';
        document.getElementById('player2Record').classList.remove('hidden');
    } else if (gameState.records.player2 > 0) {
        document.getElementById('player2Record').textContent = `Record: ${gameState.records.player2}`;
        document.getElementById('player2Record').classList.remove('hidden');
    } else {
        document.getElementById('player2Record').classList.add('hidden');
    }
}

// Game Loop
function gameLoop() {
    if (!gameState.running) return;
    
    // Update game time and lane line offset
    gameState.gameTime++;
    gameState.laneLineOffset++;
    
    // Clear canvas
    config.ctx.clearRect(0, 0, config.width, config.height);
    
    // Update day/night cycle
    updateDayNight();
    
    // Update weather
    updateWeather();
    
    // Draw road
    drawRoad();
    
    // Update players
    gameState.player1.update(keys);
    gameState.player2.update(keys);
    
    // Update obstacles
    gameState.obstacles.forEach(obstacle => {
        obstacle.speed = gameState.currentSpeed;
        obstacle.update();
    });
    
    // Update decorations
    gameState.decorations.forEach(decoration => {
        decoration.speed = gameState.currentSpeed;
        decoration.update();
    });
    
    // Remove off-screen obstacles
    gameState.obstacles = gameState.obstacles.filter(obs => obs.y < config.height + 100);
    gameState.decorations = gameState.decorations.filter(dec => dec.y < config.height + 100);
    
    // Generate new obstacles
    if (Math.random() < levels[gameState.level].obstacleFrequency) {
        generateObstacle();
    }
    
    // Generate decorations
    if (Math.random() < 0.1) {
        generateDecoration();
    }
    
    // Draw decorations
    gameState.decorations.forEach(decoration => decoration.draw(config.ctx));
    
    // Collision detection
    gameState.obstacles.forEach(obstacle => {
        if (gameState.player1.alive && checkCollision(gameState.player1.getBounds(), obstacle.getBounds())) {
            gameState.player1.alive = false;
        }
        if (gameState.player2.alive && checkCollision(gameState.player2.getBounds(), obstacle.getBounds())) {
            gameState.player2.alive = false;
        }
    });
    
    // Update distance and speed
    gameState.distance += gameState.currentSpeed;
    gameState.currentSpeed = gameState.baseSpeed + (gameState.distance / 5000) * 2;
    
    // Update scores
    if (gameState.player1.alive) {
        gameState.player1.score += Math.floor(gameState.currentSpeed);
    }
    if (gameState.player2.alive) {
        gameState.player2.score += Math.floor(gameState.currentSpeed);
    }
    
    // Level progression (cycle: 1->2->3->1->2->3)
    const levelCycle = [1, 2, 3];
    const levelIndex = Math.floor(gameState.distance / 5000) % levelCycle.length;
    gameState.level = levelCycle[levelIndex];
    
    // Draw obstacles
    gameState.obstacles.forEach(obstacle => obstacle.draw(config.ctx));
    
    // Draw players
    gameState.player1.draw(config.ctx);
    gameState.player2.draw(config.ctx);
    
    // Update UI
    updateUI();
    
    // Check game over
    if (!gameState.player1.alive && !gameState.player2.alive) {
        endGame();
        return;
    }
    
    requestAnimationFrame(gameLoop);
}

// End Game
function endGame() {
    gameState.running = false;
    
    const player1Score = gameState.player1.score;
    const player2Score = gameState.player2.score;
    const maxScore = Math.max(player1Score, player2Score);
    
    document.getElementById('finalPlayer1Name').textContent = gameState.player1.name;
    document.getElementById('finalPlayer1Score').textContent = player1Score;
    document.getElementById('finalPlayer2Name').textContent = gameState.player2.name;
    document.getElementById('finalPlayer2Score').textContent = player2Score;
    
    let winnerText = '';
    if (player1Score > player2Score) {
        winnerText = `🏆 WINNER: ${gameState.player1.name.toUpperCase()} 🏆`;
    } else if (player2Score > player1Score) {
        winnerText = `🏆 WINNER: ${gameState.player2.name.toUpperCase()} 🏆`;
    } else {
        winnerText = '⚔️ TIE GAME ⚔️';
    }
    
    document.getElementById('winnerDisplay').textContent = winnerText;
    
    // Check for new records (compare with each player's own record)
    let recordText = '';
    let hasNewRecord = false;
    
    // Check Player 1 record
    if (player1Score > gameState.records.player1) {
        gameState.records.player1 = player1Score;
        if (!hasNewRecord) {
            recordText = `🎉 ${gameState.player1.name} NEW RECORD! ${player1Score} 🎉`;
            hasNewRecord = true;
        }
    }
    
    // Check Player 2 record
    if (player2Score > gameState.records.player2) {
        gameState.records.player2 = player2Score;
        if (hasNewRecord) {
            recordText = `🎉 BOTH PLAYERS NEW RECORDS! 🎉`;
        } else {
            recordText = `🎉 ${gameState.player2.name} NEW RECORD! ${player2Score} 🎉`;
        }
    }
    
    // If no new records, show best records
    if (!hasNewRecord) {
        if (gameState.records.player1 > 0 || gameState.records.player2 > 0) {
            recordText = `📊 Records - ${gameState.player1.name}: ${gameState.records.player1} | ${gameState.player2.name}: ${gameState.records.player2}`;
        } else {
            recordText = '';
        }
    }
    
    document.getElementById('recordDisplay').textContent = recordText;
    
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.remove('hidden');
}

// Start Game
function startGame() {
    const player1Name = document.getElementById('player1Name').value.trim() || 'Player 1';
    const player2Name = document.getElementById('player2Name').value.trim() || 'Player 2';
    
    // Initialize players
    const roadLeft = config.width / 2 - config.roadWidth / 2;
    const laneWidth = config.roadWidth / 3;
    
    gameState.player1 = new Player(
        roadLeft + laneWidth - 20,
        config.height - 150,
        40,
        60,
        '#000000',
        { left: 'a', right: 'd', up: 'w', down: 's' }
    );
    gameState.player1.name = player1Name;
    
    gameState.player2 = new Player(
        roadLeft + 2 * laneWidth - 20,
        config.height - 150,
        40,
        60,
        '#ffffff',
        { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' }
    );
    gameState.player2.name = player2Name;
    
    // Reset game state
    gameState.running = true;
    gameState.level = 1;
    gameState.baseSpeed = 3;
    gameState.currentSpeed = 3;
    gameState.distance = 0;
    gameState.obstacles = [];
    gameState.decorations = [];
    gameState.player1.score = 0;
    gameState.player2.score = 0;
    gameState.dayTime = 0.5;
    gameState.isNight = false;
    gameState.weatherEvent = null;
    gameState.weatherTimer = 0;
    gameState.weatherCooldown = 0;
    gameState.gameTime = 0;
    gameState.laneLineOffset = 0;
    
    // Update display names
    document.getElementById('player1DisplayName').textContent = player1Name;
    document.getElementById('player2DisplayName').textContent = player2Name;
    
    // Show game screen
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');
    
    // Start game loop
    gameLoop();
}

// Restart Game
function restartGame() {
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('startScreen').classList.remove('hidden');
}

// Event Listeners
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', restartGame);

// Initialize
initCanvas();
