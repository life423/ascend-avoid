/**
 * Main application entry point.
 * Handles initialization, polyfills and responsive behavior.
 */

// Styles imported via index.css

// Import core game components
import Game from './core/Game'
import { DrawerUI } from './ui/DrawerUI'

// Helper function for device detection
function detectDevice() {
    return {
        isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        isMobile: window.innerWidth < 768,
        isTablet: window.innerWidth >= 768 && window.innerWidth < 1200,
        isDesktop: window.innerWidth >= 1200,
        isLandscape: window.innerWidth > window.innerHeight,
    }
}

// Wait for DOM to load
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Ascend Avoid game...')

    // Show initial loading indicator if it exists
    const loader = document.querySelector('.loader')

    // Detect device capabilities for initial setup
    const deviceInfo = detectDevice()
    console.log(
        `Device detected: ${
            deviceInfo.isDesktop
                ? 'Desktop'
                : deviceInfo.isTablet
                ? 'Tablet'
                : 'Mobile'
        }`
    )
    console.log(`Touch support: ${deviceInfo.isTouchDevice ? 'Yes' : 'No'}`)

    // Apply any device-specific initial body classes
    const body = document.body
    if (deviceInfo.isDesktop) {
        body.classList.add('desktop-layout')
    }

    // Canvas management is now handled by ResponsiveManager in Game.ts

    // Initialize drawer UI (always present)
    const drawerUI = new DrawerUI({ onToggleGameMode: toggleGameMode })

    // Initialize the game
    const game = new Game()

    // Store references for debugging and future use
    ;(window as any).game = game
    ;(window as any).drawerUI = drawerUI

    // Everyone starts in the online game (Game.init joins it)
    updateModeButtons(true)

    // Initialize UI controls
    initializeUIControls()

    // Remove loading indicator after initialization
    if (loader) {
        setTimeout(() => {
            ;(loader as HTMLElement).style.opacity = '0'
            setTimeout(() => loader.remove(), 300)
        }, 300)
    }

    console.log('Game initialized successfully')
})


/**
 * Switch between the shared online game and solo practice. Every mode button
 * (desktop sidebar, drawer, mobile menu) calls this; their labels follow the mode.
 */
async function toggleGameMode(): Promise<void> {
    const game = (window as any).game
    if (!game) return
    const next = game.isMultiplayerMode ? 'singlePlayer' : 'multiplayer'
    try {
        await game.switchGameMode(next)
    } catch (err) {
        console.error('Failed to switch game mode:', err)
    }
    updateModeButtons(game.isMultiplayerMode)
}

/** Label the mode buttons with what they'll do next */
function updateModeButtons(isMultiplayer: boolean): void {
    const label = isMultiplayer ? 'Practice solo' : 'Play online'
    document.querySelectorAll<HTMLElement>('.multiplayer-btn-desktop, .multiplayer-btn-mobile').forEach((button) => {
        button.textContent = label
        button.setAttribute('aria-label', label)
        button.title = label
    })
    const drawerLabel = document.querySelector('.multiplayer-menu-btn .button-text')
    if (drawerLabel) drawerLabel.textContent = label
}

/**
 * Initialize UI controls (menu, modals, etc.)
 */
function initializeUIControls() {
    const menuButton = document.querySelector('.float-trigger')
    const menuItems = document.querySelector('.float-options')
    const guideButton = document.querySelector(
        '.guide-btn-mobile'
    )
    const multiplayerToggle = document.querySelector(
        '.multiplayer-btn-mobile'
    )
    const guideSidebarBtn = document.querySelector(
        '.guide-btn-desktop'
    )
    const multiplayerSidebarBtn = document.querySelector(
        '.multiplayer-btn-desktop'
    )
    const instructionsModal = document.querySelector('.modal-panel')
    const closeModalBtn = document.querySelector('.close-modal')

    function closeMenu() {
        if (menuItems) {
            menuItems.classList.add('hidden')
        }
    }

    function openMenu() {
        if (menuItems) {
            menuItems.classList.remove('hidden')
        }
    }

    if (menuButton && menuItems) {
        ;['click', 'touchstart'].forEach(eventType => {
            menuButton.addEventListener(
                eventType,
                function (e) {
                    e.preventDefault()
                    e.stopPropagation()

                    if (menuItems.classList.contains('hidden')) {
                        openMenu()
                    } else {
                        closeMenu()
                    }
                },
                { passive: false }
            )
        })
    }

    function openInstructionsModal() {
        if (instructionsModal) {
            instructionsModal.classList.remove('hidden')
            document.body.classList.add('modal-open')
            closeMenu()
        }
    }

    if (guideButton) {
        guideButton.addEventListener('click', openInstructionsModal)
    }

    if (guideSidebarBtn) {
        guideSidebarBtn.addEventListener(
            'click',
            openInstructionsModal
        )
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function () {
            if (instructionsModal) {
                instructionsModal.classList.add('hidden')
                document.body.classList.remove('modal-open')
            }
        })
    }

    function toggleMultiplayer() {
        toggleGameMode().then(closeMenu)
    }

    if (multiplayerToggle) {
        multiplayerToggle.addEventListener(
            'click',
            toggleMultiplayer
        )
    }

    if (multiplayerSidebarBtn) {
        multiplayerSidebarBtn.addEventListener(
            'click',
            toggleMultiplayer
        )
    }

    document.addEventListener('click', function (e) {
        if (menuItems && !menuItems.classList.contains('hidden')) {
            if (!(e.target as HTMLElement).closest('.float-menu')) {
                closeMenu()
            }
        }
    })

    document.addEventListener(
        'touchstart',
        function (e) {
            if (
                menuItems &&
                !menuItems.classList.contains('hidden')
            ) {
                if (!(e.target as HTMLElement).closest('.float-menu')) {
                    closeMenu()
                }
            }
        },
        { passive: true }
    )

    if (instructionsModal) {
        instructionsModal.addEventListener('click', function (e) {
            if (e.target === instructionsModal) {
                instructionsModal.classList.add('hidden')
                document.body.classList.remove('modal-open')
            }
        })
    }

    document.addEventListener(
        'touchmove',
        function (e) {
            if ((e.target as HTMLElement).closest('.modal-content')) {
                return
            }
            e.preventDefault()
        },
        { passive: false }
    )
}