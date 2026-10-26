/**
 * Manages all UI elements and DOM updates, keeping them separate
 * from game logic for better code organization.
 * Now with TypeScript support.
 */

import { formatGems } from '../utils/score';

// Interface for configuration options
interface UIManagerOptions {
  scoreElement: HTMLElement;
  highScoreElement: HTMLElement;
  config: GameConfig;
}

// Interface for the GameConfig used by UIManager
interface GameConfig {
  getKeys: () => Record<string, string[]>;
}

export default class UIManager {
  private scoreElement: HTMLElement;
  private highScoreElement: HTMLElement;
  private config: GameConfig;
  
  // Game over overlay elements (created on-demand)
  private gameOverOverlay: HTMLElement | null;
  
  // Flash overlay for visual effects
  private flashOverlay: HTMLElement | null;
  
  // Loading screen overlay
  private loadingOverlay: HTMLElement | null;
  
  // Original document title
  private originalTitle: string;
  
  /**
   * Creates a new UIManager
   * @param options - Configuration options
   */
  constructor({ scoreElement, highScoreElement, config }: UIManagerOptions) {
    this.scoreElement = scoreElement;
    this.highScoreElement = highScoreElement;
    this.config = config;
    
    // Initialize overlay elements as null (created on-demand)
    this.gameOverOverlay = null;
    this.flashOverlay = null;
    this.loadingOverlay = null;
    
    // Save original title
    this.originalTitle = document.title;
  }
  
  /**
   * Update the score display
   * @param score - Current score to display
   */
  updateScore(score: number): void {
    if (this.scoreElement) {
      this.scoreElement.textContent = formatGems(score);
      this.scoreElement.title = score.toLocaleString('en-US');
      this.scoreElement.setAttribute('aria-label', `${score.toLocaleString('en-US')} gems`);
    }
  }
  
  /**
   * Update the high score display
   * @param highScore - High score to display
   */
  updateHighScore(highScore: number): void {
    if (this.highScoreElement) {
      this.highScoreElement.textContent = formatGems(highScore);
      this.highScoreElement.title = highScore.toLocaleString('en-US');
      this.highScoreElement.setAttribute('aria-label', `${highScore.toLocaleString('en-US')} gems`);
      
      // Also update page title to show achievement
      if (highScore > 0) {
        document.title = `${this.originalTitle} - High Score: ${highScore}`;
      }
    }
  }
  
