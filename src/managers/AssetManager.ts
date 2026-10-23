/**
 * Manages loading and caching of game assets such as images and audio.
 * Ensures assets are loaded before the game starts and provides robust
 * error handling with retry functionality.
 * Now with TypeScript support.
 */

// Define interfaces for types used within AssetManager
interface AssetManagerOptions {
  timeout?: number;
  maxRetries?: number;
}

interface Asset {
  key: string;
  src: string;
}

interface FailedAsset extends Asset {
  type: 'image' | 'audio';
}

interface LoadResult {
  success: boolean;
  totalAssets: number;
  loadedAssets: number;
  failedAssets?: FailedAsset[];
  error?: Error;
}

export default class AssetManager {
  // Storage for loaded assets
  private images: Record<string, HTMLImageElement>;
  private audio: Record<string, HTMLAudioElement>;
  
  // Promises for tracking loading status
  private loadPromises: Promise<HTMLImageElement | HTMLAudioElement | null>[];
  
  // Load status tracking
  private totalAssets: number;
  private loadedAssets: number;
  private failedAssets: FailedAsset[];
  
  // Sound cache for efficient playback
  private soundCache: Map<string, HTMLAudioElement[]>;
  
  // Configuration
  private timeout: number;
  private maxRetries: number;
  
  /**
   * Creates a new AssetManager
   * @param options - Configuration options
   */
  constructor(options: AssetManagerOptions = {}) {
    // Storage for loaded assets
    this.images = {};
    this.audio = {};
    
    // Promises for tracking loading status
    this.loadPromises = [];
    
    // Load status tracking
    this.totalAssets = 0;
    this.loadedAssets = 0;
    this.failedAssets = [];
    
    // Sound cache for efficient playback
    this.soundCache = new Map();
    
    // Configuration
    this.timeout = options.timeout || 10000; // 10 seconds default timeout
    this.maxRetries = options.maxRetries || 2;
  }
  
  /**
   * Preload an image asset with retry and timeout
   * @param key - Identifier for the image
   * @param src - Path to the image file
   * @param retryCount - Current retry attempt (internal use)
   * @param pathIndex - Current path variant attempt (internal use)
   * @returns A promise that resolves when the image is loaded
   */
  private preloadImage(key: string, src: string, retryCount: number = 0, pathIndex: number = 0): Promise<HTMLImageElement> {
    this.totalAssets++;
    
    // Define alternate paths to try
    const alternativePaths = [
      src,                     // original path
      `/${src}`,               // absolute path
      `../${src}`,             // one level up
      src.replace('src/', ''), // without src prefix
      `../${src.replace('src/', '')}` // one level up without src prefix
    ];
    
    // If we've tried all paths, give up
    if (pathIndex >= alternativePaths.length) {
      console.error(`Failed to load image after trying all path variants: ${src}`);
      this.failedAssets.push({ type: 'image', key, src });
      this.loadedAssets++;
      return Promise.reject(new Error(`Image not found: ${src}`));
    }
    
    // Get the path to try
    const pathToTry = alternativePaths[pathIndex];
    console.log(`Trying to load image: ${pathToTry}`);
    
    return new Promise((resolve) => {
      const img = new Image();
      
      // Set up timeout
      const timeoutId = window.setTimeout(() => {
        console.warn(`Loading image timed out: ${pathToTry}, retrying (${retryCount + 1}/${this.maxRetries})`);
        
        // If we haven't hit max retries, try again
        if (retryCount < this.maxRetries) {
          this.totalAssets--; // Don't count this attempt
          resolve(this.preloadImage(key, src, retryCount + 1, pathIndex));
        } else {
          // Try next path variant
          this.totalAssets--; // Don't count this attempt
          resolve(this.preloadImage(key, src, 0, pathIndex + 1));
        }
      }, this.timeout);
      
      img.onload = () => {
        clearTimeout(timeoutId);
        this.images[key] = img;
        this.loadedAssets++;
        console.log(`Successfully loaded image ${key} from path: ${pathToTry}`);
        resolve(img);
      };
      
      img.onerror = (err) => {
        clearTimeout(timeoutId);
        console.error(`Failed to load image: ${pathToTry}`, err);
        
        // If we haven't hit max retries, try again
        if (retryCount < this.maxRetries) {
          console.warn(`Retrying image load (${retryCount + 1}/${this.maxRetries}): ${pathToTry}`);
          this.totalAssets--; // Don't count this attempt
          resolve(this.preloadImage(key, src, retryCount + 1, pathIndex));
        } else {
          // Try next path variant
          this.totalAssets--; // Don't count this attempt
          resolve(this.preloadImage(key, src, 0, pathIndex + 1));
        }
      };
      
      img.src = pathToTry;
    });
  }
  
