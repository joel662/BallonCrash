# Balloon Rush

A casino-style crash game where a balloon rises with an increasing multiplier. Cash out before it pops to win, or lose your bet.

## How It Works

### The Multiplier

The multiplier grows exponentially over time using the formula:

```
multiplier = e^(GROWTH_RATE * elapsed_seconds)
```

- **Growth rate:** 0.08 per second
- At 1 second: ~1.08x
- At 5 seconds: ~1.49x
- At 10 seconds: ~2.23x
- At 30 seconds: ~11.02x

The multiplier starts at 1.00x and climbs smoothly. The longer you wait, the higher your potential payout — but the balloon can pop at any moment.

### Crash Point (When the Balloon Pops)

Each round, a crash point is pre-determined using this formula:

```
crashPoint = (1 - HOUSE_EDGE) / (1 - random())
```

Where `HOUSE_EDGE = 0.03` (3%) and `random()` is a uniform random number between 0 and 1.

This creates an inverse distribution where:

| Crash Point | Probability of Reaching |
|-------------|------------------------|
| 1.00x | 97.0% |
| 1.50x | 64.7% |
| 2.00x | 48.5% |
| 3.00x | 32.3% |
| 5.00x | 19.4% |
| 10.00x | 9.7% |
| 20.00x | 4.85% |
| 50.00x | 1.94% |
| 100.00x | 0.97% |

Low crashes are common. High multipliers are rare but possible.

### Return to Player (RTP): 97%

The mathematical expected return is exactly **97%** regardless of what strategy the player uses.

**Proof:** For any fixed cashout target `x`:
- Probability of surviving to `x` = `0.97 / x`
- Payout if you survive = `x`
- Expected return = `x * (0.97 / x)` = **0.97**

This means on average, for every $100 wagered, $97 is returned and $3 goes to the house. No strategy can beat the house edge — it's baked into the crash distribution.

### The Shield ($100)

A purchasable power-up before each round:
- **50% chance** of activating when the balloon pops
- If it activates and you haven't cashed out, your **bet is refunded**
- If it doesn't activate, you lose your bet as normal
- If you already cashed out, the shield doesn't matter

**Expected value of the shield:** Since it only helps when you lose (and only 50% of the time), the shield is a side bet. It costs $100 and returns your bet amount half the time you would have lost. Whether it's worth it depends on your bet size — for large bets it can be good insurance, for small bets it's a bad deal.

## Architecture

### Tech Stack
- **Frontend:** Vanilla HTML5, CSS3, JavaScript (no frameworks or dependencies)
- **Rendering:** HTML5 Canvas 2D for all game visuals
- **Audio:** Web Audio API for synthesized sounds + MP3 files for win/lose
- **Storage:** localStorage for wallet persistence during a session

### File Structure

```
BalloonCrash/
  index.html        — Page structure and UI layout
  style.css         — Dark theme styling, responsive layout
  game.js           — Game engine (~750 lines)
  sad-trombone.mp3  — Lose sound effect
  success.mp3       — Win sound effect
  README.md
```

### Game State Machine

```
IDLE → RUNNING → CRASHED (lost) → IDLE
                → WON (cashed out, then balloon popped) → IDLE
```

- **IDLE:** Balloon rests at the bottom. Player sets bet, buys shield, clicks "Launch Balloon."
- **RUNNING:** Balloon rises, multiplier climbs, player can cash out at any time. After cashout, balloon continues rising (ghosted) until it pops.
- **CRASHED:** Balloon popped without cashout. Bet is lost (unless shield activates). Shows result for 3 seconds.
- **WON:** Player cashed out and balloon has now popped. Shows cashout amount and crash point.

### RNG Implementation

```javascript
function generateCrashPoint() {
  const r = Math.random();
  const crash = (1 - 0.03) / (1 - r);
  return Math.min(1000, Math.max(1.00, Math.floor(crash * 100) / 100));
}
```

- Uses `Math.random()` (client-side, not cryptographically secure)
- Crash point is capped at 1000x
- Floored to 2 decimal places
- Generated once at round start, before the balloon launches

### Visual System

- **Balloon:** Drawn with bezier curves, color shifts from blue (low) to green to orange to red (high multiplier) using HSL hue mapping
- **Sky:** Gradient transitions from night sky to deep space at high multipliers
- **Stars:** Appear above 3x, twinkle with sine-based animation
- **Clouds:** 15 pre-generated clouds with parallax scrolling
- **Altitude markers:** Dashed lines at key multiplier thresholds (1.5x, 2x, 3x, 5x, 10x, 20x, 50x)
- **Pop particles:** 45 colored particles burst from balloon position on crash
- **Confetti:** 50 falling rectangles on successful cashout

### Audio System

| Event | Sound |
|-------|-------|
| Balloon launches | Rising sine tone (pitch increases with multiplier) |
| Balloon pops | Synthesized white noise burst |
| Cash out (good timing) | success.mp3 (only if crash < 2x cashout) |
| Lose | sad-trombone.mp3 |

## Configuration

All tunable parameters are in the `CONFIG` object at the top of `game.js`:

```javascript
const CONFIG = {
  GROWTH_RATE: 0.08,     // Multiplier speed (exponential rate per second)
  HOUSE_EDGE: 0.03,      // 3% house edge → 97% RTP
  MAX_CRASH: 1000,       // Maximum possible crash point
  DEFAULT_WALLET: 1000,  // Starting balance on page load
  MIN_BET: 1,            // Minimum bet
  MAX_BET: 10000,        // Maximum bet
  RESULT_DURATION: 3000, // How long result screen shows (ms)
  SHIELD_COST: 100,      // Shield price
};
```
