/**
 * Player class representing the player entity in the game.
 * Updated with TypeScript support and improved collision detection.
 */
import { GAME, PLAYER } from '../../server/constants/gameConstants';
import { getSprite } from '../utils/sprites';
import { SCALE_FACTOR, BASE_CANVAS_WIDTH, BASE_CANVAS_HEIGHT } from '../utils/utils';
import { GameObject, InputState } from '../types';

export default class Player implements GameObject {
  // Canvas and context
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  // Position and dimensions
  x: number;
  y: number;
  width: number;
  height: number;
  private baseWidth: number;
  private baseHeight: number;
  
  // Movement state
  private movementKeys: Record<string, boolean>;
  private canMove: Record<string, boolean>;
  
  // Velocity for collision detection
  vx: number = 0;
  vy: number = 0;
  
  // Properties for improved winning line collision detection
  lastY: number = 0;  // Previous Y position for swept collision detection
  hasScored: boolean = false;  // Flag to prevent multiple scoring
  
  /**
   * Creates a new Player instance
   * @param canvas - The game canvas
   */
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    
    // Base size that will be scaled
    this.baseWidth = PLAYER.BASE_WIDTH;
    this.baseHeight = PLAYER.BASE_HEIGHT;
    
    // Actual size after scaling
    this.width = this.baseWidth * SCALE_FACTOR;
    this.height = this.baseHeight * SCALE_FACTOR;
    
    // Initialize position properties - will be set in resetPosition
    this.x = 0;
    this.y = 0;
    this.lastY = 0;  // Initialize previous position tracking
    this.hasScored = false;  // Initialize scoring flag
    
    // Set initial position
    this.resetPosition();
    
    // Movement state
    this.movementKeys = {
      up: false,
      down: false,
      left: false,
      right: false
    };
    
    // Movement cooldown flags to prevent continuous movement
    this.canMove = {
      up: true,
      down: true,
      left: true,
      right: true
    };
  }
  
  /**
   * Reset player to starting position at the bottom center of the screen
   */
  resetPosition(): void {
    // Use same dimension calculation as move() method
    const playerSize = Math.max(
      this.baseWidth * SCALE_FACTOR,
      15
    );
    this.width = playerSize;
    this.height = playerSize;
    
    // Position player at the bottom center with proper boundary clamping
    this.x = this.canvas.width / 2 - this.width / 2;
    this.y = this.canvas.height - this.height - (10 * SCALE_FACTOR);
    
    // Ensure position is within bounds
    this.x = Math.max(0, Math.min(this.x, this.canvas.width - this.width));
    this.y = Math.max(0, Math.min(this.y, this.canvas.height - this.height));
    
    // CRITICAL: Reset collision detection properties
    this.lastY = this.y;  // Set lastY to current position
    this.hasScored = false;  // Reset scoring flag so player can score again
  }
  
  /**
   * Draw the player on the canvas
   * @param timestamp - Current timestamp for animation
   */
  draw(timestamp: number = 0): void {
    // Get and draw animated player sprite with current timestamp for animation
    const playerSprite = getSprite('player', 0, timestamp);
    this.ctx.drawImage(playerSprite, this.x, this.y, this.width, this.height);
  }
  
  /**
   * Set a movement key state
   * @param key - The key to set ('up', 'down', 'left', 'right')
   * @param value - The value to set
   */
  setMovementKey(key: string, value: boolean): void {
    if (key in this.movementKeys) {
      this.movementKeys[key] = value;
    }
  }
  
  /**
   * Update player movement state
   * @param inputState - Current input state
   */
  updateFromInputState(inputState: InputState): void {
    this.setMovementKey('up', inputState.up);
    this.setMovementKey('down', inputState.down);
    this.setMovementKey('left', inputState.left);
    this.setMovementKey('right', inputState.right);
  }
  
  /**
   * Move the player based on current input state
   */
  move(): void {
    // IMPORTANT: Store previous position BEFORE any movement
    this.lastY = this.y;
    
    // Update dimensions first - before any movement calculations
    const playerSize = Math.max(
      this.baseWidth * SCALE_FACTOR,
      15
    );
    this.width = playerSize;
    this.height = playerSize;
    
    // Calculate movement step size based on scale factor
    const baseStepX = BASE_CANVAS_WIDTH * 0.07;
    const baseStepY = BASE_CANVAS_HEIGHT * 0.07;
    
    // Scale the movement speed
    const moveX = Math.max(baseStepX * SCALE_FACTOR, PLAYER.MIN_STEP * SCALE_FACTOR);
    const moveY = Math.max(baseStepY * SCALE_FACTOR, PLAYER.MIN_STEP * SCALE_FACTOR);
    
    // Calculate scaled winning line position
    const scaledWinningLine = GAME.WINNING_LINE * (this.canvas.height / BASE_CANVAS_HEIGHT);
    
    // Store previous position for velocity calculation (currently unused but may be needed for collision detection)
    // const prevX = this.x;
    // const prevY = this.y;
    
    // Reset velocity
    this.vx = 0;
    this.vy = 0;
    
    // Move up - Allow player to reach the winning line
    if (this.movementKeys.up && this.canMove.up && this.y > scaledWinningLine - (this.height / 2)) {
      this.y -= moveY;
      this.vy = -moveY;
      this.canMove.up = false;
    }
    if (!this.movementKeys.up) {
      this.canMove.up = true;
    }
    
    // Move down
    if (this.movementKeys.down && this.canMove.down && this.y + this.height <= this.canvas.height - (10 * SCALE_FACTOR)) {
      this.y += moveY;
      this.vy = moveY;
      this.canMove.down = false;
    }
    if (!this.movementKeys.down) {
      this.canMove.down = true;
    }
    
    // Move right
    if (this.movementKeys.right && this.canMove.right && this.x < this.canvas.width - this.width - (5 * SCALE_FACTOR)) {
      this.x += moveX;
      this.vx = moveX;
      this.canMove.right = false;
    }
    if (!this.movementKeys.right) {
      this.canMove.right = true;
    }
    
    // Move left
    if (this.movementKeys.left && this.canMove.left && this.x > (5 * SCALE_FACTOR)) {
      this.x -= moveX;
      this.vx = -moveX;
      this.canMove.left = false;
    }
    if (!this.movementKeys.left) {
      this.canMove.left = true;
    }
    
    // Clamp player position to stay fully within canvas bounds
    this.x = Math.max(0, Math.min(this.x, this.canvas.width - this.width));
    this.y = Math.max(scaledWinningLine, Math.min(this.y, this.canvas.height - this.height));
  }
  
  /**
   * Render the player - alias for draw to fit GameObject interface
   * @param ctx - Canvas rendering context
   * @param timestamp - Current animation timestamp
   */
  render(_ctx: CanvasRenderingContext2D, timestamp?: number): void {
    this.draw(timestamp);
  }
  
  /**
   * Update the player - alias for move to fit GameObject interface
   * @param deltaTime - Time elapsed since last frame
   */
  update(_deltaTime: number): void {
    this.move();
  }
}
