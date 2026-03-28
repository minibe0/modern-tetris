// --- Constants & Canvas Setup ---
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

const canvas = document.getElementById('tetris-canvas');
const ctx = canvas.getContext('2d');

const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');

const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');

// --- UI Elements ---
const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const linesElement = document.getElementById('lines');
const comboAlert = document.getElementById('combo-alert');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreElement = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');

ctx.scale(BLOCK_SIZE, BLOCK_SIZE);

// --- Tetromino Definitions ---
const SHAPES = [
    [], // Empty (0)
    [ // I (1)
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],
    [ // J (2)
        [2, 0, 0],
        [2, 2, 2],
        [0, 0, 0]
    ],
    [ // L (3)
        [0, 0, 3],
        [3, 3, 3],
        [0, 0, 0]
    ],
    [ // O (4)
        [4, 4],
        [4, 4]
    ],
    [ // S (5)
        [0, 5, 5],
        [5, 5, 0],
        [0, 0, 0]
    ],
    [ // T (6)
        [0, 6, 0],
        [6, 6, 6],
        [0, 0, 0]
    ],
    [ // Z (7)
        [7, 7, 0],
        [0, 7, 7],
        [0, 0, 0]
    ]
];

// Neon Colors mapped to indices
const COLORS = [
    null,
    '#00ffff', // Cyan (I)
    '#0000ff', // Blue (J)
    '#ff7f00', // Orange (L)
    '#ffff00', // Yellow (O)
    '#00ff00', // Green (S)
    '#800080', // Purple (T)
    '#ff0000'  // Red (Z)
];

// --- Game Variables ---
let board = [];
let accountValues = { score: 0, lines: 0, level: 1, combo: 0 };
let currentPiece = null;
let nextPiece = null;
let holdPiece = null;
let canHold = true;
let isGameOver = false;

let reqAnimId = null;
let time = { start: 0, elapsed: 0, level: 1000 };

// --- Helper Functions ---
function getEmptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function updateAccount(key, value) {
    accountValues[key] = value;
    if (key === 'score') scoreElement.textContent = value;
    if (key === 'level') levelElement.textContent = value;
    if (key === 'lines') linesElement.textContent = value;
}

// Random piece generator
function randomPiece() {
    const typeId = Math.floor(Math.random() * 7) + 1;
    return new Piece(typeId);
}

// --- Class Definitions ---
class Piece {
    constructor(typeId) {
        this.typeId = typeId;
        this.shape = SHAPES[typeId];
        this.color = COLORS[typeId];
        this.x = Math.floor((COLS - this.shape[0].length) / 2);
        this.y = 0;
    }

    draw(targetCtx, offsetX = 0, offsetY = 0, size = 1, isGhost = false) {
        targetCtx.fillStyle = this.color;
        this.shape.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value !== 0) {
                    const drawX = (this.x + x) * size + offsetX;
                    const drawY = (this.y + y) * size + offsetY;
                    
                    if (isGhost) {
                        targetCtx.globalAlpha = 0.2;
                        targetCtx.fillRect(drawX, drawY, size, size);
                        targetCtx.globalAlpha = 1.0;
                    } else {
                        // Neon glow effect setup
                        targetCtx.shadowBlur = 10;
                        targetCtx.shadowColor = this.color;
                        targetCtx.fillRect(drawX, drawY, size, size);
                        
                        targetCtx.shadowBlur = 0; // Reset
                        // Inner fill for glass-like block
                        targetCtx.fillStyle = 'rgba(255,255,255,0.3)';
                        targetCtx.fillRect(drawX + size * 0.1, drawY + size * 0.1, size * 0.8, size * 0.8);
                        targetCtx.fillStyle = this.color; // Restore fill
                    }
                }
            });
        });
    }

    move(p) {
        this.x = p.x;
        this.y = p.y;
        this.shape = p.shape;
    }
}

