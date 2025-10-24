# Ball Breaker - Roguelite Breakout Game

A fast-paced roguelite breakout game inspired by Ball X Pit, featuring a mobile character that shoots balls upward, dynamic powerups, and wave-based progression.

## Features

### Core Gameplay
- **Mobile Character**: Control a character that moves around the arena and auto-fires balls upward
- **Auto-Firing Mechanics**: Balls automatically shoot from your character toward enemies
- **Touch & Mouse Controls**: Optimized for both mobile and desktop play
- **Wave-Based Progression**: Survive waves to unlock upgrades and advance levels

### Roguelite Elements
- **Upgrade System**: Choose from random upgrades between waves
- **Ball Types & Fusion**: Unlock special ball types with unique effects:
  - **Fire Balls**: Deal damage over time with burning effect
  - **Ice Balls**: Slow enemies on hit
  - **Lightning Balls**: Chain to nearby enemies
  - **Explosive Balls**: Area-of-effect damage

### Upgrades Available
- **Power Boost**: Increase ball damage
- **Swift Balls**: Increase ball speed
- **Rapid Fire**: Shoot balls more frequently
- **Multi-Shot**: Fire multiple balls at once
- **Piercing Shots**: Balls pass through multiple enemies
- **Health Boost**: Increase max HP and heal
- **Ball Evolution**: Unlock new ball types with special effects

### Enemy Types
- **Normal**: Standard enemies with balanced stats
- **Tank**: High HP, slow movement
- **Fast**: Quick movement, lower HP

### Visual Effects
- Particle explosions
- Status effect indicators
- Dynamic lighting and glow effects
- Grid-based background
- Wave progress indicator

## How to Play

1. **Move**: Click/tap anywhere on the screen to move your character
2. **Shoot**: Balls auto-fire upward automatically
3. **Survive**: Destroy enemies before they reach the bottom
4. **Collect**: Pick up powerups dropped by enemies
5. **Upgrade**: Choose upgrades between waves to become stronger

## Controls

- **Desktop**: Move mouse to control character position
- **Mobile**: Tap/drag to move character
- **Works on**: Modern browsers with HTML5 Canvas support

## Deployment

The game is automatically deployed to GitHub Pages via GitHub Actions on every push to the main branch.

### Local Development

Simply open `index.html` in a modern web browser, or serve it with a local web server:

```bash
# Python 3
python -m http.server 8000

# Node.js
npx http-server
```

Then visit `http://localhost:8000` in your browser.

## Technologies Used

- HTML5 Canvas
- Vanilla JavaScript
- CSS3
- GitHub Pages
- GitHub Actions

## Game Design Inspiration

Inspired by [Ball X Pit](https://www.ballxpit.com/), this game combines:
- Arkanoid-style ball physics
- Vampire Survivors-style progression
- Roguelite upgrade mechanics
- Mobile-friendly controls

Enjoy the game and see how far you can progress!