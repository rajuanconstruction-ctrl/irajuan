// =========================================================
// Review website — full UI
// Renders unmatched items with suggested prices, accepts cost +
// client price per item, autosaves on blur, submits on approve.
// =========================================================

(function () {
  // ---------- CONFIG ----------
  const API_BASE = 'https://n8n.srv1240771.hstgr.cloud/webhook';
  const AUTOSAVE_DEBOUNCE_MS = 600;

  // ---------- DOM ----------
  const states = {
    loading:  document.getElementById('state-loading'),
    noToken:  document.getElementById('state-no-token'),
    expired:  document.getElementById('state-expired'),
    error:    document.getElementById('state-error'),
    approved: document.getElementById('state-approved'),
  };
  const itemsContainer = document.getElementById('items-container');
  const footerBar      = document.getElementById('footer-bar');
  const projectNameEl  = document.getElementById('project-name');
  const progressEl     = document.getElementById('progress');
  const progressCount  = document.getElementById('progress-count');
  const progressFill   = document.getElementById('progress-fill');
  const submitBtn      = document.getElementById('submit-btn');
  const submitLabel    = document.getElementById('submit-label');
  const retryBtn       = document.getElementById('retry-btn');
  const itemTemplate   = document.getElementById('item-template');

  // ---------- STATE ----------
  let token = null;
  let items = [];                    // canonical list, mutated as user types
  let saveTimer = null;
  let saveToastEl = null;

  // ---------- STATE MACHINE ----------
  function showState(name) {
    Object.entries(states).forEach(([key, el]) => {
      if (el) el.hidden = key !== name;
    });
    itemsContainer.hidden = true;
    footerBar.hidden = true;
    progressEl.hidden = true;
  }
  function showItems() {
    Object.values(states).forEach(el => { if (el) el.hidden = true; });
    itemsContainer.hidden = false;
    footerBar.hidden = false;
    progressEl.hidden = false;
  }

  // ---------- TOKEN ----------
  function getToken() {
    return new URLSearchParams(window.location.search).get('token');
  }

  // ---------- HELPERS ----------
  function extractDomain(url) {
    if (!url) return '';
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  }
  function formatNum(n) {
    if (n === null || n === undefined || isNaN(n)) return '';
    return Math.round(n).toLocaleString('he-IL');
  }
  function isComplete(item) {
    return Number(item.user_unit_cost) > 0
        && Number(item.user_unit_client_price) > 0;
  }

  // ---------- API ----------
  async function fetchReview() {
    const url = `${API_BASE}/review?token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
    if (res.status === 404 || res.status === 400) throw new Error('expired');
    if (!res.ok) throw new Error('server');
    return res.json();
  }

  async function saveDraft() {
    try {
      await fetch(`${API_BASE}/review/save?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      flashSaveToast('נשמר');
    } catch (e) {
      console.warn('[save] failed:', e);
      flashSaveToast('שמירה נכשלה — נסה שוב');
    }
  }

  async function submitApproval() {
    submitBtn.classList.add('is-loading');
    submitBtn.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/review/approve?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (res.status === 200 && data.approved) {
        showState('approved');
        return;
      }
      if (data.error === 'items_not_fully_priced') {
        // Highlight unpriced rows
        flashSaveToast(data.message || 'יש פריטים ללא מחיר');
        const unpricedRows = (data.unpriced_items || []).map(u => u._excel_row);
        highlightUnpricedRows(unpricedRows);
        submitBtn.classList.remove('is-loading');
        submitBtn.disabled = false;
        return;
      }
      throw new Error(data.error || 'unknown');
    } catch (e) {
      console.error('[approve] failed:', e);
      flashSaveToast('שגיאה בשליחה — נסה שוב');
      submitBtn.classList.remove('is-loading');
      submitBtn.disabled = false;
    }
  }

  // ---------- AUTOSAVE ----------
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, AUTOSAVE_DEBOUNCE_MS);
  }

  // ---------- TOAST ----------
  function ensureToast() {
    if (saveToastEl) return saveToastEl;
    saveToastEl = document.createElement('div');
    saveToastEl.className = 'save-toast';
    document.body.appendChild(saveToastEl);
    return saveToastEl;
  }
  let toastHideTimer = null;
  function flashSaveToast(text) {
    const el = ensureToast();
    el.textContent = text;
    el.classList.add('is-visible');
    if (toastHideTimer) clearTimeout(toastHideTimer);
    toastHideTimer = setTimeout(() => el.classList.remove('is-visible'), 1800);
  }

  // ---------- RENDERING ----------
  function renderItems() {
    itemsContainer.innerHTML = '';
    items.forEach(item => {
      const card = itemTemplate.content.firstElementChild.cloneNode(true);
      card.dataset.excelRow = item._excel_row;

      // Title + meta
      card.querySelector('.item__title').textContent = item.Description || '(ללא תיאור)';
      const qtyEl = card.querySelector('.item__qty');
      qtyEl.textContent = `${item.Quantity || 0} ${item.Unit || ''}`.trim();

      const catEl = card.querySelector('.item__category');
      // Categories in this dataset can be very long — show only first phrase
      const shortCat = (item.Category || '').split(/[(\-]/)[0].trim();
      catEl.textContent = shortCat || '';
      if (!shortCat) catEl.style.display = 'none';

      // Why no match (collapsible context)
      const whyEl = card.querySelector('.item__why');
      if (item.reason) {
        whyEl.hidden = false;
        card.querySelector('.item__why-text').textContent = item.reason;
      }

      // Suggestions
      const suggestions = Array.isArray(item.suggested_prices) ? item.suggested_prices : [];
      const sugWrap = card.querySelector('.item__suggestions');
      const noSugWrap = card.querySelector('.item__no-suggestions');
      if (suggestions.length > 0) {
        sugWrap.hidden = false;
        const chipsWrap = card.querySelector('.item__chips');
        const median = item.suggested_median;

        suggestions.forEach(p => {
          const chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'chip';
          if (Math.round(p.value) === Math.round(median)) chip.classList.add('is-median');

          const domain = extractDomain(p.source_url) || p.source_name || '';
          chip.innerHTML = `
            <span>${formatNum(p.value)} ₪</span>
            ${domain ? `<span class="chip__source">${domain}</span>` : ''}
          `;
          chip.addEventListener('click', () => {
            // Fill cost input with this value
            const costInput = card.querySelector('input[data-field="cost"]');
            costInput.value = Math.round(p.value);
            costInput.dispatchEvent(new Event('input', { bubbles: true }));
            costInput.focus();
          });
          chipsWrap.appendChild(chip);
        });
      } else {
        noSugWrap.hidden = false;
      }

      // Inputs — wire change events
      const costInput   = card.querySelector('input[data-field="cost"]');
      const clientInput = card.querySelector('input[data-field="client"]');

      // Restore previous values if any (autosave came back)
      if (item.user_unit_cost) costInput.value = item.user_unit_cost;
      if (item.user_unit_client_price) clientInput.value = item.user_unit_client_price;

      function handleInput(field, input) {
        return function () {
          const val = parseFloat(input.value);
          item[field] = isFinite(val) && val > 0 ? val : null;
          // Visual: filled state on this input row
          input.closest('.input-row').classList.toggle('is-filled', !!item[field]);
          updateItemStatus(card, item);
          updateProgress();
          updateSubmitState();
          scheduleSave();
        };
      }
      costInput.addEventListener('input', handleInput('user_unit_cost', costInput));
      clientInput.addEventListener('input', handleInput('user_unit_client_price', clientInput));

      // Initial visual state
      if (item.user_unit_cost) costInput.closest('.input-row').classList.add('is-filled');
      if (item.user_unit_client_price) clientInput.closest('.input-row').classList.add('is-filled');
      updateItemStatus(card, item);

      itemsContainer.appendChild(card);
    });

    updateProgress();
    updateSubmitState();
  }

  function updateItemStatus(card, item) {
    card.classList.toggle('is-complete', isComplete(item));
  }

  function updateProgress() {
    const total = items.length;
    const done = items.filter(isComplete).length;
    progressCount.textContent = `${done} / ${total} פריטים תומחרו`;
    const pct = total === 0 ? 0 : (done / total) * 100;
    progressFill.style.width = `${pct}%`;
  }

  function updateSubmitState() {
    const allDone = items.length > 0 && items.every(isComplete);
    submitBtn.disabled = !allDone;
    submitLabel.textContent = allDone
      ? 'אשר את כל המחירים'
      : `יש למלא ${items.filter(i => !isComplete(i)).length} פריטים נוספים`;
  }

  function highlightUnpricedRows(rows) {
    rows.forEach(rowNum => {
      const card = itemsContainer.querySelector(`[data-excel-row="${rowNum}"]`);
      if (!card) return;
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.style.animation = 'none';
      requestAnimationFrame(() => {
        card.style.animation = 'shake 0.4s ease';
      });
    });
  }

  // ---------- INIT ----------
  async function init() {
    token = getToken();
    if (!token) return showState('noToken');

    showState('loading');
    try {
      const data = await fetchReview();
      items = data.items || [];
      if (data.project_name) projectNameEl.textContent = data.project_name;
      if (items.length === 0) {
        // Edge case: review row exists but no items
        return showState('approved');
      }
      renderItems();
      showItems();
    } catch (e) {
      const reason = e.message;
      if (reason === 'expired') return showState('expired');
      return showState('error');
    }
  }

  retryBtn?.addEventListener('click', init);
  submitBtn.addEventListener('click', submitApproval);

  init();
})();

// Shake animation for highlighting unpriced rows
const styleEl = document.createElement('style');
styleEl.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-6px); }
    75% { transform: translateX(6px); }
  }
`;
document.head.appendChild(styleEl);
