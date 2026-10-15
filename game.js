// ============================================================
//  CRASH ARENA — Balloon Rise Game Engine
// ============================================================

const CONFIG = {
  WIDTH: 700,
  HEIGHT: 400,
  GROWTH_RATE: 0.08,
  HOUSE_EDGE: 0.03,
  MAX_CRASH: 1000,
  DEFAULT_WALLET: 1000,
  MIN_BET: 1,
  MAX_BET: 10000,
  RESULT_DURATION: 3000,
  SHIELD_COST: 100,
  BALLOON_X: 350,
  BALLOON_BASE_Y: 310,
  BALLOON_MIN_Y: 90,
};

function generateCrashPoint() {
  const r = Math.random();
  const crash = (1 - CONFIG.HOUSE_EDGE) / (1 - r);
  return Math.min(CONFIG.MAX_CRASH, Math.max(1.00, Math.floor(crash * 100) / 100));
}

// === AUDIO ===
const audio = { ctx: null, riseOsc: null, riseGain: null };

function getAudioCtx() {
  if (!audio.ctx || audio.ctx.state === 'closed') {
    audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audio.ctx.state === 'suspended') audio.ctx.resume();
  return audio.ctx;
}

function playPopSound() {
  const ctx = getAudioCtx();
  const noise = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03));
  }
  noise.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.5, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
  noise.connect(g).connect(ctx.destination);
  noise.start();
  noise.stop(ctx.currentTime + 0.15);
}

const successSound = new Audio('success.mp3');
successSound.volume = 0.5;

function playWinSound() {
  successSound.currentTime = 0;
  successSound.play().catch(() => {});
}

const sadTrombone = new Audio('sad-trombone.mp3');
sadTrombone.volume = 0.5;

function playLoseSound() {
  sadTrombone.currentTime = 0;
  sadTrombone.play().catch(() => {});
}

function startRiseSound() {
  const ctx = getAudioCtx();
  audio.riseOsc = ctx.createOscillator();
  audio.riseGain = ctx.createGain();
  audio.riseOsc.type = 'sine';
  audio.riseOsc.frequency.value = 180;
  audio.riseGain.gain.value = 0.06;
  audio.riseOsc.connect(audio.riseGain).connect(ctx.destination);
  audio.riseOsc.start();
}

function updateRiseSound(mult) {
  if (!audio.riseOsc) return;
  const freq = 180 + (mult - 1) * 40;
  audio.riseOsc.frequency.setTargetAtTime(Math.min(freq, 1200), getAudioCtx().currentTime, 0.1);
  const vol = Math.min(0.12, 0.04 + (mult - 1) * 0.005);
  audio.riseGain.gain.setTargetAtTime(vol, getAudioCtx().currentTime, 0.1);
}