// --- Core Logic ---
function drawBoard() {
    // Clear canvas
    ctx.clearRect(0, 0, COLS, ROWS);

    // Draw settled blocks
    board.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value > 0) {
                const color = COLORS[value];
                ctx.fillStyle = color;
                ctx.shadowBlur = 10;
                ctx.shadowColor = color;
                ctx.fillRect(x, y, 1, 1);
                
                ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fillRect(x + 0.1, y + 0.1, 0.8, 0.8);
            }
        });
    });
}

function drawGhost() {
    if (!currentPiece) return;
    const p = { ...currentPiece, shape: currentPiece.shape };
    while (isValidMove(p.x, p.y + 1, p.shape)) {
        p.y++;
    }
    const ghost = new Piece(currentPiece.typeId);
    ghost.x = p.x;
    ghost.y = p.y;
    ghost.shape = p.shape;
    ghost.draw(ctx, 0, 0, 1, true);
}

function drawNextAndHold() {
    // Clear
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);

    const renderPiece = (targetPiece, targetCtx, canvasEl) => {
        if (!targetPiece) return;
        const bs = 20; // 20px per block for previews
        const w = targetPiece.shape[0].length * bs;
        const h = targetPiece.shape.length * bs;
        const px = (canvasEl.width - w) / 2;
        const py = (canvasEl.height - h) / 2;

        targetCtx.fillStyle = targetPiece.color;
        targetCtx.shadowBlur = 10;
        targetCtx.shadowColor = targetPiece.color;

        targetPiece.shape.forEach((row, y) => {
            row.forEach((val, x) => {
                if (val > 0) {
                    targetCtx.fillRect(px + x * bs, py + y * bs, bs, bs);
                }
            });
        });
        targetCtx.shadowBlur = 0;
    };

    renderPiece(nextPiece, nextCtx, nextCanvas);
    renderPiece(holdPiece, holdCtx, holdCanvas);
}

function isValidMove(x, y, shape) {
    return shape.every((row, dy) => {
        return row.every((value, dx) => {
            let newX = x + dx;
            let newY = y + dy;
            return (
                value === 0 ||
                (newX >= 0 && newX < COLS && newY <= ROWS && board[newY] && board[newY][newX] === 0)
            );
        });
    });
}

function rotate(matrix) {
    const N = matrix.length;
    const result = matrix.map((row, i) =>
        matrix.map(val => val[i]).reverse()
    );
    return result;
}

function lockPiece() {
    currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value > 0) {
                board[currentPiece.y + y][currentPiece.x + x] = value;
            }
        });
    });

    clearLines();
    currentPiece = nextPiece;
    nextPiece = randomPiece();
    canHold = true;

    if (!isValidMove(currentPiece.x, currentPiece.y, currentPiece.shape)) {
        gameOver();
    }
}

function clearLines() {
    let linesCleared = 0;

    board.forEach((row, y) => {
        if (row.every(value => value > 0)) {
            linesCleared++;
            board.splice(y, 1);
            board.unshift(Array(COLS).fill(0));
        }
    });

    if (linesCleared > 0) {
        // Fun Effect: Shake screen
        document.querySelector('.game-container').classList.add('shake');
        setTimeout(() => document.querySelector('.game-container').classList.remove('shake'), 400);

        accountValues.combo++;
        let pnts = [0, 100, 300, 500, 800][linesCleared];
        pnts += (accountValues.combo - 1) * 50; // Bonus
        
        updateAccount('score', accountValues.score + pnts);
        updateAccount('lines', accountValues.lines + linesCleared);
        
        if (accountValues.lines >= accountValues.level * 10) {
            updateAccount('level', accountValues.level + 1);
            time.level = Math.max(100, 1000 - (accountValues.level * 50));
        }

        if (accountValues.combo >= 2) {
            comboAlert.textContent = `COMBO x${accountValues.combo}!`;
            comboAlert.classList.remove('hidden');
            comboAlert.style.animation = 'none';
            void comboAlert.offsetWidth; // trigger reflow
            comboAlert.style.animation = 'popAndFade 1.2s ease-out forwards';
        }
    } else {
        accountValues.combo = 0;
    }
}

