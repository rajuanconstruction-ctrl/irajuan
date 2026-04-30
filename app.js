// =========================================================
// Review website — UI v2 (final)
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
  const progressEl     = document.getElementById('progress');
  const projectNameEl  = document.getElementById('project-name');
  const progressCount  = document.getElementById('progress-count');
  const progressFill   = document.getElementById('progress-fill');
  const progressHint   = document.getElementById('progress-hint');
  const submitBtn      = document.getElementById('submit-btn');
  const submitLabel    = document.getElementById('submit-label');
  const retryBtn       = document.getElementById('retry-btn');
  const itemTemplate   = document.getElementById('item-template');

  // ---------- STATE ----------
  let token = null;
  let items = [];
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

  function showApproved() {
    // Full clean state: only the thank-you card visible.
    Object.entries(states).forEach(([key, el]) => {
      if (el) el.hidden = key !== 'approved';
    });
    itemsContainer.hidden = true;
    footerBar.hidden = true;
    progressEl.hidden = true;
    document.body.classList.add('is-approved');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // An item counts as "priced" if BOTH prices are > 0.
  // An item with both = 0 is "deferred" (יתומחר בהמשך).
  function isPriced(item) {
    return Number(item.user_unit_cost) > 0
        && Number(item.user_unit_client_price) > 0;
  }

  function isDeferred(item) {
    return Number(item.user_unit_cost) === 0
        && Number(item.user_unit_client_price) === 0;
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
    try {
      const res = await fetch(`${API_BASE}/review/approve?token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (res.status === 200 && data.approved) {
        showApproved();
        return;
      }
      flashSaveToast(data.message || 'שגיאה בשליחה');
      submitBtn.classList.remove('is-loading');
    } catch (e) {
      console.error('[approve] failed:', e);
      flashSaveToast('שגיאה בשליחה — נסה שוב');
      submitBtn.classList.remove('is-loading');
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

  // ---------- STICKY PROGRESS DETECTION ----------
  function setupStickyDetection() {
    if (!progressEl) return;
    const sentinel = document.createElement('div');
    sentinel.style.cssText = 'position:absolute;height:1px;width:100%;pointer-events:none;';
    progressEl.parentNode.insertBefore(sentinel, progressEl);

    const obs = new IntersectionObserver(entries => {
      const isStuck = !entries[0].isIntersecting;
      progressEl.classList.toggle('is-stuck', isStuck);
    }, { threshold: 0 });

    obs.observe(sentinel);
  }

  // ---------- RENDERING ----------
  function renderItems() {
    itemsContainer.innerHTML = '';
    items.forEach(item => {
      // Default both price fields to 0
      if (item.user_unit_cost === null || item.user_unit_cost === undefined) {
        item.user_unit_cost = 0;
      }
      if (item.user_unit_client_price === null || item.user_unit_client_price === undefined) {
        item.user_unit_client_price = 0;
      }

      const card = itemTemplate.content.firstElementChild.cloneNode(true);
      card.dataset.excelRow = item._excel_row;

      // Title + meta
      card.querySelector('.item__title').textContent = item.Description || '(ללא תיאור)';
      const qtyEl = card.querySelector('.item__qty');
      qtyEl.textContent = `${item.Quantity || 0} ${item.Unit || ''}`.trim();

      const catEl = card.querySelector('.item__category');
      const shortCat = (item.Category || '').split(/[(\-]/)[0].trim();
      catEl.textContent = shortCat || '';
      if (!shortCat) catEl.style.display = 'none';

      // Why no match
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

      // Inputs
      const costInput   = card.querySelector('input[data-field="cost"]');
      const clientInput = card.querySelector('input[data-field="client"]');

      costInput.value = item.user_unit_cost;
      clientInput.value = item.user_unit_client_price;

      function setupZeroHandling(input, field) {
        // On focus: if value is 0, clear so user doesn't have to delete it
        input.addEventListener('focus', () => {
          if (Number(input.value) === 0) input.value = '';
        });
        // On blur: if empty, restore to 0
        input.addEventListener('blur', () => {
          if (input.value === '' || isNaN(parseFloat(input.value))) {
            input.value = 0;
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
        input.addEventListener('input', () => {
          const val = parseFloat(input.value);
          item[field] = isFinite(val) && val >= 0 ? val : 0;
          input.classList.toggle('is-zero', Number(item[field]) === 0);
          input.closest('.input-row').classList.toggle('is-filled', Number(item[field]) > 0);
          updateItemStatus(card, item);
          updateProgress();
          scheduleSave();
        });
      }

      setupZeroHandling(costInput, 'user_unit_cost');
      setupZeroHandling(clientInput, 'user_unit_client_price');

      // Initial visual state
      costInput.classList.toggle('is-zero', Number(item.user_unit_cost) === 0);
      clientInput.classList.toggle('is-zero', Number(item.user_unit_client_price) === 0);
      if (Number(item.user_unit_cost) > 0) costInput.closest('.input-row').classList.add('is-filled');
      if (Number(item.user_unit_client_price) > 0) clientInput.closest('.input-row').classList.add('is-filled');
      updateItemStatus(card, item);

      itemsContainer.appendChild(card);
    });

    updateProgress();
    updateSubmitLabel();
  }

  function updateItemStatus(card, item) {
    card.classList.toggle('is-priced', isPriced(item));
    card.classList.toggle('is-skipped', isDeferred(item));
  }

  function updateProgress() {
    const total = items.length;
    const priced = items.filter(isPriced).length;
    const deferred = items.filter(isDeferred).length;
    const decided = priced + deferred;

    progressCount.textContent = deferred > 0
      ? `${priced} תומחרו · ${deferred} בהמשך · מתוך ${total}`
      : `${priced} / ${total} פריטים תומחרו`;

    const pct = total === 0 ? 0 : (decided / total) * 100;
    progressFill.style.width = `${pct}%`;

    updateSubmitLabel();
  }

  function updateSubmitLabel() {
    const priced = items.filter(isPriced).length;
    const deferred = items.filter(isDeferred).length;
    if (deferred > 0) {
      submitLabel.textContent = `אשר ${priced} פריטים (${deferred} בהמשך)`;
    } else {
      submitLabel.textContent = 'אשר את כל המחירים';
    }
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
        return showApproved();
      }
      renderItems();
      showItems();
      setupStickyDetection();
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
