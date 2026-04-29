// =========================================================
// Y9 placeholder + API integration scaffold
// ---------------------------------------------------------
// This is a SCAFFOLD. It proves the website can talk to the
// backend, handle each error case, and render data.
//
// In Y10, the "loaded" state will be replaced with the real
// pricing form. The state machine itself stays.
// =========================================================

(function () {
  // ---------- CONFIG ----------
  const API_BASE = 'https://n8n.srv1240771.hstgr.cloud/webhook';

  // ---------- STATE ELEMENTS ----------
  const states = {
    loading:   document.getElementById('state-loading'),
    noToken:   document.getElementById('state-no-token'),
    expired:   document.getElementById('state-expired'),
    error:     document.getElementById('state-error'),
    loaded:    document.getElementById('state-loaded'),
  };

  const projectNameEl = document.getElementById('project-name');
  const itemCountEl   = document.getElementById('item-count');
  const debugDataEl   = document.getElementById('debug-data');
  const retryBtn      = document.getElementById('retry-btn');

  // ---------- STATE MACHINE ----------
  function showState(name) {
    Object.entries(states).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle('state--hidden', key !== name);
    });
  }

  // ---------- TOKEN PARSING ----------
  function getToken() {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
  }

  // ---------- API CALLS ----------
  async function fetchReview(token) {
    const url = `${API_BASE}/review?token=${encodeURIComponent(token)}`;
    console.log('[review] GET', url);

    let res;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
    } catch (networkErr) {
      // Network-level failure: DNS, offline, CORS preflight failure, etc.
      console.error('[review] network error:', networkErr);
      throw new Error('network');
    }

    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      console.error('[review] non-JSON response:', parseErr);
      throw new Error('bad_response');
    }

    console.log('[review] status:', res.status, 'data:', data);

    if (res.status === 200) return data;
    if (res.status === 404) throw new Error('expired');
    if (res.status === 400) throw new Error('bad_request');
    throw new Error('server');
  }

  // ---------- MAIN FLOW ----------
  async function init() {
    const token = getToken();

    if (!token) {
      console.warn('[review] no token in URL');
      showState('noToken');
      return;
    }

    showState('loading');

    try {
      const data = await fetchReview(token);

      // Update header with project name
      if (data.project_name) {
        projectNameEl.textContent = data.project_name;
      }

      // Render basic info
      const items = data.items || [];
      itemCountEl.textContent = items.length;

      // Pretty-print full response into debug panel
      debugDataEl.textContent = JSON.stringify(data, null, 2);

      showState('loaded');
    } catch (err) {
      const reason = err.message;
      console.warn('[review] fetch failed:', reason);

      if (reason === 'expired' || reason === 'bad_request') {
        showState('expired');
      } else {
        // network, server, bad_response — all bucket as "try again"
        showState('error');
      }
    }
  }

  // Retry handler for the error state
  retryBtn?.addEventListener('click', init);

  // Kick off
  init();
})();