function drop() {
    const p = { ...currentPiece, y: currentPiece.y + 1 };
    if (isValidMove(p.x, p.y, p.shape)) {
        currentPiece.move(p);
    } else {
        lockPiece();
    }
}

function hardDrop() {
    while (isValidMove(currentPiece.x, currentPiece.y + 1, currentPiece.shape)) {
        currentPiece.y++;
    }
    lockPiece();
}

function hold() {
    if (!canHold) return;
    if (holdPiece) {
        const temp = currentPiece.typeId;
        currentPiece = new Piece(holdPiece.typeId);
        holdPiece = new Piece(temp);
    } else {
        holdPiece = new Piece(currentPiece.typeId);
        currentPiece = nextPiece;
        nextPiece = randomPiece();
    }
    canHold = false;
}

function gameOver() {
    isGameOver = true;
    cancelAnimationFrame(reqAnimId);
    gameOverScreen.classList.remove('hidden');
    finalScoreElement.textContent = accountValues.score;
}

function resetGame() {
    board = getEmptyBoard();
    updateAccount('score', 0);
    updateAccount('lines', 0);
    updateAccount('level', 1);
    accountValues.combo = 0;
    isGameOver = false;
    currentPiece = randomPiece();
    nextPiece = randomPiece();
    holdPiece = null;
    canHold = true;
    time = { start: performance.now(), elapsed: 0, level: 1000 };
    gameOverScreen.classList.add('hidden');
    comboAlert.classList.add('hidden');
}

function animate(now = 0) {
    if (isGameOver) return;

    time.elapsed = now - time.start;
    if (time.elapsed > time.level) {
        time.start = now;
        drop();
    }

    drawBoard();
    drawGhost();
    if (currentPiece) currentPiece.draw(ctx);
    drawNextAndHold();

    reqAnimId = requestAnimationFrame(animate);
}

// --- Inputs ---
document.addEventListener('keydown', event => {
    if (isGameOver) return;
    const p = { ...currentPiece };

    switch (event.code) {
        case 'ArrowLeft':
            p.x -= 1;
            if (isValidMove(p.x, p.y, p.shape)) currentPiece.move(p);
            break;
        case 'ArrowRight':
            p.x += 1;
            if (isValidMove(p.x, p.y, p.shape)) currentPiece.move(p);
            break;
        case 'ArrowDown':
            drop();
            break;
        case 'ArrowUp':
            p.shape = rotate(p.shape);
            if (isValidMove(p.x, p.y, p.shape)) currentPiece.move(p);
            break;
        case 'Space':
            event.preventDefault(); // prevent scrolling
            hardDrop();
            break;
        case 'KeyC':
            hold();
            break;
    }
});

startBtn.addEventListener('click', () => {
    resetGame();
    animate();
});

// --- Initialize Background Particles ---
window.onload = function() {
    particlesJS('particles-js', {
        particles: {
            number: { value: 60, density: { enable: true, value_area: 800 } },
            color: { value: "#ffffff" },
            shape: { type: "circle" },
            opacity: { value: 0.2, random: true },
            size: { value: 3, random: true },
            line_linked: {
                enable: true,
                distance: 150,
                color: "#00f3ff",
                opacity: 0.2,
                width: 1
            },
            move: {
                enable: true,
                speed: 2,
                direction: "none",
                random: true,
                straight: false,
                out_mode: "out",
                bounce: false
            }
        },
        interactivity: {
            detect_on: "canvas",
            events: {
                onhover: { enable: true, mode: "grab" },
                onclick: { enable: true, mode: "push" },
                resize: true
            },
            modes: {
                grab: { distance: 140, line_linked: { opacity: 0.8 } }
            }
        },
        retina_detect: true
    });

    // Auto-start the game
    resetGame();
    animate();
};
