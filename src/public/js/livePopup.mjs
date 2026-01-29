/**
 * Live Popup Component
 * Displays simplified contract info: trade type, stake, and payout only
 */

import { getCurrentToken } from './popupMessages.mjs';

const derivAppID = 61696;
const activePopups = new Map(); // Track active contract subscriptions

/**
 * Show a simplified popup for a contract
 * @param {string} contractId - The contract ID to subscribe to
 * @param {object} initialData - Initial contract data (stake, payout, tradeType)
 */
export function showLivePopup(contractId, initialData = {}) {
    // SINGLETON PATTERN: Close any existing popups before showing a new one
    closeAllLivePopups();

    const overlay = document.createElement('div');
    overlay.className = 'trade-popup-overlay live-popup';
    overlay.dataset.contractId = contractId;

    const popup = document.createElement('div');
    popup.className = 'trade-popup live-updating';

    // Header with contract type and status badge
    const header = document.createElement('div');
    header.className = 'popup-header';

    const title = document.createElement('h3');
    title.textContent = initialData.tradeType || 'Trade';
    header.appendChild(title);

    const statusBadge = document.createElement('span');
    statusBadge.className = 'status-badge status-open';
    statusBadge.textContent = 'OPEN';
    header.appendChild(statusBadge);

    popup.appendChild(header);

    // Body with ONLY stake and payout
    const body = document.createElement('div');
    body.className = 'popup-body';

    const stakeRow = createRow('Stake', `$${Number(initialData.stake || 0).toFixed(2)}`);
    const payoutRow = createRow('Payout', `$${Number(initialData.payout || 0).toFixed(2)}`);

    body.appendChild(stakeRow);
    body.appendChild(payoutRow);

    popup.appendChild(body);

    // Footer with close button
    const footer = document.createElement('div');
    footer.className = 'popup-footer';

    const closeBtn = document.createElement('a');
    closeBtn.className = 'close-btn';
    closeBtn.href = '#';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        cleanup();
    });
    footer.appendChild(closeBtn);

    popup.appendChild(footer);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // WebSocket subscription for status updates only
    let ws = null;
    let reconnectAttempts = 0;
    const maxReconnects = 3;

    function connectWebSocket() {
        try {
            ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${derivAppID}`);
        } catch (err) {
            console.error('Failed to create WebSocket for live popup:', err);
            return;
        }

        ws.onopen = () => {
            reconnectAttempts = 0;
            const token = getCurrentToken();
            if (token) {
                ws.send(JSON.stringify({ authorize: token }));
            }

            // Subscribe to contract updates (for status only)
            ws.send(JSON.stringify({
                proposal_open_contract: 1,
                contract_id: contractId,
                subscribe: 1
            }));
        };

        ws.onmessage = (evt) => {
            try {
                const msg = JSON.parse(evt.data);

                if (msg.proposal_open_contract) {
                    updatePopupStatus(popup, msg.proposal_open_contract);
                }
            } catch (err) {
                console.error('Error parsing live popup message:', err);
            }
        };

        ws.onerror = (err) => {
            console.error('WebSocket error in live popup:', err);
        };

        ws.onclose = () => {
            if (reconnectAttempts < maxReconnects && activePopups.has(contractId)) {
                reconnectAttempts++;
                setTimeout(connectWebSocket, 2000);
            }
        };
    }

    function cleanup() {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
        activePopups.delete(contractId);
        overlay.remove();
    }

    activePopups.set(contractId, { ws, cleanup });
    connectWebSocket();
}

/**
 * Update popup status badge only
 */
function updatePopupStatus(popup, contract) {
    const statusBadge = popup.querySelector('.status-badge');

    // Update status badge based on contract state
    if (contract.is_sold || contract.is_expired) {
        const profit = contract.profit !== undefined ? Number(contract.profit) : 0;
        const isWin = profit >= 0;
        statusBadge.textContent = isWin ? 'WON' : 'LOST';
        statusBadge.className = `status-badge ${isWin ? 'status-won' : 'status-lost'}`;

        // Auto-close after 5 seconds
        setTimeout(() => {
            const contractId = popup.closest('.trade-popup-overlay').dataset.contractId;
            const popupData = activePopups.get(contractId);
            if (popupData) {
                popupData.cleanup();
            }
        }, 5000);
    } else if (contract.is_valid_to_sell) {
        statusBadge.textContent = 'OPEN';
        statusBadge.className = 'status-badge status-open';
    }
}

/**
 * Helper to create a row element
 */
function createRow(label, value, className = '') {
    const row = document.createElement('div');
    row.className = `popup-row ${className}`;

    const labelEl = document.createElement('span');
    labelEl.className = 'row-label';
    labelEl.textContent = label + ':';

    const valueEl = document.createElement('span');
    valueEl.className = 'row-value';
    valueEl.innerHTML = value;

    row.appendChild(labelEl);
    row.appendChild(valueEl);

    return row;
}

/**
 * Close all active popups (useful for cleanup)
 */
export function closeAllLivePopups() {
    activePopups.forEach((popupData) => {
        popupData.cleanup();
    });
    activePopups.clear();
}
