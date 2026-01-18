// Handles account selection and loginid popup for sign-in.html

export function handleAccountSelectionAndPopup() {
  const params = new URLSearchParams(window.location.search);
  const accountSelect = typeof document !== 'undefined' ? document.getElementById("accountType") : null;
  let accountList = [];
  let realAccounts = [];
  let demoAccounts = [];
  let loginidPrompted = false;

  if (accountSelect && typeof window !== 'undefined') {
    if (!accountSelect._dynamicLoaded) {
      accountSelect._dynamicLoaded = true;
      // Expect accounts in URL as JSON string in 'accounts' param, e.g. ?accounts=[{...},{...}]
      let accountsParam = params.get('accounts');
      if (accountsParam) {
        try {
          accountList = JSON.parse(decodeURIComponent(accountsParam));
          // Use type field to distinguish real/demo
          realAccounts = accountList.filter(acc => acc.type === 'real');
          demoAccounts = accountList.filter(acc => acc.type === 'demo');
          // Add all accounts to dropdown if not present and store token by loginid
          accountList.forEach(acc => {
            if (!document.getElementById('accountType')) return;
            if (![...accountSelect.options].some(opt => opt.value === acc.loginid)) {
              const opt = document.createElement('option');
              opt.value = acc.loginid;
              opt.textContent = `${acc.loginid} (${acc.currency || acc.type || 'Account'})`;
              accountSelect.appendChild(opt);
            }
            // Store token for each loginid
            if (acc.token) {
              localStorage.setItem(acc.loginid, acc.token);
            }
          });
          // Only show popup after user makes a selection (not on page load)
          const realTradingAccounts = realAccounts.filter(a => a.currency === 'USD');
          const realWallets = realAccounts.filter(a => a.currency !== 'USD');
          if ((realAccounts.length > 1 && (realTradingAccounts.length > 0 && realWallets.length > 0)) && !loginidPrompted) {
            loginidPrompted = true;
            accountSelect.addEventListener('change', function realChangeHandler(e) {
              if (accountSelect.value === 'real') {
                showLoginidPrompt({
                  realAccounts,
                  demoAccounts,
                  accountList,
                  accountSelect,
                  onSelected: (loginid) => {
                    accountSelect.value = loginid;
                  }
                });
              }
            });
          } else if ((realAccounts.length > 1 || demoAccounts.length > 1) && !loginidPrompted) {
            loginidPrompted = true;
            accountSelect.addEventListener('change', function demoOrRealChangeHandler(e) {
              if (
                (realAccounts.length > 1 && accountSelect.value === realAccounts[0].loginid) ||
                (demoAccounts.length > 1 && accountSelect.value === demoAccounts[0].loginid)
              ) {
                showLoginidPrompt({ realAccounts, demoAccounts, accountList, accountSelect });
              }
            });
          }
        } catch (e) {
          console.warn('Could not parse accounts from URL:', e);
        }
      }
    }
  }
}

export function showLoginidPrompt({realAccounts = [], demoAccounts = [], accountList = [], accountSelect = null, onSelected = null}) {
  // Remove any existing loginid popup to avoid duplicates
  const existing = document.querySelector('.trade-popup-overlay[data-loginid-popup]');
  if (existing) existing.remove();

  // Build popup
  const overlay = document.createElement('div');
  overlay.className = 'trade-popup-overlay';
  overlay.setAttribute('data-loginid-popup', '1');
  overlay.style.zIndex = 9999;
  const popup = document.createElement('div');
  popup.className = 'trade-popup';
  const title = document.createElement('h3');
  title.textContent = 'Multiple Accounts Detected';
  popup.appendChild(title);
  const msgP = document.createElement('p');
  msgP.textContent = 'You have multiple real or demo accounts. Please enter the loginid of the account you wish to use for trading:';
  popup.appendChild(msgP);
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Enter loginid (e.g. CR123456)';
  input.style.margin = '10px 0';
  popup.appendChild(input);
  const list = document.createElement('ul');
  list.style.textAlign = 'left';
  list.style.fontSize = '13px';
  if (realAccounts.length > 1) {
    const realLabel = document.createElement('li');
    realLabel.textContent = 'Real: ' + realAccounts.map(a => `${a.loginid} (${a.currency})`).join(', ');
    list.appendChild(realLabel);
  }
  if (demoAccounts.length > 1) {
    const demoLabel = document.createElement('li');
    demoLabel.textContent = 'Demo: ' + demoAccounts.map(a => `${a.loginid} (${a.currency})`).join(', ');
    list.appendChild(demoLabel);
  }
  popup.appendChild(list);
  const errorMsg = document.createElement('div');
  errorMsg.style.color = 'red';
  errorMsg.style.fontSize = '12px';
  errorMsg.style.margin = '5px 0';
  popup.appendChild(errorMsg);
  const okBtn = document.createElement('button');
  okBtn.textContent = 'Use this account';
  okBtn.style.margin = '10px 8px 0 0';
  okBtn.onclick = function() {
    const val = input.value.trim();
    if (!val || !accountList.some(a => a.loginid === val)) {
      errorMsg.textContent = 'Invalid loginid. Please enter one from the list above.';
      return;
    }
    // Set dropdown and localStorage
    if (accountSelect) accountSelect.value = val;
    localStorage.setItem('selected_loginid', val);
    overlay.remove();
    if (typeof onSelected === 'function') onSelected(val);
  };
  popup.appendChild(okBtn);
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = function() { overlay.remove(); };
  popup.appendChild(cancelBtn);
  overlay.appendChild(popup);
  document.body.appendChild(overlay);
  input.focus();
}

// Auto-run on sign-in.html or /sign-in
if (
  window.location.pathname.endsWith('sign-in.html') ||
  window.location.pathname.endsWith('sign-in')
) {
  document.addEventListener('DOMContentLoaded', handleAccountSelectionAndPopup);
}