  /**
   * Preload an audio asset with retry and timeout
   * @param key - Identifier for the audio
   * @param src - Path to the audio file
   * @param retryCount - Current retry attempt (internal use)
   * @returns A promise that resolves when the audio is loaded
   */
  private preloadAudio(key: string, src: string, retryCount: number = 0): Promise<HTMLAudioElement> {
    this.totalAssets++;
    
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      
      // Set up timeout
      const timeoutId = window.setTimeout(() => {
        console.warn(`Loading audio timed out: ${src}, retrying (${retryCount + 1}/${this.maxRetries})`);
        
        // If we haven't hit max retries, try again
        if (retryCount < this.maxRetries) {
          this.totalAssets--; // Don't count this attempt
          resolve(this.preloadAudio(key, src, retryCount + 1));
        } else {
          console.error(`Failed to load audio after ${this.maxRetries} retries: ${src}`);
          this.failedAssets.push({ type: 'audio', key, src });
          this.loadedAssets++;
          reject(new Error(`Audio load timeout: ${src}`));
        }
      }, this.timeout);
      
      audio.oncanplaythrough = () => {
        clearTimeout(timeoutId);
        this.audio[key] = audio;
        this.loadedAssets++;
        resolve(audio);
      };
      
      audio.onerror = (err) => {
        clearTimeout(timeoutId);
        console.error(`Failed to load audio: ${src}`, err);
        
        // If we haven't hit max retries, try again
        if (retryCount < this.maxRetries) {
          console.warn(`Retrying audio load (${retryCount + 1}/${this.maxRetries}): ${src}`);
          this.totalAssets--; // Don't count this attempt
          resolve(this.preloadAudio(key, src, retryCount + 1));
        } else {
          this.failedAssets.push({ type: 'audio', key, src });
          this.loadedAssets++;
          reject(new Error(`Failed to load audio: ${src}`));
        }
      };
      
      // Safari needs this
      audio.addEventListener('loadeddata', () => {
        clearTimeout(timeoutId);
        this.audio[key] = audio;
        this.loadedAssets++;
        resolve(audio);
      });
      
      audio.src = src;
      audio.load();
    });
  }
  
  /**
   * Load all game assets with improved error handling
   * @param imageAssets - Array of {key, src} objects for images
   * @param audioAssets - Array of {key, src} objects for audio
   * @returns A promise that resolves with loading results including any failures
   */
  loadAssets(imageAssets: Asset[] = [], audioAssets: Asset[] = []): Promise<LoadResult> {
    // Reset loading state
    this.loadPromises = [];
    this.totalAssets = 0;
    this.loadedAssets = 0;
    this.failedAssets = [];
    
    // Keep track of all assets for reporting
    const allAssets = [...imageAssets, ...audioAssets];
    
    // Process each type of asset
    const processAssets = (assets: Asset[], loaderFn: (key: string, src: string) => Promise<any>) => {
      return assets.map(asset => {
        // Create wrapped promise that won't reject (for Promise.all)
        return loaderFn.call(this, asset.key, asset.src)
          .catch(err => {
            // Don't let failures break Promise.all
            console.error(`Failed to load asset: ${asset.key} (${asset.src})`, err);
            return null; // Return null for failed assets
          });
      });
    };
    
    // Queue all asset loading
    const imagePromises = processAssets(imageAssets, this.preloadImage);
    const audioPromises = processAssets(audioAssets, this.preloadAudio);
    
    // Combine all promises
    this.loadPromises = [...imagePromises, ...audioPromises];
    
    // Wait for all assets to load (or fail)
    return Promise.all(this.loadPromises)
      .then(results => {
        // Count loaded vs. failed assets
        const loadedCount = results.filter(r => r !== null).length;
        
        // Report results
        if (loadedCount === allAssets.length) {
          console.log('All assets loaded successfully');
          return { 
            success: true,
            totalAssets: allAssets.length,
            loadedAssets: loadedCount
          };
        } else {
          console.warn(`Loaded ${loadedCount}/${allAssets.length} assets. Some assets failed to load.`);
          return { 
            success: false,
            totalAssets: allAssets.length,
            loadedAssets: loadedCount,
            failedAssets: this.failedAssets
          };
        }
      })
      .catch(err => {
        // This should rarely happen since we catch individual asset failures
        console.error('Unexpected error during asset loading:', err);
        return { 
          success: false, 
          error: err,
          failedAssets: this.failedAssets,
          totalAssets: allAssets.length,
          loadedAssets: this.loadedAssets
        };
      });
  }
  
  /**
   * Get a loaded image
   * @param key - Image identifier
   * @returns The loaded image or null if not found
   */
  getImage(key: string): HTMLImageElement | null {
    return this.images[key] || null;
  }
  
  /**
   * Get a loaded audio
   * @param key - Audio identifier
   * @returns The loaded audio or null if not found
   */
  getAudio(key: string): HTMLAudioElement | null {
    return this.audio[key] || null;
  }
  
  /**
   * Play a sound with efficient caching for rapid playback
   * @param key - Audio identifier
   * @param volume - Volume level (0.0 to 1.0)
   */
  playSound(key: string, volume: number = 1.0): void {
    // Check if sound exists
    if (!this.audio[key]) {
      console.warn(`Sound not found: ${key}`);
      return;
    }
    
    // Try to find an available sound from the cache
    let sound: HTMLAudioElement | null = null;
    
    // Get or create cache for this sound
    if (!this.soundCache.has(key)) {
      this.soundCache.set(key, []);
    }
    
    const cache = this.soundCache.get(key)!;
    
    // Find a sound that's not playing
    for (let i = 0; i < cache.length; i++) {
      if (cache[i].ended || cache[i].paused) {
        sound = cache[i];
        break;
      }
    }
    
    // If no available sound was found, create a new one
    if (!sound) {
      // Clone the original audio
      sound = this.audio[key].cloneNode() as HTMLAudioElement;
      
      // Add to cache (limit cache size)
      if (cache.length < 10) {
        cache.push(sound);
      }
    }
    
    // Set volume and play
    sound.volume = volume;
    
    // Play the sound (with error handling)
    try {
      const playPromise = sound.play();
      
      // Catch play() errors (can happen with autoplay restrictions)
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn(`Error playing sound ${key}:`, error);
        });
      }
    } catch (error) {
      console.warn(`Error playing sound ${key}:`, error);
    }
  }
  
  /**
   * Get the loading progress (0.0 to 1.0)
   * @returns The loading progress
   */
  getLoadProgress(): number {
    if (this.totalAssets === 0) return 1.0;
    return this.loadedAssets / this.totalAssets;
  }
  
  /**
   * Check if all assets are loaded
   * @returns Whether all assets are loaded
   */
  isLoaded(): boolean {
    return this.loadedAssets === this.totalAssets;
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    // Clear all loaded assets
    this.images = {};
    this.audio = {};
    
    // Clear cache
    this.soundCache.forEach(cache => {
      cache.forEach(sound => {
        sound.pause();
        sound.src = '';
      });
    });
    
    this.soundCache.clear();
  }
}
