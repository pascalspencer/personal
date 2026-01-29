/**
 * Live Popup Component
 * Displays real-time contract updates using WebSocket subscriptions
 * Based on the pattern from Example/packages/bot-skeleton/src/services/tradeEngine/trade/OpenContract.js
 */

import { getCurrentToken } from './popupMessages.mjs';

const derivAppID = 61696;
const activePopups = new Map(); // Track active contract subscriptions

/**
 * Show a live-updating popup for a contract
 * @param {string} contractId - The contract ID to subscribe to
 * @param {object} initialData - Initial contract data (stake, buyPrice, payout, etc.)
 */
export function showLivePopup(contractId, initialData = {}) {
    // Don't create duplicate popups for the same contract
    if (activePopups.has(contractId)) {
        return;
    }

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

    // Body with trade details
    const body = document.createElement('div');
    body.className = 'popup-body';

    const stakeRow = createRow('Stake', `$${Number(initialData.stake || 0).toFixed(2)}`);
    const buyPriceRow = createRow('Buy Price', `$${Number(initialData.buyPrice || 0).toFixed(2)}`);
    const currentPriceRow = createRow('Current Price', `$${Number(initialData.buyPrice || 0).toFixed(2)}`, 'current-price');
    const payoutRow = createRow('Payout', `$${Number(initialData.payout || 0).toFixed(2)}`);
    const profitRow = createRow('Profit/Loss', '$0.00', 'profit-loss');
    const balanceRow = createRow('Balance', initialData.balance ? `$${Number(initialData.balance).toFixed(2)}` : '...', 'balance');

    body.appendChild(stakeRow);
    body.appendChild(buyPriceRow);
    body.appendChild(currentPriceRow);
    body.appendChild(payoutRow);
    body.appendChild(profitRow);
    body.appendChild(balanceRow);

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

    // WebSocket subscription for live updates
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

            // Subscribe to contract updates
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
                    updatePopupWithContractData(popup, msg.proposal_open_contract, initialData);
                }

                // Also listen for balance updates
                if (msg.balance) {
                    const balanceValue = balanceRow.querySelector('.row-value');
                    if (balanceValue) {
                        balanceValue.textContent = `$${Number(msg.balance.balance).toFixed(2)}`;
                    }
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
 * Update popup content with live contract data
 */
function updatePopupWithContractData(popup, contract, initialData) {
    const statusBadge = popup.querySelector('.status-badge');
    const currentPriceValue = popup.querySelector('.current-price .row-value');
    const profitLossRow = popup.querySelector('.profit-loss');
    const profitLossValue = profitLossRow.querySelector('.row-value');

    // Update current price (bid_price or current_spot)
    const currentPrice = contract.bid_price || contract.current_spot || contract.buy_price;
    if (currentPriceValue && currentPrice !== undefined) {
        currentPriceValue.textContent = `$${Number(currentPrice).toFixed(2)}`;
    }

    // Update profit/loss
    const profit = contract.profit !== undefined ? Number(contract.profit) : 0;
    if (profitLossValue) {
        if (profit > 0) {
            profitLossValue.innerHTML = `<span class="profit">+$${profit.toFixed(2)}</span>`;
            profitLossRow.classList.remove('negative');
            profitLossRow.classList.add('positive');
        } else if (profit < 0) {
            profitLossValue.innerHTML = `<span class="loss">-$${Math.abs(profit).toFixed(2)}</span>`;
            profitLossRow.classList.remove('positive');
            profitLossRow.classList.add('negative');
        } else {
            profitLossValue.textContent = '$0.00';
            profitLossRow.classList.remove('positive', 'negative');
        }
    }

    // Update status badge
    if (contract.is_sold || contract.is_expired) {
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