function stopRiseSound() {
  if (audio.riseOsc) {
    try { audio.riseOsc.stop(); } catch(e) {}
    audio.riseOsc = null;
    audio.riseGain = null;
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// === POP PARTICLE ===
class PopParticle {
  constructor(x, y, hue) {
    this.x = x; this.y = y;
    const a = Math.random() * Math.PI * 2;
    const spd = 3 + Math.random() * 7;
    this.vx = Math.cos(a) * spd;
    this.vy = Math.sin(a) * spd - 2;
    this.radius = 2 + Math.random() * 5;
    this.hue = hue;
    this.life = 1000 + Math.random() * 500;
    this.maxLife = this.life;
  }
  update(dt) { this.x += this.vx; this.y += this.vy; this.vy += 0.08; this.vx *= 0.99; this.life -= dt; }
  get dead() { return this.life <= 0; }
  draw(ctx) {
    ctx.globalAlpha = this.life / this.maxLife;
    ctx.fillStyle = `hsl(${this.hue}, 70%, ${50 + (this.hue % 20)}%)`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * (this.life / this.maxLife), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// === CONFETTI ===
class Confetti {
  constructor() {
    this.x = Math.random() * CONFIG.WIDTH;
    this.y = -10;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = 1.5 + Math.random() * 2;
    this.rot = Math.random() * Math.PI * 2;
    this.rotV = (Math.random() - 0.5) * 0.2;
    this.w = 4 + Math.random() * 4;
    this.h = 3 + Math.random() * 3;
    this.color = ['#ff4757','#ffa502','#2ed573','#6890F0','#ffd700','#ff6b81'][Math.floor(Math.random() * 6)];
    this.life = 2500;
  }
  update(dt) { this.x += this.vx; this.y += this.vy; this.rot += this.rotV; this.life -= dt; }
  get dead() { return this.life <= 0 || this.y > CONFIG.HEIGHT + 20; }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y); ctx.rotate(this.rot);
    ctx.globalAlpha = Math.min(1, this.life / 500);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

// === CLOUD ===
class Cloud {
  constructor() {
    this.x = 30 + Math.random() * (CONFIG.WIDTH - 60);
    this.baseY = Math.random() * CONFIG.HEIGHT * 2;
    this.w = 50 + Math.random() * 80;
    this.h = 15 + Math.random() * 20;
    this.opacity = 0.05 + Math.random() * 0.08;
    this.parallax = 0.3 + Math.random() * 0.7;
  }
  draw(ctx, scrollOffset) {
    const totalH = CONFIG.HEIGHT + this.h * 4;
    const y = ((this.baseY + scrollOffset * this.parallax) % totalH) - this.h * 2;
    ctx.fillStyle = `rgba(255,255,255,${this.opacity})`;
    ctx.beginPath();
    ctx.ellipse(this.x, y, this.w * 0.5, this.h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(this.x - this.w * 0.25, y + 3, this.w * 0.35, this.h * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(this.x + this.w * 0.3, y + 2, this.w * 0.3, this.h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// === GAME STATE ===
const game = {
  state: 'IDLE',
  canvas: null, ctx: null, ui: {},
  crashPoint: 0,
  originalCrashPoint: 0,
  startTime: 0,
  currentMultiplier: 1.00,
  cashedOutAt: 0,
  cashedOut: false,
  currentBet: 0,
  resultTimer: 0,
  lastTime: 0,
  animTimer: 0,
  popParticles: [],
  confetti: [],
  clouds: [],
  shieldActive: false,
  shieldUsed: false,
  history: [],
  roundNum: 0,
  stats: { played: 0, won: 0, totalWagered: 0, totalProfit: 0, bestMult: 0 },
  lastCrashPoint: 0,
  balloonY: 310,
  scrollOffset: 0,
};

let walletBalance = 0;

function loadWallet() {
  return CONFIG.DEFAULT_WALLET;
}
function saveWallet() {
  localStorage.setItem('olg-wallet', walletBalance.toFixed(2));
}

function getBalloonHue(mult) {
  if (mult < 1.5) return 210;
  if (mult < 3) return lerp(210, 120, (mult - 1.5) / 1.5);
  if (mult < 10) return lerp(120, 30, (mult - 3) / 7);
  return lerp(30, 0, Math.min(1, (mult - 10) / 20));
}

function getBalloonY(mult) {
  const t = Math.log(mult) / Math.log(50);
  return lerp(CONFIG.BALLOON_BASE_Y, CONFIG.BALLOON_MIN_Y, clamp(t, 0, 1));
}

// === GAME LOGIC ===
function startRound() {
  const betInput = parseFloat(game.ui.betInput.value);
  const bet = Math.floor(betInput * 100) / 100;
  if (isNaN(bet) || bet < CONFIG.MIN_BET) return;
  if (bet > walletBalance) return;

  walletBalance -= bet;
  saveWallet();

  game.currentBet = bet;
  game.crashPoint = generateCrashPoint();
  game.shieldUsed = false;

  game.startTime = performance.now();
  game.currentMultiplier = 1.00;
  game.cashedOutAt = 0;
  game.cashedOut = false;
  game.roundNum++;
  game.popParticles = [];
  game.confetti = [];
  game.balloonY = CONFIG.BALLOON_BASE_Y;
  game.scrollOffset = 0;
  game.state = 'RUNNING';
  startRiseSound();
  updateShieldBtn();
  updateActionBtn();
  updateUI();
}

function doCashOut() {
  if (game.state !== 'RUNNING' || game.cashedOut) return;

  game.cashedOut = true;
  game.cashedOutAt = game.currentMultiplier;
  const winnings = Math.floor(game.currentBet * game.cashedOutAt * 100) / 100;
  walletBalance += winnings;
  saveWallet();

  for (let i = 0; i < 50; i++) game.confetti.push(new Confetti());

  game.stats.won++;
  game.stats.bestMult = Math.max(game.stats.bestMult, game.cashedOutAt);
  updateActionBtn();
  updateUI();
}

function doCrash() {
  game.currentMultiplier = game.crashPoint;
  game.resultTimer = CONFIG.RESULT_DURATION;
  stopRiseSound();
  playPopSound();

  const hue = getBalloonHue(game.crashPoint);
  for (let i = 0; i < 45; i++) {
    game.popParticles.push(new PopParticle(CONFIG.BALLOON_X, game.balloonY - 5, hue));
  }

  if (game.cashedOut) {
    game.state = 'WON';
    if (game.crashPoint < game.cashedOutAt * 2) playWinSound();
    const winnings = Math.floor(game.currentBet * game.cashedOutAt * 100) / 100;
    recordRound(winnings - game.currentBet);
  } else if (game.shieldActive && Math.random() < 0.5) {
    game.state = 'CRASHED';
    game.shieldUsed = true;
    game.shieldActive = false;
    walletBalance += game.currentBet;
    saveWallet();
    recordRound(0);
  } else {
    game.state = 'CRASHED';
    game.shieldActive = false;
    playLoseSound();
    recordRound(-game.currentBet);
  }
  updateActionBtn();
  updateUI();
}

function recordRound(profit) {
  game.stats.played++;
  game.stats.totalWagered += game.currentBet;
  game.stats.totalProfit += profit;

  game.history.unshift({
    num: game.roundNum,
    crashPoint: game.crashPoint,
    cashedAt: game.cashedOutAt,
    bet: game.currentBet,
    profit: profit,
    shieldUsed: game.shieldUsed,
  });
  if (game.history.length > 30) game.history.pop();
  game.lastCrashPoint = game.crashPoint;
  updateCrashStrip();
  updateHistory();
  updateStats();
}

function buyShield() {
  if (game.shieldActive || game.state !== 'IDLE') return;
  if (walletBalance < CONFIG.SHIELD_COST) return;
  walletBalance -= CONFIG.SHIELD_COST;
  saveWallet();
  game.shieldActive = true;
  updateShieldBtn();
  updateUI();
}

// === UPDATE ===
function update(dt) {
  game.animTimer += dt / 1000;

  if (game.state === 'RUNNING') {
    const elapsed = (performance.now() - game.startTime) / 1000;
    const raw = Math.exp(CONFIG.GROWTH_RATE * elapsed);
    game.currentMultiplier = Math.floor(raw * 100) / 100;
    game.balloonY = getBalloonY(game.currentMultiplier);
    game.scrollOffset = (game.currentMultiplier - 1) * 80;
    updateRiseSound(game.currentMultiplier);

    if (!game.cashedOut) {
      const autoCashout = parseFloat(game.ui.autoCashout.value);
      if (autoCashout > 1 && game.currentMultiplier >= autoCashout) {
        game.currentMultiplier = Math.min(game.currentMultiplier, autoCashout);
        doCashOut();
      }
    }

    if (raw >= game.crashPoint) {
      doCrash();
      return;
    }

    game.confetti.forEach(c => c.update(dt));
    game.confetti = game.confetti.filter(c => !c.dead);

    updateActionBtn();
  }

  if (game.state === 'CRASHED' || game.state === 'WON') {
    game.resultTimer -= dt;
    game.popParticles.forEach(p => p.update(dt));
    game.popParticles = game.popParticles.filter(p => !p.dead);
    game.confetti.forEach(c => c.update(dt));
    game.confetti = game.confetti.filter(c => !c.dead);

    if (game.resultTimer <= 0) {
      game.state = 'IDLE';
      updateActionBtn();
      updateShieldBtn();
      updateUI();
    }
  }
}

// === RENDERING ===
function render() {
  const ctx = game.ctx;
  ctx.clearRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

  switch (game.state) {
    case 'IDLE': drawIdleScreen(ctx); break;
    case 'RUNNING': drawRunningScreen(ctx); break;
    case 'CRASHED': drawCrashedScreen(ctx); break;
    case 'WON': drawWonScreen(ctx); break;
  }
}

function drawSky(ctx, mult) {
  const grad = ctx.createLinearGradient(0, 0, 0, CONFIG.HEIGHT);
  if (mult < 3) {
    grad.addColorStop(0, '#0a1628');
    grad.addColorStop(1, '#1a2a50');
  } else if (mult < 10) {
    const t = (mult - 3) / 7;
    grad.addColorStop(0, lerpColor('#0a1628', '#050510', t));
    grad.addColorStop(1, lerpColor('#1a2a50', '#0f1530', t));
  } else {
    grad.addColorStop(0, '#030308');
    grad.addColorStop(1, '#0a0f20');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
}

function lerpColor(c1, c2, t) {
  const p = (c, i) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  const r = Math.round(lerp(p(c1, 0), p(c2, 0), t));
  const g = Math.round(lerp(p(c1, 1), p(c2, 1), t));
  const b = Math.round(lerp(p(c1, 2), p(c2, 2), t));
  return `rgb(${r},${g},${b})`;
}

function drawStars(ctx, mult) {
  if (mult < 3) return;
  const opacity = clamp((mult - 3) / 5, 0, 0.8);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 60; i++) {
    const sx = (i * 137.5 + 50) % CONFIG.WIDTH;
    const sy = (i * 97.3 + 20) % CONFIG.HEIGHT;
    const sz = 0.5 + (i % 3) * 0.5;
    ctx.globalAlpha = opacity * (Math.sin(game.animTimer * 2 + i) * 0.3 + 0.7);
    ctx.beginPath();
    ctx.arc(sx, sy, sz, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawAltitudeMarkers(ctx, mult) {
  const markers = [1.5, 2, 3, 5, 10, 20, 50];
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';

  markers.forEach(m => {
    const y = getBalloonY(m);
    if (y < 30 || y > CONFIG.HEIGHT - 10) return;
    const reached = mult >= m;
    ctx.globalAlpha = reached ? 0.4 : 0.12;
    ctx.strokeStyle = reached ? '#ffd700' : '#fff';
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(25, y); ctx.lineTo(CONFIG.WIDTH - 25, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = reached ? '#ffd700' : '#fff';
    ctx.fillText(m + 'x', 5, y + 4);
    ctx.globalAlpha = 1;
  });
}

function drawBalloon(ctx, x, y, mult, hasShield, ghosted) {
  const hue = getBalloonHue(mult);
  const bob = Math.sin(game.animTimer * 2.5) * 4;
  const dy = y + bob;

  ctx.save();
  ctx.translate(x, dy);
  if (ghosted) ctx.globalAlpha = 0.3;

  // String
  ctx.strokeStyle = ghosted ? 'rgba(170,170,170,0.2)' : 'rgba(170,170,170,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 24);
  ctx.quadraticCurveTo(4 * Math.sin(game.animTimer * 3), 40, -2, 58);
  ctx.stroke();

  // Balloon body
  const bodyGrad = ctx.createRadialGradient(-5, -12, 3, 0, 0, 28);
  bodyGrad.addColorStop(0, `hsl(${hue}, 80%, 68%)`);
  bodyGrad.addColorStop(1, `hsl(${hue}, 70%, 42%)`);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(0, 22);
  ctx.bezierCurveTo(-26, 16, -28, -18, 0, -32);
  ctx.bezierCurveTo(28, -18, 26, 16, 0, 22);
  ctx.fill();

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.ellipse(-7, -16, 5, 9, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Knot
  ctx.fillStyle = `hsl(${hue}, 60%, 32%)`;
  ctx.beginPath();
  ctx.moveTo(-3, 22); ctx.lineTo(3, 22); ctx.lineTo(0, 27);
  ctx.closePath(); ctx.fill();

  // Shield aura
  if (hasShield) {
    const pulse = 0.35 + Math.sin(game.animTimer * 4) * 0.25;
    ctx.globalAlpha = ghosted ? pulse * 0.3 : pulse;
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, -5, 42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawMultiplierText(ctx, mult, color, sub) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold 60px sans-serif';
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.fillText(mult.toFixed(2) + 'x', CONFIG.WIDTH / 2, 42);
  ctx.shadowBlur = 0;

  if (sub) {
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillText(sub, CONFIG.WIDTH / 2, 76);
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawIdleScreen(ctx) {
  drawSky(ctx, 1);
  game.clouds.forEach(c => c.draw(ctx, 0));

  drawBalloon(ctx, CONFIG.BALLOON_X, CONFIG.BALLOON_BASE_Y, 1, game.shieldActive, false);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (game.lastCrashPoint > 0) {
    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('Last round popped at ' + game.lastCrashPoint.toFixed(2) + 'x', CONFIG.WIDTH / 2, 25);
  }

  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Place your bet to launch', CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 - 40);

  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillText('The balloon rises — cash out before it pops!', CONFIG.WIDTH / 2, CONFIG.HEIGHT / 2 - 10);
}

function drawRunningScreen(ctx) {
  drawSky(ctx, game.currentMultiplier);
  drawStars(ctx, game.currentMultiplier);
  game.clouds.forEach(c => c.draw(ctx, game.scrollOffset));
  drawAltitudeMarkers(ctx, game.currentMultiplier);



  const ghosted = game.cashedOut;
  drawBalloon(ctx, CONFIG.BALLOON_X, game.balloonY, game.currentMultiplier,
    game.shieldActive || (game.shieldUsed && !game.cashedOut), ghosted);

  game.confetti.forEach(c => c.draw(ctx));

  if (game.cashedOut) {
    const winnings = (game.currentBet * game.cashedOutAt).toFixed(2);
    drawMultiplierText(ctx, game.currentMultiplier, 'rgba(255,255,255,0.3)',
      `CASHED OUT ${game.cashedOutAt.toFixed(2)}x  —  Won $${winnings}`);
  } else {
    const profit = (game.currentBet * game.currentMultiplier - game.currentBet).toFixed(2);
    const hue = getBalloonHue(game.currentMultiplier);
    drawMultiplierText(ctx, game.currentMultiplier, `hsl(${hue}, 80%, 60%)`, '+$' + profit);
  }
}

function drawCrashedScreen(ctx) {
  drawSky(ctx, game.crashPoint);
  drawStars(ctx, game.crashPoint);
  game.clouds.forEach(c => c.draw(ctx, game.scrollOffset));


  game.popParticles.forEach(p => p.draw(ctx));

  if (game.resultTimer > CONFIG.RESULT_DURATION - 300) {
    const t = (game.resultTimer - (CONFIG.RESULT_DURATION - 300)) / 300;
    ctx.fillStyle = `rgba(255,71,87,${t * 0.15})`;
    ctx.fillRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
  }

  const sub = game.shieldUsed
    ? 'SHIELD SAVED YOU  —  Bet returned!'
    : 'POPPED  —  -$' + game.currentBet.toFixed(2);
  drawMultiplierText(ctx, game.crashPoint, '#ff4757', sub);
}

function drawWonScreen(ctx) {
  drawSky(ctx, game.crashPoint);
  drawStars(ctx, game.crashPoint);
  game.clouds.forEach(c => c.draw(ctx, game.scrollOffset));


  game.popParticles.forEach(p => p.draw(ctx));
  game.confetti.forEach(c => c.draw(ctx));

  const winnings = (game.currentBet * game.cashedOutAt).toFixed(2);
  drawMultiplierText(ctx, game.cashedOutAt, '#ffd700',
    `Won $${winnings}  —  Popped at ${game.crashPoint.toFixed(2)}x`);
}

// === UI UPDATES ===
function updateUI() {
  game.ui.walletAmount.textContent = walletBalance.toFixed(2);
}

function updateActionBtn() {
  const btn = game.ui.actionBtn;
  btn.className = 'action-btn';

  switch (game.state) {
    case 'IDLE':
      btn.classList.add('bet-state');
      btn.textContent = 'Launch Balloon';
      btn.disabled = false;
      break;
    case 'RUNNING':
      if (game.cashedOut) {
        btn.classList.add('won-state');
        const win = (game.currentBet * game.cashedOutAt).toFixed(2);
        btn.textContent = `Won $${win} — Watching...`;
        btn.disabled = true;
      } else {
        btn.classList.add('cashout-state');
        const payout = (game.currentBet * game.currentMultiplier).toFixed(2);
        btn.textContent = `Cash Out ${game.currentMultiplier.toFixed(2)}x ($${payout})`;
        btn.disabled = false;
      }
      break;
    case 'CRASHED':
      btn.classList.add('crashed-state');
      btn.textContent = `Popped at ${game.crashPoint.toFixed(2)}x`;
      btn.disabled = true;
      break;
    case 'WON':
      btn.classList.add('won-state');
      const win = (game.currentBet * game.cashedOutAt).toFixed(2);
      btn.textContent = `Won $${win} at ${game.cashedOutAt.toFixed(2)}x`;
      btn.disabled = true;
      break;
  }

  const betDisabled = game.state !== 'IDLE';
  game.ui.betInput.disabled = betDisabled;
  document.querySelectorAll('.quick-bet, .bet-adjust').forEach(b => b.disabled = betDisabled);
}

function updateShieldBtn() {
  const btn = game.ui.shieldBtn;
  if (!btn) return;
  if (game.shieldActive) {
    btn.classList.add('active');
    btn.textContent = 'Shield Active';
    btn.disabled = true;
  } else {
    btn.classList.remove('active');
    btn.textContent = 'Buy Shield — $' + CONFIG.SHIELD_COST;
    btn.disabled = game.state !== 'IDLE' || walletBalance < CONFIG.SHIELD_COST;
  }
}

function updateCrashStrip() {
  const strip = game.ui.crashStrip;
  let html = '';
  game.history.forEach(h => {
    const cp = h.crashPoint;
    const cls = cp < 1.5 ? 'low' : cp < 3 ? 'mid' : cp < 10 ? 'high' : 'epic';
    html += `<div class="crash-chip ${cls}">${cp.toFixed(2)}x</div>`;
  });
  strip.innerHTML = html;
}

function updateHistory() {
  const el = game.ui.historyList;
  if (game.history.length === 0) { el.innerHTML = 'No rounds yet'; return; }

  el.innerHTML = game.history.slice(0, 15).map(h => {
    const won = h.cashedAt > 0;
    const cls = won ? 'won' : 'lost';
    const result = won
      ? `Cashed ${h.cashedAt.toFixed(2)}x → <span style="color:#2ed573">+$${h.profit.toFixed(2)}</span>`
      : `<span style="color:#ff4757">-$${Math.abs(h.profit).toFixed(2)}</span>`;
    const cpColor = h.crashPoint < 1.5 ? '#ff4757' : h.crashPoint < 3 ? '#ffa502' : '#2ed573';
    return `<div class="hist-entry ${cls}">
      <span class="hist-crash" style="color:${cpColor}">${h.crashPoint.toFixed(2)}x</span>
      <span class="hist-result">${result}</span>
    </div>`;
  }).join('');
}

function updateStats() {
  const s = game.stats;
  document.getElementById('stat-played').textContent = s.played;
  document.getElementById('stat-winrate').textContent = s.played ? Math.round(s.won / s.played * 100) + '%' : '0%';
  const profEl = document.getElementById('stat-profit');
  profEl.textContent = (s.totalProfit >= 0 ? '+' : '') + '$' + s.totalProfit.toFixed(2);
  profEl.style.color = s.totalProfit >= 0 ? '#2ed573' : '#ff4757';
  document.getElementById('stat-best').textContent = s.bestMult > 0 ? s.bestMult.toFixed(2) + 'x' : '-';
}

// === EVENT HANDLERS ===
function setupEvents() {
  game.ui.actionBtn.addEventListener('click', () => {
    if (game.state === 'IDLE') startRound();
    else if (game.state === 'RUNNING' && !game.cashedOut) doCashOut();
  });

  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      if (game.state === 'IDLE') startRound();
      else if (game.state === 'RUNNING' && !game.cashedOut) doCashOut();
    }
  });

  document.querySelectorAll('.quick-bet').forEach(btn => {
    btn.addEventListener('click', () => {
      game.ui.betInput.value = btn.dataset.amount;
    });
  });

  document.getElementById('bet-half').addEventListener('click', () => {
    const cur = parseFloat(game.ui.betInput.value) || 10;
    game.ui.betInput.value = Math.max(CONFIG.MIN_BET, Math.floor(cur / 2));
  });

  document.getElementById('bet-double').addEventListener('click', () => {
    const cur = parseFloat(game.ui.betInput.value) || 10;
    game.ui.betInput.value = Math.min(Math.floor(walletBalance), cur * 2);
  });

  game.ui.shieldBtn.addEventListener('click', buyShield);

  document.getElementById('add-funds-btn').addEventListener('click', () => {
    document.getElementById('add-funds-modal').classList.remove('hidden');
  });

  document.getElementById('close-modal-btn').addEventListener('click', () => {
    document.getElementById('add-funds-modal').classList.add('hidden');
  });

  document.querySelector('.modal-overlay').addEventListener('click', () => {
    document.getElementById('add-funds-modal').classList.add('hidden');
  });

  document.querySelectorAll('.fund-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      walletBalance += parseInt(btn.dataset.amount);
      saveWallet();
      updateUI();
      updateShieldBtn();
    });
  });

  document.getElementById('custom-fund-btn').addEventListener('click', () => {
    const input = document.getElementById('custom-amount');
    const amount = parseFloat(input.value);
    if (amount > 0) {
      walletBalance += amount;
      saveWallet();
      updateUI();
      updateShieldBtn();
      input.value = '';
    }
  });
}

// === MAIN LOOP ===
function gameLoop(timestamp) {
  const dt = Math.min(timestamp - game.lastTime, 50);
  game.lastTime = timestamp;

  update(dt);
  render();

  if (game.state === 'RUNNING') updateUI();

  requestAnimationFrame(gameLoop);
}

// === INIT ===
function init() {
  game.canvas = document.getElementById('crash-canvas');
  game.ctx = game.canvas.getContext('2d');

  game.ui = {
    walletAmount: document.getElementById('wallet-amount'),
    betInput: document.getElementById('bet-amount'),
    autoCashout: document.getElementById('auto-cashout'),
    actionBtn: document.getElementById('action-btn'),
    roundInfo: document.getElementById('round-info'),
    historyList: document.getElementById('history-list'),
    crashStrip: document.getElementById('crash-strip'),
    shieldBtn: document.getElementById('buy-shield-btn'),
  };

  // Generate clouds
  for (let i = 0; i < 15; i++) game.clouds.push(new Cloud());

  walletBalance = loadWallet();
  setupEvents();
  updateUI();
  updateActionBtn();
  updateShieldBtn();

  game.lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

window.addEventListener('DOMContentLoaded', init);
