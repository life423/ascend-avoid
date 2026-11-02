/**
 * Advanced sprite system for game entities
 * Modernized and converted to TypeScript
 */

// Animation frame timing (milliseconds)
const ANIMATION_SPEED = 200;

/**
 * Interface for SpriteSheets containing animation frames
 */
interface SpriteSheets {
  [key: string]: HTMLImageElement[];
}

/**
 * Modernized Sprite Manager class to handle sprite creation, caching, and animation
 */
class SpriteManager {
  // Sprite cache storage
  // private frameCache: Record<string, HTMLImageElement> = {};
  private spriteSheets: SpriteSheets = {};
  private currentFrame = 0;
  private lastFrameTime = 0;
  
  constructor() {
    // Initialize all sprites on startup for improved performance
    this.initializeSprites();
  }
  
  /**
   * Initialize all game sprites
   */
  private initializeSprites(): void {
    // Create player sprite frames
    this.createPlayerSprites();
    
    // Create obstacle sprite frames
    this.createObstacleSprites();
    
    // Create effect sprites
    this.createEffectSprites();
  }
  
  /**
   * Create player character sprites with multiple animation frames
   */
  private createPlayerSprites(): void {
    // Create sprite sheet with 4 frames of animation
    const frames: HTMLImageElement[] = [];
    
    // Generate all animation frames
    for (let i = 0; i < 4; i++) {
      frames.push(this.createPlayerFrame(i));
    }
    
    // Store in sprite sheets
    this.spriteSheets.player = frames;
  }
  
