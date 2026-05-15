const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score');
const buttons = {
  left: document.getElementById('leftBtn'),
  right: document.getElementById('rightBtn'),
  up: document.getElementById('upBtn'),
  down: document.getElementById('downBtn'),
};

const state = {
  score: 0,
  dolphin: { x: 100, y: 260, size: 80, speed: 8 },
  butter: [],
  rocks: [],
  frame: 0,
  gameOver: false,
  direction: { left: false, right: false, up: false, down: false },
};

const colors = {
  water: '#7ad7f2',
  dolphin: '#4b98f7',
  butter: '#ffe362',
  rock: '#6b5f52',
  wave: '#ffffff',
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function spawnButter() {
  state.butter.push({
    x: 880,
    y: 80 + Math.random() * 420,
    size: 48,
    speed: 3 + Math.random() * 2,
  });
}

function spawnRock() {
  state.rocks.push({
    x: 920,
    y: 70 + Math.random() * 420,
    size: 70,
    speed: 2 + Math.random() * 1.5,
  });
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#bbf0ff');
  gradient.addColorStop(1, '#62c7ea');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    const waveY = 30 + i * 90 + Math.sin((state.frame + i * 50) / 30) * 12;
    ctx.ellipse(450, waveY, 260, 22, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDolphin() {
  const d = state.dolphin;
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.fillStyle = colors.dolphin;
  ctx.beginPath();
  ctx.ellipse(0, 0, d.size * 0.7, d.size * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-d.size * 0.15, -d.size * 0.35);
  ctx.lineTo(d.size * 0.3, -d.size * 0.6);
  ctx.lineTo(d.size * 0.4, -d.size * 0.25);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-d.size * 0.5, 0);
  ctx.lineTo(-d.size * 0.8, -d.size * 0.3);
  ctx.lineTo(-d.size * 0.75, d.size * 0.2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = '#ffffff';
  ctx.arc(d.size * 0.32, -d.size * 0.08, d.size * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = '#0a2940';
  ctx.arc(d.size * 0.33, -d.size * 0.08, d.size * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawButter(butter) {
  ctx.fillStyle = colors.butter;
  ctx.beginPath();
  ctx.rect(butter.x, butter.y, butter.size, butter.size * 0.65);
  ctx.fill();
  ctx.strokeStyle = '#f2c12d';
  ctx.lineWidth = 4;
  ctx.strokeRect(butter.x, butter.y, butter.size, butter.size * 0.65);
  ctx.fillStyle = '#ffd95f';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(butter.x + 8, butter.y + 8 + i * 12, butter.size - 16, 8);
  }
}

function drawRock(rock) {
  ctx.fillStyle = colors.rock;
  ctx.beginPath();
  ctx.moveTo(rock.x, rock.y + rock.size * 0.6);
  ctx.lineTo(rock.x + rock.size * 0.2, rock.y);
  ctx.lineTo(rock.x + rock.size * 0.7, rock.y + rock.size * 0.1);
  ctx.lineTo(rock.x + rock.size, rock.y + rock.size * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#9a897b';
  ctx.beginPath();
  ctx.arc(rock.x + rock.size * 0.55, rock.y + rock.size * 0.5, rock.size * 0.14, 0, Math.PI * 2);
  ctx.fill();
}

function updateMovement() {
  const d = state.dolphin;
  if (state.direction.left) d.x -= d.speed; 
  if (state.direction.right) d.x += d.speed; 
  if (state.direction.up) d.y -= d.speed;
  if (state.direction.down) d.y += d.speed;
  d.x = clamp(d.x, d.size * 0.9, canvas.width - d.size * 0.8);
  d.y = clamp(d.y, d.size * 0.9, canvas.height - d.size * 0.7);
}

function checkCollisions() {
  const d = state.dolphin;
  const hitbox = { x: d.x - d.size * 0.6, y: d.y - d.size * 0.45, w: d.size * 1.2, h: d.size * 0.8 };

  state.butter = state.butter.filter((butter) => {
    const overlap = butter.x < hitbox.x + hitbox.w && butter.x + butter.size > hitbox.x && butter.y < hitbox.y + hitbox.h && butter.y + butter.size * 0.65 > hitbox.y;
    if (overlap) {
      state.score += 1;
      scoreDisplay.textContent = state.score;
      return false;
    }
    return true;
  });

  state.rocks.forEach((rock) => {
    const overlap = rock.x < hitbox.x + hitbox.w && rock.x + rock.size > hitbox.x && rock.y < hitbox.y + hitbox.h && rock.y + rock.size > hitbox.y;
    if (overlap) {
      state.gameOver = true;
    }
  });
}

function updateItems() {
  state.butter.forEach((butter) => (butter.x -= butter.speed));
  state.rocks.forEach((rock) => (rock.x -= rock.speed));
  state.butter = state.butter.filter((butter) => butter.x + butter.size > -20);
  state.rocks = state.rocks.filter((rock) => rock.x + rock.size > -20);
}

function drawScoreCloud() {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  ctx.ellipse(128, 64, 112, 50, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = '#ffffff';
  ctx.ellipse(90, 90, 38, 24, 0, 0, Math.PI * 2);
  ctx.ellipse(165, 90, 30, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#25527a';
  ctx.font = 'bold 30px Segoe UI';
  ctx.fillText(`Butter ${state.score}`, 56, 68);
  ctx.restore();
}

function draw() {
  drawBackground();
  state.butter.forEach(drawButter);
  state.rocks.forEach(drawRock);
  drawDolphin();
  drawScoreCloud();
  if (state.gameOver) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('Oops! Try again.', canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = '24px Segoe UI';
    ctx.fillText('Refresh to play again.', canvas.width / 2, canvas.height / 2 + 28);
  }
}

function gameLoop() {
  if (state.gameOver) {
    draw();
    return;
  }
  state.frame += 1;
  if (state.frame % 140 === 0) spawnButter();
  if (state.frame % 210 === 0) spawnRock();
  updateMovement();
  updateItems();
  checkCollisions();
  draw();
  requestAnimationFrame(gameLoop);
}

function setupControls() {
  Object.entries(buttons).forEach(([key, button]) => {
    button.addEventListener('mousedown', () => (state.direction[key] = true));
    button.addEventListener('mouseup', () => (state.direction[key] = false));
    button.addEventListener('touchstart', (event) => {
      event.preventDefault();
      state.direction[key] = true;
    }, { passive: false });
    button.addEventListener('touchend', () => (state.direction[key] = false));
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') state.direction.left = true;
    if (event.key === 'ArrowRight') state.direction.right = true;
    if (event.key === 'ArrowUp') state.direction.up = true;
    if (event.key === 'ArrowDown') state.direction.down = true;
  });

  window.addEventListener('keyup', (event) => {
    if (event.key === 'ArrowLeft') state.direction.left = false;
    if (event.key === 'ArrowRight') state.direction.right = false;
    if (event.key === 'ArrowUp') state.direction.up = false;
    if (event.key === 'ArrowDown') state.direction.down = false;
  });
}

setupControls();
gameLoop();
