// ==UserScript==
// @name         Seb Marble
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Adds dark mode toggle with canvas background control (for now)
// @author       princekyleaedam
// @match        https://themilliondollardrawing.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // ============================================
    // CONFIGURATION
    // ============================================
    const STORAGE_KEY = 'sebplace_dark_mode';
    const DEFAULT_ENABLED = false;

    // ============================================
    // STATE MANAGEMENT
    // ============================================
    let isDarkMode = GM_getValue(STORAGE_KEY, DEFAULT_ENABLED);
    let isExpanded = false; // Start collapsed
    let canvasPatched = false;
    let observer = null;
    let originalFillRect = null;
    let canvasCtx = null;

    // ============================================
    // CSS STYLES
    // ============================================
    GM_addStyle(`
        /* Widget Container - Collapsed by default */
        #sebplace-darkmode-widget {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 99999;
            font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            user-select: none;
        }

        /* Moon Icon Button (always visible) */
        #sebplace-toggle-btn {
            width: 46px;
            height: 46px;
            border-radius: 50%;
            background: rgba(30, 30, 35, 0.92);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.12);
            color: #ffffff;
            font-size: 22px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
            transition: all 0.3s ease;
            padding: 0;
            line-height: 1;
            position: relative;
        }

        #sebplace-toggle-btn:hover {
            transform: scale(1.08);
            background: rgba(40, 40, 48, 0.95);
            border-color: rgba(255, 255, 255, 0.2);
            box-shadow: 0 6px 30px rgba(0, 0, 0, 0.5);
        }

        #sebplace-toggle-btn:active {
            transform: scale(0.92);
        }

        /* Active state indicator dot */
        #sebplace-toggle-btn .active-dot {
            position: absolute;
            bottom: 4px;
            right: 4px;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            border: 2px solid rgba(30, 30, 35, 0.92);
            transition: all 0.3s ease;
        }

        #sebplace-toggle-btn .active-dot.on {
            background: #34C759;
            box-shadow: 0 0 12px rgba(52, 199, 89, 0.5);
        }

        #sebplace-toggle-btn .active-dot.off {
            background: #666;
        }

        /* Expanded Widget Panel */
        #sebplace-darkmode-panel {
            position: absolute;
            top: calc(100% + 12px);
            right: 0;
            background: rgba(30, 30, 35, 0.95);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 16px;
            padding: 16px 20px 18px 20px;
            min-width: 220px;
            box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
            transform-origin: top right;
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none;
            opacity: 0;
            transform: scale(0.92) translateY(-8px);
        }

        #sebplace-darkmode-panel.expanded {
            pointer-events: auto;
            opacity: 1;
            transform: scale(1) translateY(0);
        }

        #sebplace-darkmode-panel .widget-title {
            color: #ffffff;
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.02em;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        #sebplace-darkmode-panel .widget-title .icon {
            font-size: 16px;
        }

        #sebplace-darkmode-panel .widget-title .badge {
            background: rgba(0, 122, 255, 0.25);
            color: #4da6ff;
            font-size: 8px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 10px;
            letter-spacing: 0.05em;
            text-transform: uppercase;
        }

        #sebplace-darkmode-panel .toggle-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 6px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        #sebplace-darkmode-panel .toggle-row:last-child {
            border-bottom: none;
        }

        #sebplace-darkmode-panel .toggle-label {
            color: rgba(255, 255, 255, 0.75);
            font-size: 12px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        #sebplace-darkmode-panel .toggle-label .sub {
            color: rgba(255, 255, 255, 0.35);
            font-size: 10px;
            font-weight: 400;
        }

        /* Toggle Switch */
        .seb-toggle {
            position: relative;
            width: 40px;
            height: 22px;
            flex-shrink: 0;
            cursor: pointer;
        }

        .seb-toggle input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .seb-toggle .slider {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.15);
            border-radius: 34px;
            transition: all 0.3s ease;
            cursor: pointer;
        }

        .seb-toggle .slider::before {
            content: "";
            position: absolute;
            height: 16px;
            width: 16px;
            left: 3px;
            bottom: 3px;
            background: #ffffff;
            border-radius: 50%;
            transition: all 0.3s ease;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .seb-toggle input:checked + .slider {
            background: #007AFF;
        }

        .seb-toggle input:checked + .slider::before {
            transform: translateX(18px);
        }

        .seb-toggle .slider:hover {
            opacity: 0.85;
        }

        /* Dark Mode Page Styles */
        body.sebplace-dark-mode {
            background: #0a0a0a !important;
            color: #e0e0e0 !important;
        }

        body.sebplace-dark-mode .bg-white {
            background: #16161a !important;
        }

        body.sebplace-dark-mode .bg-\\[\\#F4F4F5\\] {
            background: #121215 !important;
        }

        body.sebplace-dark-mode .bg-\\[\\#FAFAFA\\] {
            background: #0d0d0f !important;
        }

        body.sebplace-dark-mode .bg-\\[\\#F8F8FA\\] {
            background: #18181c !important;
        }

        body.sebplace-dark-mode .bg-\\[\\#f4f5f7\\] {
            background: #0a0a0c !important;
        }

        body.sebplace-dark-mode .border-\\[\\#E1E1E5\\] {
            border-color: #2a2a30 !important;
        }

        body.sebplace-dark-mode .border-\\[\\#EBEBEF\\] {
            border-color: #2a2a30 !important;
        }

        body.sebplace-dark-mode .border-\\[\\#F0F0F2\\] {
            border-color: #2a2a30 !important;
        }

        body.sebplace-dark-mode .border-gray-200 {
            border-color: #2a2a30 !important;
        }

        body.sebplace-dark-mode .text-\\[\\#111111\\] {
            color: #e8e8e8 !important;
        }

        body.sebplace-dark-mode .text-\\[\\#71717A\\] {
            color: #88889a !important;
        }

        body.sebplace-dark-mode .text-\\[\\#52525B\\] {
            color: #77778a !important;
        }

        body.sebplace-dark-mode .text-gray-600 {
            color: #9999aa !important;
        }

        body.sebplace-dark-mode .text-gray-500 {
            color: #88889a !important;
        }

        body.sebplace-dark-mode .text-slate-500 {
            color: #88889a !important;
        }

        body.sebplace-dark-mode .text-slate-600 {
            color: #9999aa !important;
        }

        body.sebplace-dark-mode .text-slate-700 {
            color: #aaaabc !important;
        }

        body.sebplace-dark-mode .bg-slate-50 {
            background: #16161a !important;
        }

        body.sebplace-dark-mode .bg-slate-100 {
            background: #1a1a1e !important;
        }

        body.sebplace-dark-mode .bg-slate-200 {
            background: #222228 !important;
        }

        body.sebplace-dark-mode .hover\\:bg-slate-100:hover {
            background: #1a1a1e !important;
        }

        body.sebplace-dark-mode .hover\\:bg-slate-50:hover {
            background: #16161a !important;
        }

        body.sebplace-dark-mode .hover\\:bg-\\[\\#F4F4F5\\]:hover {
            background: #1a1a1e !important;
        }

        body.sebplace-dark-mode .shadow-sm {
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5) !important;
        }

        body.sebplace-dark-mode .shadow-md {
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.5) !important;
        }

        body.sebplace-dark-mode .shadow-lg {
            box-shadow: 0 10px 15px rgba(0, 0, 0, 0.5) !important;
        }

        body.sebplace-dark-mode .shadow-xl {
            box-shadow: 0 20px 25px rgba(0, 0, 0, 0.5) !important;
        }

        body.sebplace-dark-mode .shadow-2xl {
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.6) !important;
        }

        body.sebplace-dark-mode .bg-white\\/90 {
            background: rgba(22, 22, 26, 0.95) !important;
        }

        body.sebplace-dark-mode .bg-white\\/95 {
            background: rgba(22, 22, 26, 0.97) !important;
        }

        body.sebplace-dark-mode .bg-white\\/80 {
            background: rgba(22, 22, 26, 0.85) !important;
        }

        body.sebplace-dark-mode .backdrop-blur-md {
            backdrop-filter: blur(12px) !important;
        }

        body.sebplace-dark-mode .backdrop-blur-sm {
            backdrop-filter: blur(8px) !important;
        }

        body.sebplace-dark-mode .divide-\\[\\#E1E1E5\\] > :not(:last-child) {
            border-color: #2a2a30 !important;
        }

        /* Input fields in dark mode */
        body.sebplace-dark-mode input,
        body.sebplace-dark-mode textarea,
        body.sebplace-dark-mode select {
            background: #1a1a1e !important;
            border-color: #2a2a30 !important;
            color: #e0e0e0 !important;
        }

        body.sebplace-dark-mode input:focus,
        body.sebplace-dark-mode textarea:focus {
            border-color: #007AFF !important;
        }

        /* Scrollbar */
        body.sebplace-dark-mode ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }

        body.sebplace-dark-mode ::-webkit-scrollbar-track {
            background: #0a0a0c;
        }

        body.sebplace-dark-mode ::-webkit-scrollbar-thumb {
            background: #2a2a30;
            border-radius: 4px;
        }

        body.sebplace-dark-mode ::-webkit-scrollbar-thumb:hover {
            background: #3a3a40;
        }

        /* Animation for collapse */
        @keyframes sebFadeIn {
            from {
                opacity: 0;
                transform: scale(0.92) translateY(-8px);
            }
            to {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
        }

        @keyframes sebFadeOut {
            from {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
            to {
                opacity: 0;
                transform: scale(0.92) translateY(-8px);
            }
        }
    `);

    // ============================================
    // CANVAS PATCHING
    // ============================================
    function patchCanvasForDarkMode() {
        const canvas = document.querySelector('canvas[style*="image-rendering: pixelated"]');
        if (!canvas) {
            console.log('[Sebplace] Canvas not found, will retry...');
            return false;
        }

        try {
            const ctx = canvas.getContext('2d');
            if (!ctx) return false;

            if (!originalFillRect) {
                originalFillRect = ctx.fillRect;
            }

            canvasCtx = ctx;

            ctx.fillRect = function(x, y, w, h) {
                const currentColor = this.fillStyle;

                if (isDarkMode && w > 100 && h > 100 &&
                    (currentColor === '#f3efef' ||
                     currentColor === '#F3EFEF' ||
                     currentColor === '#FFFFFF' ||
                     currentColor === '#ffffff')) {

                    this.fillStyle = '#111111';
                    originalFillRect.call(this, x, y, w, h);
                    this.fillStyle = currentColor;
                    return;
                }

                if (isDarkMode && (currentColor === '#FFFFFF' || currentColor === '#ffffff')) {
                    if (w > 10 && h > 10) {
                        this.fillStyle = '#1a1a1a';
                        originalFillRect.call(this, x, y, w, h);
                        this.fillStyle = currentColor;
                        return;
                    }
                }

                originalFillRect.call(this, x, y, w, h);
            };

            canvasPatched = true;
            console.log('[Sebplace] Canvas patched successfully!');

            canvas.style.opacity = '0.99';
            setTimeout(() => { canvas.style.opacity = '1'; }, 50);

            return true;
        } catch (e) {
            console.error('[Sebplace] Failed to patch canvas:', e);
            return false;
        }
    }

    function unpatchCanvas() {
        if (canvasCtx && originalFillRect) {
            canvasCtx.fillRect = originalFillRect;
            canvasPatched = false;
            console.log('[Sebplace] Canvas unpatched');

            const canvas = document.querySelector('canvas[style*="image-rendering: pixelated"]');
            if (canvas) {
                canvas.style.opacity = '0.99';
                setTimeout(() => { canvas.style.opacity = '1'; }, 50);
            }
        }
    }

    // ============================================
    // DARK MODE TOGGLE
    // ============================================
    function toggleDarkMode() {
        isDarkMode = !isDarkMode;
        GM_setValue(STORAGE_KEY, isDarkMode);
        applyDarkMode();
        updateToggleButton();
    }

    function applyDarkMode() {
        if (isDarkMode) {
            document.body.classList.add('sebplace-dark-mode');
        } else {
            document.body.classList.remove('sebplace-dark-mode');
        }

        if (isDarkMode) {
            if (!canvasPatched) {
                patchCanvasForDarkMode();
                if (!canvasPatched) {
                    setTimeout(patchCanvasForDarkMode, 1000);
                    setTimeout(patchCanvasForDarkMode, 3000);
                }
            }
        } else {
            unpatchCanvas();
        }

        const toggleInput = document.querySelector('#sebplace-darkmode-toggle');
        if (toggleInput) {
            toggleInput.checked = isDarkMode;
        }

        updateToggleButton();
        console.log(`[Sebplace] Dark mode ${isDarkMode ? 'enabled' : 'disabled'}`);
    }

    function updateToggleButton() {
        const btn = document.querySelector('#sebplace-toggle-btn');
        const dot = btn?.querySelector('.active-dot');
        if (btn) {
            btn.innerHTML = `
                ${isDarkMode ? '🌙' : '☀️'}
                <span class="active-dot ${isDarkMode ? 'on' : 'off'}"></span>
            `;
        }
    }

    // ============================================
    // WIDGET CREATION
    // ============================================
    function togglePanel() {
        isExpanded = !isExpanded;
        const panel = document.querySelector('#sebplace-darkmode-panel');
        if (panel) {
            if (isExpanded) {
                panel.classList.add('expanded');
            } else {
                panel.classList.remove('expanded');
            }
        }
    }

    function createWidget() {
        if (document.querySelector('#sebplace-darkmode-widget')) return;

        const widget = document.createElement('div');
        widget.id = 'sebplace-darkmode-widget';
        widget.innerHTML = `
            <!-- Moon Icon Button -->
            <button id="sebplace-toggle-btn" aria-label="Toggle dark mode panel">
                ${isDarkMode ? '🌙' : '☀️'}
                <span class="active-dot ${isDarkMode ? 'on' : 'off'}"></span>
            </button>

            <!-- Expanded Panel -->
            <div id="sebplace-darkmode-panel">
                <div class="widget-title">
                    <span class="icon">🌙</span>
                    <span>Sebplace Dark Mode</span>
                    <span class="badge">v0.1</span>
                </div>
                <div class="toggle-row">
                    <span class="toggle-label">
                        <span>Dark Canvas</span>
                        <span class="sub">(background)</span>
                    </span>
                    <label class="seb-toggle">
                        <input type="checkbox" id="sebplace-darkmode-toggle" ${isDarkMode ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                <div class="toggle-row" style="margin-top:4px; border-bottom: none;">
                    <span class="toggle-label" style="font-size:10px; color: rgba(255,255,255,0.35);">
                        ⚡ Force dark page • Toggle to apply
                    </span>
                </div>
            </div>
        `;

        document.body.appendChild(widget);

        // Toggle button click
        const toggleBtn = widget.querySelector('#sebplace-toggle-btn');
        toggleBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            togglePanel();
        });

        // Dark mode toggle in panel
        const toggle = widget.querySelector('#sebplace-darkmode-toggle');
        toggle.addEventListener('change', function(e) {
            e.stopPropagation();
            toggleDarkMode();
        });

        // Close panel when clicking outside
        document.addEventListener('click', function(e) {
            if (isExpanded && !widget.contains(e.target)) {
                togglePanel();
            }
        });

        // Prevent clicks inside panel from closing
        const panel = widget.querySelector('#sebplace-darkmode-panel');
        panel.addEventListener('click', function(e) {
            e.stopPropagation();
        });

        console.log('[Sebplace] Widget created');
    }

    // ============================================
    // OBSERVER
    // ============================================
    function setupObserver() {
        if (observer) return;

        observer = new MutationObserver(() => {
            if (isDarkMode && !canvasPatched) {
                const canvas = document.querySelector('canvas[style*="image-rendering: pixelated"]');
                if (canvas) {
                    patchCanvasForDarkMode();
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // ============================================
    // INITIALIZATION
    // ============================================
    function init() {
        console.log('[Sebplace] Initializing dark mode...');

        createWidget();
        setupObserver();

        setTimeout(() => {
            applyDarkMode();
        }, 500);

        setTimeout(() => {
            if (isDarkMode && !canvasPatched) {
                patchCanvasForDarkMode();
            }
        }, 2000);

        setTimeout(() => {
            if (isDarkMode && !canvasPatched) {
                patchCanvasForDarkMode();
            }
        }, 5000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Handle navigation
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            setTimeout(() => {
                if (isDarkMode) {
                    canvasPatched = false;
                    applyDarkMode();
                }
                // Recreate widget if it was removed
                if (!document.querySelector('#sebplace-darkmode-widget')) {
                    createWidget();
                }
            }, 1000);
        }
    }).observe(document, { subtree: true, childList: true });

    // Console controls
    window.sebplaceDarkMode = {
        toggle: toggleDarkMode,
        enable: () => { if (!isDarkMode) toggleDarkMode(); },
        disable: () => { if (isDarkMode) toggleDarkMode(); },
        status: () => isDarkMode,
        patchCanvas: patchCanvasForDarkMode,
        unpatchCanvas: unpatchCanvas,
        togglePanel: togglePanel,
        isExpanded: () => isExpanded
    };

    console.log('[Sebplace] Dark mode ready! Click the moon/sun icon to open the panel.');
})();