  /**
   * Create a single player animation frame
   * @param frameIndex - The index of the animation frame
   * @returns The frame image
   */
  private createPlayerFrame(frameIndex: number): HTMLImageElement {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    
    // Base shape - white rounded square with improved performance
    ctx.fillStyle = 'white';
    ctx.beginPath();
    // Use modern roundRect method or fallback to custom implementation
    if (ctx.roundRect) {
      ctx.roundRect(0, 0, 32, 32, 8);
    } else {
      // Fallback for browsers without roundRect
      this.drawRoundedRect(ctx, 0, 0, 32, 32, 8);
    }
    ctx.fill();
    
    // Eye positions change slightly based on frame for "blinking" effect
    const eyePositionY = frameIndex === 2 ? 10 : 8;
    const eyeSize = frameIndex === 2 ? 3 : 4;
    
    // Add eyes
    ctx.fillStyle = '#6690cc';
    ctx.beginPath();
    ctx.arc(10, eyePositionY, eyeSize, 0, Math.PI * 2);
    ctx.arc(22, eyePositionY, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Pupils
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(10, eyePositionY, eyeSize/2, 0, Math.PI * 2);
    ctx.arc(22, eyePositionY, eyeSize/2, 0, Math.PI * 2);
    ctx.fill();
    
    // Mouth changes based on frame
    ctx.fillStyle = '#333';
    
    if (frameIndex === 1 || frameIndex === 3) {
      // Slight smile
      ctx.beginPath();
      ctx.arc(16, 22, 8, 0.1, Math.PI - 0.1, false);
      ctx.stroke();
    } else if (frameIndex === 0) {
      // Neutral
      ctx.fillRect(10, 22, 12, 2);
    } else {
      // Open mouth
      ctx.beginPath();
      ctx.arc(16, 22, 5, 0, Math.PI, false);
      ctx.fill();
    }
    
    // Highlight effect that moves across frames
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    const highlightX = (frameIndex * 8) % 24;
    ctx.beginPath();
    ctx.arc(highlightX + 4, 4, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Convert to image - handle asynchronous loading
    const image = new Image();
    // Create fallback image in case of loading issues
    const fallbackImage = this.createFallbackImage(canvas.width, canvas.height, 'white');
    
    try {
      // Use modern async/await pattern but don't block initialization
      image.src = canvas.toDataURL('image/png');
      return image;
    } catch (e) {
      console.error('Error creating player sprite:', e);
      return fallbackImage;
    }
  }
  
  /**
   * Create obstacle sprites with multiple variants
   */
  private createObstacleSprites(): void {
    // Create several obstacle variants
    const variants: HTMLImageElement[] = [];
    
    // Create different obstacle types (more visually distinct)
    for (let i = 0; i < 3; i++) {
      variants.push(this.createObstacleVariant(i));
    }
    
    this.spriteSheets.obstacle = variants;
  }
  
  /**
   * Create a single obstacle variant
   * @param variantIndex - The variant index (0-2)
   * @returns The obstacle image
   */
  private createObstacleVariant(variantIndex: number): HTMLImageElement {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    
    // Different color gradients for each variant - improved contrast
    let startColor: string, endColor: string, patternColor: string;
    
    switch (variantIndex) {
      case 0: // Cyan obstacle
        startColor = '#1FF2F2';
        endColor = '#0CC7C7';
        patternColor = '#0FF0F0';
        break;
      case 1: // Purple obstacle
        startColor = '#9D65FF';
        endColor = '#7A4FCC';
        patternColor = '#8A5AE0';
        break;
      case 2: // Orange obstacle
        startColor = '#FF9F45';
        endColor = '#E07D20';
        patternColor = '#FFB86C';
        break;
      default:
        // Fallback colors
        startColor = '#1FF2F2';
        endColor = '#0CC7C7';
        patternColor = '#0FF0F0';
    }
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 64, 32);
    gradient.addColorStop(0, startColor);
    gradient.addColorStop(1, endColor);
    
    ctx.fillStyle = gradient;
    
    // Different shapes for each variant
    if (variantIndex === 0) {
      // Rectangle with rounded corners
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(0, 0, 64, 32, 6);
      } else {
        // Fallback for browsers without roundRect
        this.drawRoundedRect(ctx, 0, 0, 64, 32, 6);
      }
      ctx.fill();
    } else if (variantIndex === 1) {
      // Diamond-like shape
      ctx.beginPath();
      ctx.moveTo(32, 0);
      ctx.lineTo(64, 16);
      ctx.lineTo(32, 32);
      ctx.lineTo(0, 16);
      ctx.closePath();
      ctx.fill();
    } else {
      // Pill shape
      ctx.beginPath();
      ctx.arc(16, 16, 16, Math.PI/2, Math.PI*3/2);
      ctx.arc(48, 16, 16, Math.PI*3/2, Math.PI/2);
      ctx.closePath();
      ctx.fill();
    }
    
    // Add pattern details
    ctx.fillStyle = patternColor;
    
    // Different patterns for each variant
    if (variantIndex === 0) {
      // Horizontal lines
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(8, 8 + (i * 8), 48, 3);
      }
    } else if (variantIndex === 1) {
      // Circle pattern
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(32, 16, 12 - (i * 4), 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // Dots pattern
      for (let x = 0; x < 4; x++) {
        for (let y = 0; y < 2; y++) {
          ctx.beginPath();
          ctx.arc(10 + (x * 15), 10 + (y * 12), 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    
    // Add border/glow effect
    ctx.strokeStyle = startColor;
    ctx.lineWidth = 2;
    
    if (variantIndex === 0) {
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(2, 2, 60, 28, 5);
      } else {
        // Fallback for browsers without roundRect
        this.drawRoundedRect(ctx, 2, 2, 60, 28, 5);
      }
      ctx.stroke();
    } else if (variantIndex === 1) {
      ctx.beginPath();
      ctx.moveTo(32, 2);
      ctx.lineTo(62, 16);
      ctx.lineTo(32, 30);
      ctx.lineTo(2, 16);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(16, 16, 14, Math.PI/2, Math.PI*3/2);
      ctx.arc(48, 16, 14, Math.PI*3/2, Math.PI/2);
      ctx.closePath();
      ctx.stroke();
    }
    
    // Convert to image using modern approach
    const image = new Image();
    image.src = canvas.toDataURL('image/png');
    return image;
  }
  
  /**
   * Create effect sprites (explosions, particles, etc.)
   */
  private createEffectSprites(): void {
    // Create sprite sheet with explosion effect frames
    const explosionFrames: HTMLImageElement[] = [];
    
    // Create frames of explosion animation
    for (let i = 0; i < 5; i++) {
      explosionFrames.push(this.createExplosionFrame(i));
    }
    
    this.spriteSheets.explosion = explosionFrames;
  }
  
  /**
   * Create a single explosion animation frame
   * @param frameIndex - The index of the animation frame (0-4)
   * @returns The explosion frame image
   */
  private createExplosionFrame(frameIndex: number): HTMLImageElement {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    
    // Size increases with frame index
    const size = 10 + (frameIndex * 10);
    
    // Color changes with frame
    const opacity = 1 - (frameIndex * 0.2);
    
    // Inner explosion
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, size);
    gradient.addColorStop(0, `rgba(255, 255, 150, ${opacity})`);
    gradient.addColorStop(0.5, `rgba(255, 100, 50, ${opacity})`);
    gradient.addColorStop(1, `rgba(150, 50, 0, 0)`);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(32, 32, size, 0, Math.PI * 2);
    ctx.fill();
    
    // Explosion particles
    const particles = 5 + (frameIndex * 3);
    const particleSize = 3 - (frameIndex * 0.4);
    
    ctx.fillStyle = `rgba(255, 220, 50, ${opacity})`;
    
    for (let i = 0; i < particles; i++) {
      const angle = (i / particles) * Math.PI * 2;
      const distance = size * 0.8;
      const x = 32 + Math.cos(angle) * distance;
      const y = 32 + Math.sin(angle) * distance;
      
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.5, particleSize), 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Convert to image
    const image = new Image();
    image.src = canvas.toDataURL('image/png');
    return image;
  }
  
  /**
   * Helper function to draw rounded rectangles for browsers without roundRect
   */
  private drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
  }
  
  /**
   * Create a simple colored rectangle as fallback
   */
  private createFallbackImage(width: number, height: number, color: string): HTMLImageElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
    
    const image = new Image();
    try {
      image.src = canvas.toDataURL('image/png');
    } catch (e) {
      console.error('Error creating fallback image:', e);
    }
    return image;
  }
  