  /**
   * Show the game over screen
   * @param finalScore - Final score achieved
   * @param highScore - Current high score
   * @param onRestart - Callback function when restart is clicked
   * @param winnerName - Name of winner in multiplayer mode
   * @param isWinner - Whether the local player is the winner
   */
  showGameOver(
    finalScore: number, 
    highScore: number, 
    onRestart: () => void, 
    winnerName?: string, 
    isWinner?: boolean
  ): void {
    // Create overlay if it doesn't exist
    if (!this.gameOverOverlay) {
      this.createGameOverOverlay();
    }
    
    // Update title based on game mode
    const titleElement = this.gameOverOverlay?.querySelector('h2');
    if (titleElement) {
      if (winnerName) {
        // Multiplayer mode
        titleElement.textContent = isWinner ? 'Victory!' : 'Game Over';
      } else {
        // Single player mode
        titleElement.textContent = 'Game Over';
      }
    }
    
    // Update content
    const scoreDisplay = this.gameOverOverlay?.querySelector('.game-over-score');
    if (scoreDisplay) {
      scoreDisplay.textContent = finalScore.toString();
    }
    
    const highScoreDisplay = this.gameOverOverlay?.querySelector('.game-over-highscore');
    if (highScoreDisplay) {
      highScoreDisplay.textContent = highScore.toString();
    }
    
    // Handle multiplayer result
    const multiplayerResultElement = this.gameOverOverlay?.querySelector('.multiplayer-result') as HTMLElement;
    if (multiplayerResultElement) {
      if (winnerName) {
        // Show multiplayer result
        multiplayerResultElement.textContent = isWinner 
          ? 'You were the last one standing!' 
          : `${winnerName} was the last one standing!`;
        multiplayerResultElement.style.display = 'block';
      } else {
        // Hide multiplayer result in single player mode
        multiplayerResultElement.style.display = 'none';
      }
    }
    
    // Set restart button callback
    const restartButton = this.gameOverOverlay?.querySelector('.game-over-restart');
    if (restartButton) {
      // Remove any existing listeners (to prevent duplicates)
      const newButton = restartButton.cloneNode(true) as HTMLElement;
      if (restartButton.parentNode) {
        restartButton.parentNode.replaceChild(newButton, restartButton);
      }
      
      // Add new listener
      newButton.addEventListener('click', () => {
        this.hideGameOver();
        if (onRestart) onRestart();
      });
    }
    
    // Show the overlay
    if (this.gameOverOverlay) {
      this.gameOverOverlay.style.display = 'flex';
    }
    
    // Add event listener for pressing 'R' to restart
    const handleKeyDown = (e: KeyboardEvent) => {
      if (this.config.getKeys().RESTART.includes(e.key)) {
        this.hideGameOver();
        document.removeEventListener('keydown', handleKeyDown);
        if (onRestart) onRestart();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
  }
  
  /**
   * Hide the game over screen
   */
  hideGameOver(): void {
    if (this.gameOverOverlay) {
      this.gameOverOverlay.style.display = 'none';
    }
  }
  
  /**
   * Create the game over overlay elements
   */
  private createGameOverOverlay(): void {
    // Detect touch device
    const isTouchDevice = 'ontouchstart' in window || 
                         navigator.maxTouchPoints > 0 || 
                         window.matchMedia('(pointer: coarse)').matches;

    // Create overlay container
    this.gameOverOverlay = document.createElement('div');
    this.gameOverOverlay.className = 'game-over-overlay';
    
    // Create content - conditionally hide keyboard hint on mobile
    this.gameOverOverlay.innerHTML = `
      <div class="game-over-content">
        <h2>Game Over</h2>
        <div class="game-over-stats">
          <p>Score: <span class="game-over-score">0</span></p>
          <p>High Score: <span class="game-over-highscore">0</span></p>
        </div>
        <p class="multiplayer-result"></p>
        <button class="game-over-restart">Play Again</button>
        ${!isTouchDevice ? '<p class="game-over-hint">Press \'R\' to restart</p>' : ''}
      </div>
    `;
    
    // Add styles with mobile-specific fixes
    const style = document.createElement('style');
    style.textContent = `
      .game-over-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: ${isTouchDevice ? '100dvh' : '100vh'};
        background: rgba(0, 0, 0, 0.7);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        ${isTouchDevice ? 'padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);' : ''}
      }
      
      .game-over-content {
        background: rgba(10, 35, 66, 0.9);
        border: 2px solid var(--primary-color);
        border-radius: 8px;
        padding: 30px;
        text-align: center;
        color: white;
        box-shadow: 0 0 30px var(--primary-glow);
        max-width: 90%;
        width: 400px;
        ${isTouchDevice ? 'max-height: 80dvh; overflow-y: auto;' : ''}
      }
      
      .game-over-content h2 {
        color: var(--primary-color);
        font-size: 36px;
        margin-top: 0;
      }
      
      .game-over-stats {
        margin: 20px 0;
        font-size: 20px;
      }
      
      .game-over-score, .game-over-highscore {
        color: var(--primary-color);
        font-weight: bold;
      }
      
      .multiplayer-result {
        margin: 15px 0;
        font-size: 18px;
        color: #ffcc00;
        font-weight: bold;
        display: none;
      }
      
      .game-over-restart {
        background: var(--accent-primary, #00bcd4);
        color: var(--text-dark, #000);
        border: none;
        padding: ${isTouchDevice ? '16px 32px' : '12px 24px'};
        font-size: ${isTouchDevice ? '20px' : '18px'};
        border-radius: 4px;
        cursor: pointer;
        margin: 20px 0;
        font-weight: bold;
        transition: all 0.2s ease;
        ${isTouchDevice ? 'min-height: 50px; touch-action: manipulation;' : ''}
      }
      
      .game-over-restart:hover {
        transform: scale(1.05);
        box-shadow: 0 0 15px var(--primary-glow);
      }
      
      .game-over-hint {
        color: #aaa;
        font-size: 14px;
        margin-bottom: 0;
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(this.gameOverOverlay);
  }
  
  /**
   * Create a visual flash effect on the screen (e.g., for collisions)
   * @param color - Color of the flash
   * @param duration - Duration of flash in milliseconds
   */
  flashScreen(color: string = '#ff0000', duration: number = 200): void {
    // Create a flash overlay if it doesn't exist
    if (!this.flashOverlay) {
      this.flashOverlay = document.createElement('div');
      this.flashOverlay.className = 'screen-flash';
      this.flashOverlay.style.position = 'fixed';
      this.flashOverlay.style.top = '0';
      this.flashOverlay.style.left = '0';
      this.flashOverlay.style.width = '100%';
      this.flashOverlay.style.height = '100%';
      this.flashOverlay.style.pointerEvents = 'none'; // Don't block clicks
      this.flashOverlay.style.transition = 'opacity 0.1s ease-out';
      this.flashOverlay.style.opacity = '0';
      this.flashOverlay.style.zIndex = '999'; // Below game-over overlay
      document.body.appendChild(this.flashOverlay);
    }
    
    // Set color and fade in
    this.flashOverlay.style.backgroundColor = color;
    this.flashOverlay.style.opacity = '0.5';
    
    // Fade out after duration
    setTimeout(() => {
      if (this.flashOverlay) {
        this.flashOverlay.style.opacity = '0';
      }
    }, duration);
  }
  
  /**
   * Create and show a loading screen
   * @param message - Loading message to display
   */
  showLoading(message: string = 'Loading...'): void {
    if (!this.loadingOverlay) {
      this.loadingOverlay = document.createElement('div');
      this.loadingOverlay.className = 'loading-overlay';
      this.loadingOverlay.innerHTML = `
        <div class="loading-spinner"></div>
        <p class="loading-message">${message}</p>
      `;
      
      const style = document.createElement('style');
      style.textContent = `
        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(10, 26, 47, 0.9);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          z-index: 1001;
        }
        
        .loading-spinner {
          width: 50px;
          height: 50px;
          border: 5px solid rgba(12, 199, 199, 0.3);
          border-top-color: var(--primary-color);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .loading-message {
          margin-top: 20px;
          color: var(--primary-color);
          font-size: 18px;
        }
      `;
      
      document.head.appendChild(style);
      document.body.appendChild(this.loadingOverlay);
    } else {
      // Update message if loading is already showing
      const msgElement = this.loadingOverlay.querySelector('.loading-message');
      if (msgElement) {
        msgElement.textContent = message;
      }
      this.loadingOverlay.style.display = 'flex';
    }
  }
  
  /**
   * Hide the loading screen
   */
  hideLoading(): void {
    if (this.loadingOverlay) {
      this.loadingOverlay.style.display = 'none';
    }
  }
  
  /**
   * Show a notification or error message
   * @param message - Message to display
   * @param isError - Whether this is an error message
   * @param duration - How long to show the message in ms (0 for permanent)
   */
  showNotification(message: string, isError: boolean = false, duration: number = 3000): void {
    // Create notification container if it doesn't exist
    let notificationContainer = document.querySelector('.notification-container');
    if (!notificationContainer) {
      notificationContainer = document.createElement('div');
      notificationContainer.className = 'notification-container';
      
      // Add styles
      const style = document.createElement('style');
      style.textContent = `
        .notification-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 10px;
          max-width: 80%;
        }
        
        .notification {
          padding: 12px 20px;
          border-radius: 4px;
          color: white;
          font-size: 16px;
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
          animation: slide-in 0.3s ease forwards;
          transition: opacity 0.3s ease, transform 0.3s ease;
          opacity: 0;
          transform: translateX(50px);
        }
        
        .notification.show {
          opacity: 1;
          transform: translateX(0);
        }
        
        .notification.info {
          background-color: var(--primary-color);
        }
        
        .notification.error {
          background-color: #ff4747;
        }
        
        @keyframes slide-in {
          from { transform: translateX(50px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(notificationContainer);
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${isError ? 'error' : 'info'}`;
    notification.textContent = message;
    
    // Add to container
    notificationContainer.appendChild(notification);
    
    // Trigger animation (after a short delay for the DOM)
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // Auto-remove after duration (if not permanent)
    if (duration > 0) {
      setTimeout(() => {
        notification.classList.remove('show');
        
        // Remove from DOM after fade out
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }, duration);
    }
  }
  
  /**
   * Show an error message
   * @param message - Error message to display
   * @param duration - How long to show the message in ms
   */
  showError(message: string, duration: number = 5000): void {
    this.showNotification(message, true, duration);
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    // Remove any DOM elements we created
    if (this.gameOverOverlay && this.gameOverOverlay.parentNode) {
      this.gameOverOverlay.parentNode.removeChild(this.gameOverOverlay);
    }
    
    if (this.flashOverlay && this.flashOverlay.parentNode) {
      this.flashOverlay.parentNode.removeChild(this.flashOverlay);
    }
    
    if (this.loadingOverlay && this.loadingOverlay.parentNode) {
      this.loadingOverlay.parentNode.removeChild(this.loadingOverlay);
    }
    
    // Reset title
    document.title = this.originalTitle;
  }
}
