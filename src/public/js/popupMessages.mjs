function getCurrentToken() {
  const params = new URLSearchParams(window.location.search);
  // tokens passed in URL by sign-in page (saved there as token1/token2)
  const urlToken1 = params.get("token1");
  const urlToken2 = params.get("token2");

  // prefer an explicit account selection on the page (either a dropdown or URL param)
  const accountSelect = typeof document !== 'undefined' ? document.getElementById("accountType") : null;
  const accountFromUrl = params.get('accountType') || params.get('account');
  const selected = accountSelect?.value ?? accountFromUrl;

  // Helper to mask logs
  const mask = (t) => (t ? String(t).slice(0, 8) + '...' : 'null');

  // If user selected Real or Demo, try to return the corresponding token (URL -> localStorage)
  if (selected === 'real') {
    if (urlToken1) {
      localStorage.setItem('token1', urlToken1);
      console.log('Saved Real token from URL (masked):', mask(urlToken1));
      return urlToken1;
    }
    const stored1 = localStorage.getItem('token1');
    if (stored1) {
      console.log('Loaded Real token from storage (masked):', mask(stored1));
      return stored1;
    }
  }

  if (selected === 'demo') {
    if (urlToken2) {
      localStorage.setItem('token2', urlToken2);
      console.log('Saved Demo token from URL (masked):', mask(urlToken2));
      return urlToken2;
    }
    const stored2 = localStorage.getItem('token2');
    if (stored2) {
      console.log('Loaded Demo token from storage (masked):', mask(stored2));
      return stored2;
    }
  }

  // Fallbacks: legacy single-token support (userToken) and any available token1/token2
  const urlUserToken = params.get("userToken");
  if (urlUserToken) {
    localStorage.setItem("userToken", urlUserToken);
    console.log("Saved User Token from query (masked):", mask(urlUserToken));
    return urlUserToken;
  }

  const stored = localStorage.getItem("userToken");
  if (stored) {
    console.log("Loaded User Token from storage (masked):", mask(stored));
    return stored;
  }

  // As a last attempt return any token1/token2 available (url first, then storage)
  if (urlToken1) {
    localStorage.setItem('token1', urlToken1);
    console.log('Saved Real token from URL (masked):', mask(urlToken1));
    return urlToken1;
  }
  if (urlToken2) {
    localStorage.setItem('token2', urlToken2);
    console.log('Saved Demo token from URL (masked):', mask(urlToken2));
    return urlToken2;
  }

  const any1 = localStorage.getItem('token1');
  if (any1) {
    console.log('Loaded Real token from storage (masked):', mask(any1));
    return any1;
  }
  const any2 = localStorage.getItem('token2');
  if (any2) {
    console.log('Loaded Demo token from storage (masked):', mask(any2));
    return any2;
  }

  return null;
}
export { getCurrentToken };