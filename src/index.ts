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
    const drawerUI = new DrawerUI()

    // Initialize the game
    const game = new Game()

    // Store references for debugging and future use
    ;(window as any).game = game
    ;(window as any).drawerUI = drawerUI

    // Everyone starts in the online game (Game.init joins it)
    setupModeSwitch()

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


type GameModeName = 'singlePlayer' | 'multiplayer'

/**
 * The Solo | Online switch in the header. Online (the default) is the shared game: you
 * play solo until someone else is on the site, then a match starts for everyone.
 * Solo stays offline.
 */
function setupModeSwitch(): void {
    document.querySelectorAll<HTMLButtonElement>('.mode-option').forEach((button) => {
        button.addEventListener('click', () => setGameMode(button.dataset.mode as GameModeName))
    })
    // Game.init joins the online game
    showMode('multiplayer')
}

async function setGameMode(mode: GameModeName): Promise<void> {
    const game = (window as any).game
    if (!game) return
    const current: GameModeName = game.isMultiplayerMode ? 'multiplayer' : 'singlePlayer'
    if (mode === current) return
    showMode(mode)
    try {
        await game.switchGameMode(mode)
    } catch (err) {
        console.error('Failed to switch game mode:', err)
    }
    showMode(game.isMultiplayerMode ? 'multiplayer' : 'singlePlayer')
}

/** Highlight the active side of the switch */
function showMode(mode: GameModeName): void {
    document.querySelectorAll<HTMLButtonElement>('.mode-option').forEach((button) => {
        const active = button.dataset.mode === mode
        button.classList.toggle('active', active)
        button.setAttribute('aria-pressed', String(active))
    })
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
    const guideSidebarBtn = document.querySelector(
        '.guide-btn-desktop'
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