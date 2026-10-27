/**
 * Background effects for the game (stars, particles, etc.)
 * Moved to entities/ directory and converted to TypeScript for better organization.
 */

// Define interface for a star object
interface Star {
  x: number;
  y: number;
  brightness: number;
  speed: number;
  sprite: number;
}

const COLORS = ['rgba(255, 255, 255, 0.8)', 'rgba(173, 216, 230, 0.8)', 'rgba(255, 223, 186, 0.8)', 'rgba(186, 218, 255, 0.8)'];
const SIZES = 8;
const CELL = 32;
const MAX_STARS = 400;

export default class Background {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private stars: Star[];
  private atlas: HTMLCanvasElement;
  private gradient: CanvasGradient | null = null;
  private width = 0;
  private height = 0;
  private lastAt = 0;
  
  /**
   * Creates a new Background instance
   * @param canvas - The game canvas
   */
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.atlas = this.createAtlas();
    
    // Stars for background
    this.stars = [];
    this.initStars();
  }
  
  /**
   * Initialize star field
   */
  private initStars(): void {
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    this.gradient.addColorStop(0, '#000000');
    this.gradient.addColorStop(1, '#0a192f');
    // Create stars based on canvas size
    const starCount = Math.min(MAX_STARS, Math.floor(this.canvas.width * this.canvas.height / 2000));
    
    for (let i = 0; i < starCount; i++) {
      const size = Math.random() * 2 + 0.5;
      const color = Math.floor(Math.random() * COLORS.length);
      this.stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        brightness: Math.random() * 0.5 + 0.5,
        speed: Math.random() * 0.3 + 0.1,
        sprite: color * SIZES + Math.round((size - .5) / 2 * (SIZES - 1))
      });
    }
  }
  
  /**
   * Pre-render the bounded set of glow sizes and colors
   */
  private createAtlas(): HTMLCanvasElement {
    const atlas = document.createElement('canvas');
    atlas.width = CELL * SIZES; atlas.height = CELL * COLORS.length;
    const ctx = atlas.getContext('2d')!;
    // Blur each tiny sprite once, never the main canvas during animation. This avoids
    // hundreds of per-frame blur operations on Firefox's slower Canvas2D paths.
    COLORS.forEach((color, row) => {
      for (let size = 0; size < SIZES; size++) {
        const radius = .5 + size / (SIZES - 1) * 2;
        ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = radius * 2;
        ctx.beginPath(); ctx.arc(size * CELL + CELL / 2, row * CELL + CELL / 2, radius, 0, Math.PI * 2); ctx.fill();
      }
    });
    return atlas;
  }
  
  /**
   * Update and draw background
   * @param timestamp - Current animation timestamp
   */
  update(timestamp: number): void {
    // Draw dark background gradient
    this.ctx.fillStyle = this.gradient ?? '#0a192f';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw and update stars
    this.updateStars(timestamp);
  }
  
  /**
   * Update and draw star field
   * @param timestamp - Current animation timestamp
   */
  private updateStars(timestamp: number): void {
    const elapsed = this.lastAt ? Math.min(4, Math.max(0, (timestamp - this.lastAt) / (1000 / 60))) : 1;
    this.lastAt = timestamp;
    // Twinkle effect timing
    const twinkleFactor = Math.sin(timestamp / 1000) * 0.2 + 0.8;
    
    for (const star of this.stars) {
      // Move star down slightly (parallax scrolling effect)
      star.y += star.speed * elapsed;
      
      // Reset position if out of view
      if (star.y > this.canvas.height) {
        star.y = 0;
        star.x = Math.random() * this.canvas.width;
      }
      
      // Draw star with twinkle effect
      const brightness = star.brightness * twinkleFactor;
      this.ctx.globalAlpha = brightness;
      this.ctx.drawImage(this.atlas, (star.sprite % SIZES) * CELL, Math.floor(star.sprite / SIZES) * CELL,
        CELL, CELL, Math.round(star.x - CELL / 2), Math.round(star.y - CELL / 2), CELL, CELL);
    }
    
    // Restore opacity for the game scene
    this.ctx.globalAlpha = 1;
  }
  
  /**
   * Resize handler - recreate stars when canvas size changes
   */
  resize(): void {
    if (this.width === this.canvas.width && this.height === this.canvas.height) return;
    this.stars = [];
    this.lastAt = 0;
    this.initStars();
  }

  /**
   * Draw the background - alias for update
   * @param timestamp - Current animation timestamp
   */
  draw(timestamp: number): void {
    this.update(timestamp);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // No resources to clean up currently, 
    // but included for consistency with other entity classes
    this.stars = [];
  }
}
