(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: true });
  const wrap = document.getElementById('wrap');
  const overlay = document.getElementById('overlay');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const playBtn = document.getElementById('play');
  const howBtn = document.getElementById('how');

  const LS_KEY = 'neon_dodge.best';
  let best = +localStorage.getItem(LS_KEY) || 0;
  bestEl.textContent = 'Best: ' + best;

  function size() {
    const rect = wrap.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * devicePixelRatio);
    canvas.height = Math.floor(rect.height * devicePixelRatio);
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    W = rect.width; H = rect.height;
  }
  let W = 0, H = 0; size(); addEventListener('resize', size);

  const rnd = (a, b) => Math.random() * (b - a) + a;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now() / 1000;

  let running = false, over = false, t0 = 0, last = 0, score = 0, speed = 1;
  const player = { x: 120, y: 120, r: 10, vx: 0, vy: 0, acc: 800, max: 400 }; // Updated acc and max here
  const keys = new Set();
  const enemies = [];
  const shards = [];
  const particles = [];

  function reset() {
    player.x = W * 0.5; player.y = H * 0.6; player.vx = 0; player.vy = 0;
    enemies.length = 0; shards.length = 0; particles.length = 0;
    score = 0; speed = 1; last = now();
  }

  function spawnEnemy() {
    const edge = Math.floor(Math.random() * 4);
    let x, y, vx, vy, size = rnd(14, 26);
    if (edge === 0) { x = rnd(0, W); y = -30; }
    if (edge === 1) { x = W + 30; y = rnd(0, H); }
    if (edge === 2) { x = rnd(0, W); y = H + 30; }
    if (edge === 3) { x = -30; y = rnd(0, H); }
    const dx = player.x - x, dy = player.y - y;
    const len = Math.hypot(dx, dy) || 1;
    const s = rnd(80, 120) * speed;
    vx = dx / len * s; vy = dy / len * s;
    enemies.push({ x, y, vx, vy, size, life: 0 });
  }

  function spawnShard() {
    shards.push({ x: rnd(30, W - 30), y: rnd(30, H - 30), r: 8, t: 0, alive: true });
  }

  function pop(x, y, color = '#bb86fc', n = 10) {
    for (let i = 0; i < n; i++) {
      particles.push({ x, y, vx: rnd(-120, 120), vy: rnd(-120, 120), life: rnd(.4, .8), t: 0, color });
    }
  }

  addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(e.key)) keys.add(e.key);
  });
  addEventListener('keyup', e => { keys.delete(e.key); });

  let dragging = false, target = null;
  function pointer(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x, y };
  }
  canvas.addEventListener('pointerdown', e => { dragging = true; target = pointer(e); });
  addEventListener('pointermove', e => { if (dragging) target = pointer(e); });
  addEventListener('pointerup', () => { dragging = false; target = null; });

  function update(dt) {
    speed += dt * 0.03;
    if (Math.random() < dt * (0.8 * speed)) spawnEnemy();
    if (shards.length < 3 && Math.random() < dt * 0.8) spawnShard();

    let ax = 0, ay = 0;
    if (keys.has('ArrowLeft') || keys.has('a') || keys.has('A')) ax -= player.acc;
    if (keys.has('ArrowRight') || keys.has('d') || keys.has('D')) ax += player.acc;
    if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) ay -= player.acc;
    if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) ay += player.acc;

    if (target) {
      const dx = target.x - player.x, dy = target.y - player.y;
      const len = Math.hypot(dx, dy) || 1;
      ax += (dx / len) * player.acc * 1.5; // increased from 1.2
      ay += (dy / len) * player.acc * 1.5;
    }

    player.vx += ax * dt;
    player.vy += ay * dt;
    player.vx *= 0.95;  // reduced damping for more speed
    player.vy *= 0.95;
    const spd = Math.hypot(player.vx, player.vy);
    if (spd > player.max) {
      player.vx = (player.vx / spd) * player.max;
      player.vy = (player.vy / spd) * player.max;
    }

    player.x += player.vx * dt;
    player.y += player.vy * dt;

    player.x = clamp(player.x, player.r, W - player.r);
    player.y = clamp(player.y, player.r, H - player.r);

    for (let i = enemies.length - 1; i >= 0; i--) {
      let e = enemies[i];
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.life += dt;
      if (e.x < -50 || e.x > W + 50 || e.y < -50 || e.y > H + 50) {
        enemies.splice(i, 1);
        continue;
      }
      const dx = e.x - player.x, dy = e.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < e.size + player.r) {
        over = true;
      }
    }

    for (let i = shards.length - 1; i >= 0; i--) {
      const s = shards[i];
      s.t += dt;
      if (!s.alive) {
        shards.splice(i, 1);
        continue;
      }
      const dx = s.x - player.x, dy = s.y - player.y;
      if (Math.hypot(dx, dy) < s.r + player.r) {
        s.alive = false;
        score += 10;
        pop(s.x, s.y, '#00e5ff', 15);
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.t += dt;
      if (p.t > p.life) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += 80 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    if (!over) score += dt * 1.6 * speed;
    scoreEl.textContent = 'Score: ' + Math.floor(score);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Smaller subtle glow on player orb
    ctx.shadowColor = '#bb86fc';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#bb86fc';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, 2 * Math.PI);
    ctx.fill();

    ctx.shadowBlur = 0;

    enemies.forEach(e => {
      ctx.fillStyle = 'rgba(255,83,112,0.8)';
      ctx.shadowColor = '#ff5370';
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.rect(e.x - e.size / 2, e.y - e.size / 2, e.size, e.size);
      ctx.fill();
    });

    ctx.shadowBlur = 0;

    shards.forEach(s => {
      ctx.save();
      ctx.translate(s.x, s.y);
      const pulse = Math.sin(s.t * 12) * 0.3 + 1;
      ctx.scale(pulse, pulse);
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 16;
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.moveTo(0, -s.r);
      for (let i = 0; i < 5; i++) {
        ctx.lineTo(Math.cos((i * 2 + 1) * Math.PI / 5) * s.r * 0.5, Math.sin((i * 2 + 1) * Math.PI / 5) * s.r * 0.5);
        ctx.lineTo(Math.cos((i + 1) * 2 * Math.PI / 5) * s.r, Math.sin((i + 1) * 2 * Math.PI / 5) * s.r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    particles.forEach(p => {
      const alpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, 2 * Math.PI);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  function loop(t = 0) {
    if (!running) return;
    const nowTime = now();
    const dt = Math.min(nowTime - last, 0.05);
    last = nowTime;

    update(dt);
    draw();

    if (over) {
      running = false;
      overlay.style.display = 'grid';
      if (score > best) {
        best = Math.floor(score);
        localStorage.setItem(LS_KEY, best);
        bestEl.textContent = 'Best: ' + best;
      }
      playBtn.textContent = 'Retry';
    } else {
      requestAnimationFrame(loop);
    }
  }

  playBtn.addEventListener('click', () => {
    overlay.style.display = 'none';
    over = false;
    running = true;
    reset();
    last = now();
    loop();
  });

  howBtn.addEventListener('click', () => {
    alert("Use WASD or arrow keys to move the orb.\nDrag anywhere on the screen on touch devices.\nAvoid red enemies and collect cyan shards to increase your score.\nThe game speeds up over time—survive as long as possible!");
  });

})();