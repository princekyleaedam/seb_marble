// ==UserScript==
// @name         Seb Marble
// @namespace    https://github.com/princekyleaedam/seb_marble
// @version      0.1.1
// @description  Adds quality of life improvements to sebplace
// @author       princekyleaedam
// @match        https://themilliondollardrawing.com/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/princekyleaedam/seb_marble/main/seb_marble_user.js
// @downloadURL  https://raw.githubusercontent.com/princekyleaedam/seb_marble/main/seb_marble_user.js
// @homepageURL  https://github.com/princekyleaedam/seb_marble
// @supportURL   https://github.com/princekyleaedam/seb_marble/issues
// ==/UserScript==

(function() {
    'use strict';

    // ============================================
    // CONFIGURATION
    // ============================================
    const STORAGE_KEY = 'sebplace_dark_mode';
    const DEFAULT_ENABLED = false;
    const TOTAL_PIXELS = 1000000;
    const API_URL = 'https://api.themilliondollardrawing.com/ticker';
    const UPDATE_INTERVAL = 60000; // 1 minute

    // ============================================
    // STATE MANAGEMENT
    // ============================================
    let isDarkMode = GM_getValue(STORAGE_KEY, DEFAULT_ENABLED);
    let canvasPatched = false;
    let observer = null;
    let originalFillRect = null;
    let canvasCtx = null;
    let aboutPopupOpen = false;
    let pixelCount = 0;
    let updateTimer = null;

    // ============================================
    // CSS STYLES
    // ============================================
    GM_addStyle(`
        /* Canvas Stats Section */
        .sebplace-stats-section {
            padding: 12px 16px 10px 16px;
            border-bottom: 1px solid rgba(225, 225, 229, 0.15);
            transition: all 0.3s ease;
        }

        .sebplace-stats-section .stats-label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            font-weight: 500;
            color: rgba(0, 0, 0, 0.6);
            margin-bottom: 4px;
        }

        body.sebplace-dark-mode .sebplace-stats-section .stats-label {
            color: rgba(255, 255, 255, 0.6);
        }

        .sebplace-stats-section .stats-label .icon {
            font-size: 14px;
        }

        .sebplace-stats-section .stats-numbers {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 13px;
            font-weight: 600;
            color: rgba(0, 0, 0, 0.85);
            margin-bottom: 6px;
        }

        body.sebplace-dark-mode .sebplace-stats-section .stats-numbers {
            color: rgba(255, 255, 255, 0.85);
        }

        .sebplace-stats-section .stats-numbers .claimed {
            color: #007AFF;
        }

        .sebplace-stats-section .stats-numbers .total {
            color: rgba(0, 0, 0, 0.35);
        }

        body.sebplace-dark-mode .sebplace-stats-section .stats-numbers .total {
            color: rgba(255, 255, 255, 0.35);
        }

        .sebplace-stats-section .progress-bar-track {
            width: 100%;
            height: 4px;
            background: rgba(0, 0, 0, 0.08);
            border-radius: 4px;
            overflow: hidden;
            position: relative;
        }

        body.sebplace-dark-mode .sebplace-stats-section .progress-bar-track {
            background: rgba(255, 255, 255, 0.08);
        }

        .sebplace-stats-section .progress-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #007AFF, #4DA6FF);
            border-radius: 4px;
            transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
            width: 0%;
            position: relative;
        }

        .sebplace-stats-section .progress-bar-fill::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
            animation: sebShimmer 2s infinite;
        }

        @keyframes sebShimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }

        .sebplace-stats-section .stats-percentage {
            font-size: 10px;
            font-weight: 500;
            color: rgba(0, 0, 0, 0.35);
            text-align: right;
            margin-top: 3px;
        }

        body.sebplace-dark-mode .sebplace-stats-section .stats-percentage {
            color: rgba(255, 255, 255, 0.35);
        }

        /* Sidebar Dark Mode Row */
        .sebplace-darkmode-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 16px;
            border-bottom: 1px solid rgba(225, 225, 229, 0.15);
            transition: all 0.3s ease;
        }

        .sebplace-darkmode-row .sebplace-label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            font-weight: 500;
            color: rgba(0, 0, 0, 0.85);
        }

        body.sebplace-dark-mode .sebplace-darkmode-row .sebplace-label {
            color: rgba(255, 255, 255, 0.85);
        }

        .sebplace-darkmode-row .sebplace-label .icon {
            font-size: 16px;
        }

        .sebplace-darkmode-row .sebplace-label .status-dot {
            display: inline-block;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            margin-left: 4px;
            transition: all 0.3s ease;
        }

        .sebplace-darkmode-row .sebplace-label .status-dot.on {
            background: #34C759;
            box-shadow: 0 0 8px rgba(52, 199, 89, 0.4);
        }

        .sebplace-darkmode-row .sebplace-label .status-dot.off {
            background: #666;
        }

        /* Sidebar Toggle Switch */
        .sebplace-toggle-switch {
            position: relative;
            width: 38px;
            height: 20px;
            flex-shrink: 0;
            cursor: pointer;
        }

        .sebplace-toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .sebplace-toggle-switch .slider {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.15);
            border-radius: 34px;
            transition: all 0.3s ease;
            cursor: pointer;
        }

        body.sebplace-dark-mode .sebplace-toggle-switch .slider {
            background: rgba(255, 255, 255, 0.15);
        }

        .sebplace-toggle-switch .slider::before {
            content: "";
            position: absolute;
            height: 14px;
            width: 14px;
            left: 3px;
            bottom: 3px;
            background: #ffffff;
            border-radius: 50%;
            transition: all 0.3s ease;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .sebplace-toggle-switch input:checked + .slider {
            background: #007AFF;
        }

        .sebplace-toggle-switch input:checked + .slider::before {
            transform: translateX(18px);
        }

        .sebplace-toggle-switch .slider:hover {
            opacity: 0.85;
        }

        /* About Seb Marble Link */
        .sebplace-about-link {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 16px;
            color: rgba(0, 0, 0, 0.5);
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            border-bottom: 1px solid rgba(225, 225, 229, 0.08);
        }

        body.sebplace-dark-mode .sebplace-about-link {
            color: rgba(255, 255, 255, 0.5);
        }

        .sebplace-about-link:hover {
            background: rgba(0, 0, 0, 0.04);
            color: rgba(0, 0, 0, 0.8);
        }

        body.sebplace-dark-mode .sebplace-about-link:hover {
            background: rgba(255, 255, 255, 0.04);
            color: rgba(255, 255, 255, 0.8);
        }

        .sebplace-about-link .icon {
            font-size: 14px;
        }

        .sebplace-about-link .version-tag {
            margin-left: auto;
            font-size: 10px;
            color: rgba(0, 0, 0, 0.2);
        }

        body.sebplace-dark-mode .sebplace-about-link .version-tag {
            color: rgba(255, 255, 255, 0.2);
        }

        /* ============================================
           ABOUT POPUP
           ============================================ */
        #sebplace-about-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 999999;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            display: none;
            align-items: center;
            justify-content: center;
            animation: sebFadeIn 0.2s ease;
        }

        #sebplace-about-overlay.active {
            display: flex;
        }

        #sebplace-about-popup {
            background: rgba(30, 30, 35, 0.96);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 28px 32px 32px 32px;
            max-width: 420px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
            animation: sebPopupIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
        }

        #sebplace-about-popup .popup-icon {
            font-size: 36px;
            text-align: center;
            margin-bottom: 8px;
            display: block;
        }

        #sebplace-about-popup .popup-title {
            color: #ffffff;
            font-size: 18px;
            font-weight: 700;
            text-align: center;
            margin-bottom: 8px;
            letter-spacing: -0.01em;
        }

        #sebplace-about-popup .popup-title .version {
            color: rgba(255, 255, 255, 0.3);
            font-size: 13px;
            font-weight: 500;
        }

        #sebplace-about-popup .popup-divider {
            height: 1px;
            background: rgba(255, 255, 255, 0.06);
            margin: 12px 0 14px 0;
        }

        #sebplace-about-popup .popup-description {
            color: rgba(255, 255, 255, 0.7);
            font-size: 13px;
            line-height: 1.6;
            text-align: center;
            margin-bottom: 6px;
        }

        #sebplace-about-popup .popup-author {
            color: rgba(255, 255, 255, 0.35);
            font-size: 11px;
            text-align: center;
            font-weight: 400;
            margin-top: 4px;
        }

        #sebplace-about-popup .popup-author .heart {
            color: #ff3b30;
        }

        #sebplace-about-popup .popup-close-btn {
            position: absolute;
            top: 12px;
            right: 16px;
            background: none;
            border: none;
            color: rgba(255, 255, 255, 0.3);
            font-size: 20px;
            cursor: pointer;
            transition: all 0.2s ease;
            padding: 4px;
            line-height: 1;
        }

        #sebplace-about-popup .popup-close-btn:hover {
            color: rgba(255, 255, 255, 0.7);
            transform: rotate(90deg);
        }

        @keyframes sebFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes sebPopupIn {
            from {
                opacity: 0;
                transform: scale(0.92) translateY(10px);
            }
            to {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
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
    `);

	// ============================================
	// API FUNCTIONS - UPDATED
	// ============================================
	function fetchTickerData() {
		return new Promise((resolve, reject) => {
			GM_xmlhttpRequest({
				method: 'GET',
				url: API_URL,
				headers: {
					'Accept': 'application/json'
				},
				onload: function(response) {
					try {
						const data = JSON.parse(response.responseText);
						resolve(data);
					} catch (e) {
						reject(e);
					}
				},
				onerror: function(error) {
					reject(error);
				}
			});
		});
	}

	async function updatePixelStats() {
		try {
			const data = await fetchTickerData();

			// Look for the "PIXELS CLAIMED" item in the items array
			if (data && data.items && data.items.length > 0) {
				for (const item of data.items) {
					// Match patterns like "100,379 PIXELS CLAIMED" or "100,379 PIXELS CLAIMED!"
					const match = item.match(/([\d,]+)\s*PIXELS\s*CLAIMED/);
					if (match) {
						pixelCount = parseInt(match[1].replace(/,/g, ''), 10);
						console.log('[Sebplace] Found pixel count:', pixelCount);
						break;
					}
				}
			}

			// If we still don't have a count, try looking for "AVAILABLE" pattern
			if (pixelCount === 0 && data && data.items) {
				for (const item of data.items) {
					// Match patterns like "899,621 PIXELS AVAILABLE"
					const match = item.match(/([\d,]+)\s*PIXELS\s*AVAILABLE/);
					if (match) {
						// Available pixels = Total - Claimed
						const available = parseInt(match[1].replace(/,/g, ''), 10);
						pixelCount = TOTAL_PIXELS - available;
						console.log('[Sebplace] Calculated pixel count from available:', pixelCount);
						break;
					}
				}
			}

			updateStatsUI();
		} catch (error) {
			console.error('[Sebplace] Failed to fetch ticker data:', error);
		}
	}

    // ============================================
    // STATS UI UPDATE - UPDATED
    // ============================================
    function updateStatsUI() {
        const claimedEl = document.querySelector('.sebplace-stats-claimed');
        const progressFill = document.querySelector('.sebplace-progress-fill');
        const percentageEl = document.querySelector('.sebplace-stats-percentage');

        if (claimedEl) {
            claimedEl.textContent = pixelCount.toLocaleString();
        }

        const percentage = Math.min(100, (pixelCount / TOTAL_PIXELS) * 100);
        if (progressFill) {
            progressFill.style.width = percentage + '%';
        }

        if (percentageEl) {
            percentageEl.textContent = percentage.toFixed(1) + '%';
        }
    }

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
        updateAllSidebarUI();
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

        updateAllSidebarUI();
        console.log(`[Sebplace] Dark mode ${isDarkMode ? 'enabled' : 'disabled'}`);
    }

    function updateAllSidebarUI() {
        document.querySelectorAll('#sebplace-darkmode-toggle').forEach(toggle => {
            toggle.checked = isDarkMode;
        });

        document.querySelectorAll('.sebplace-status-dot').forEach(dot => {
            dot.className = `sebplace-status-dot ${isDarkMode ? 'on' : 'off'}`;
        });
    }

    // ============================================
    // ABOUT POPUP
    // ============================================
    function showAboutPopup() {
        aboutPopupOpen = true;
        const overlay = document.querySelector('#sebplace-about-overlay');
        if (overlay) {
            overlay.classList.add('active');
        }
    }

    function hideAboutPopup() {
        aboutPopupOpen = false;
        const overlay = document.querySelector('#sebplace-about-overlay');
        if (overlay) {
            overlay.classList.remove('active');
        }
    }

    function createAboutPopup() {
        if (document.querySelector('#sebplace-about-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'sebplace-about-overlay';
        overlay.innerHTML = `
            <div id="sebplace-about-popup">
                <button class="popup-close-btn" id="sebplace-about-close">✕</button>
                <span class="popup-icon">🎨</span>
                <div class="popup-title">
                    About Seb Marble
                    <span class="version">(v0.1.1)</span>
                </div>
                <div class="popup-divider"></div>
                <div class="popup-description">
                    A tool that adds quality-of-life improvements to seb's pixel website <strong>themilliondollardrawing.com</strong>
                </div>
                <div class="popup-author">
                    Created with <span class="heart">♥</span> by <strong>princekyleaedam.</strong>
                </div>
				<div>
					<a href="https://github.com/princekyleaedam/seb_marble">Github Repository
				</div>
            </div>
        `;

        document.body.appendChild(overlay);

        const closeBtn = overlay.querySelector('#sebplace-about-close');
        closeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            hideAboutPopup();
        });

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                hideAboutPopup();
            }
        });

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && aboutPopupOpen) {
                hideAboutPopup();
            }
        });
    }

    // ============================================
    // SIDEBAR INJECTION
    // ============================================
    function injectIntoSidebar(sidebarContainer) {
        if (!sidebarContainer) return false;

        if (sidebarContainer.querySelector('.sebplace-darkmode-row')) return true;

        const targetDiv = sidebarContainer.querySelector('.px-4.mt-2');
        if (!targetDiv) {
            console.log('[Sebplace] Target div not found in sidebar');
            return false;
        }

		// Stats section HTML (keep as is)
		const statsSection = document.createElement('div');
		statsSection.className = 'sebplace-stats-section';
		statsSection.innerHTML = `
			<div class="stats-label">
				<span class="icon">📊</span>
				Canvas Progress
			</div>
			<div class="stats-numbers">
				<span class="claimed sebplace-stats-claimed">${pixelCount.toLocaleString()}</span>
				<span class="total">/ ${TOTAL_PIXELS.toLocaleString()} pixels</span>
			</div>
			<div class="progress-bar-track">
				<div class="progress-bar-fill sebplace-progress-fill" style="width: ${Math.min(100, (pixelCount / TOTAL_PIXELS) * 100)}%"></div>
			</div>
			<div class="stats-percentage sebplace-stats-percentage">${((pixelCount / TOTAL_PIXELS) * 100).toFixed(1)}%</div>
		`;

        // Create Dark Mode row
        const darkModeRow = document.createElement('div');
        darkModeRow.className = 'sebplace-darkmode-row';
        darkModeRow.innerHTML = `
            <span class="sebplace-label">
                <span class="icon">🌙</span>
                Dark Mode
                <span class="sebplace-status-dot ${isDarkMode ? 'on' : 'off'}"></span>
            </span>
            <label class="sebplace-toggle-switch">
                <input type="checkbox" id="sebplace-darkmode-toggle" ${isDarkMode ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
        `;

        // Create About link
        const aboutLink = document.createElement('div');
        aboutLink.className = 'sebplace-about-link';
        aboutLink.id = 'sebplace-about-trigger';
        aboutLink.innerHTML = `
            <span class="icon">ℹ️</span>
            About Seb Marble
            <span class="version-tag">v0.1.1</span>
        `;

        // Insert in order: Stats → Dark Mode → About
        targetDiv.parentElement.insertBefore(statsSection, targetDiv.nextSibling);
        targetDiv.parentElement.insertBefore(darkModeRow, statsSection.nextSibling);
        targetDiv.parentElement.insertBefore(aboutLink, darkModeRow.nextSibling);

        // Dark mode toggle listener
        const toggle = darkModeRow.querySelector('#sebplace-darkmode-toggle');
        toggle.addEventListener('change', function(e) {
            e.stopPropagation();
            toggleDarkMode();
        });

        // About link listener
        aboutLink.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('[Sebplace] About link clicked!');
            showAboutPopup();
        });

        console.log('[Sebplace] Sidebar content injected successfully!');
        return true;
    }

    function injectSidebarContent() {
        const sidebarContainers = document.querySelectorAll('.bg-white.rounded-2xl.shadow-sm.border.border-gray-200.overflow-hidden.flex.flex-col.h-screen.w-fit');

        if (sidebarContainers.length === 0) {
            console.log('[Sebplace] No sidebar containers found, will retry...');
            return false;
        }

        let success = false;
        sidebarContainers.forEach((container) => {
            const result = injectIntoSidebar(container);
            if (result) success = true;
        });

        return success;
    }

    // ============================================
    // OBSERVER
    // ============================================
    function setupObserver() {
        if (observer) return;

        observer = new MutationObserver(() => {
            const sidebarContainers = document.querySelectorAll('.bg-white.rounded-2xl.shadow-sm.border.border-gray-200.overflow-hidden.flex.flex-col.h-screen.w-fit');
            let needsInjection = false;

            sidebarContainers.forEach(container => {
                if (!container.querySelector('.sebplace-darkmode-row')) {
                    needsInjection = true;
                }
            });

            if (needsInjection) {
                injectSidebarContent();
            }

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

        createAboutPopup();
        setupObserver();

        // Initial stats fetch
        updatePixelStats();

        // Set up periodic updates
        updateTimer = setInterval(updatePixelStats, UPDATE_INTERVAL);

        setTimeout(() => {
            const success = injectSidebarContent();
            if (!success) {
                setTimeout(injectSidebarContent, 2000);
                setTimeout(injectSidebarContent, 5000);
            }
        }, 500);

        setTimeout(() => {
            applyDarkMode();
        }, 600);

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

    // Handle SPA navigation
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            setTimeout(() => {
                const sidebarContainers = document.querySelectorAll('.bg-white.rounded-2xl.shadow-sm.border.border-gray-200.overflow-hidden.flex.flex-col.h-screen.w-fit');
                let needsInjection = false;

                sidebarContainers.forEach(container => {
                    if (!container.querySelector('.sebplace-darkmode-row')) {
                        needsInjection = true;
                    }
                });

                if (needsInjection) {
                    injectSidebarContent();
                }

                if (isDarkMode) {
                    canvasPatched = false;
                    applyDarkMode();
                }

                // Refresh stats on navigation
                updatePixelStats();
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
        showAbout: showAboutPopup,
        hideAbout: hideAboutPopup,
        refreshStats: updatePixelStats,
        getPixelCount: () => pixelCount
    };

    console.log('[Sebplace] Dark mode ready! Canvas stats and dark mode added to both sidebars.');
    console.log('[Sebplace] Stats update every minute. Use window.sebplaceDarkMode for console controls.');
})();