  /**
   * Get the current animation frame for a sprite
   * @param type - The type of sprite ('player', 'obstacle', etc.)
   * @param variantIndex - Optional variant index for obstacles
   * @param timestamp - Current timestamp for animation
   * @returns The sprite frame to display
   */
  getAnimationFrame(type: string, variantIndex: number = 0, timestamp: number = 0): HTMLImageElement {
    try {
      // Update animation frame if enough time has passed
      if (timestamp - this.lastFrameTime > ANIMATION_SPEED) {
        this.currentFrame = (this.currentFrame + 1) % 4;
        this.lastFrameTime = timestamp;
      }
      
      // Return the appropriate sprite frame
      switch (type) {
        case 'player':
          if (!this.spriteSheets.player || !this.spriteSheets.player[this.currentFrame]) {
            // If sprite isn't available yet, create a fallback
            return this.createFallbackImage(32, 32, 'white');
          }
          return this.spriteSheets.player[this.currentFrame];
        
        case 'obstacle':
          // For obstacles, use the variant index to determine which obstacle type to show
          if (!this.spriteSheets.obstacle || 
              !this.spriteSheets.obstacle[variantIndex % this.spriteSheets.obstacle.length]) {
            // If sprite isn't available yet, create a fallback
            return this.createFallbackImage(64, 32, '#1FF2F2');
          }
          return this.spriteSheets.obstacle[variantIndex % this.spriteSheets.obstacle.length];
        
        case 'explosion':
          // For explosions, frame is directly provided as explosion progresses
          if (!this.spriteSheets.explosion || 
              !this.spriteSheets.explosion[Math.min(variantIndex, 4)]) {
            // If sprite isn't available yet, create a fallback
            return this.createFallbackImage(64, 64, 'orange');
          }
          return this.spriteSheets.explosion[Math.min(variantIndex, 4)];
        
        default:
          console.error('Unknown sprite type:', type);
          return this.createFallbackImage(32, 32, 'gray');
      }
    } catch (e) {
      console.error('Error in getAnimationFrame:', e);
      return this.createFallbackImage(32, 32, 'red');
    }
  }
}

// Create a singleton instance
const spriteManagerInstance = new SpriteManager();

/**
 * Get a sprite frame from the sprite manager
 * @param type - The type of sprite ('player', 'obstacle', etc.)
 * @param variantOrTime - Variant index for obstacles or frame index for effects
 * @param timestamp - Current timestamp for animation
 * @returns The sprite frame to display
 */
export function getSprite(type: string, variantOrTime: number = 0, timestamp: number = 0): HTMLImageElement {
  return spriteManagerInstance.getAnimationFrame(type, variantOrTime, timestamp);
}
