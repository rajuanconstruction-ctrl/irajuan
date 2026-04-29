// =========================================================
// Y9 placeholder JS
// Reads token from URL and displays it (debug aid for now).
// In Y10 this file will fetch /api/review/:token and render
// the actual pricing UI.
// =========================================================

(function () {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const display = document.getElementById('token-display');

  if (!display) return;

  if (!token) {
    // No token in URL — show a hint for testing
    display.textContent = '(אין token — נסה להוסיף ?token=test ל-URL)';
    return;
  }

  // Token present — show truncated form for visual confirmation
  // Real UI in Y10 will not show the token at all.
  const truncated = token.length > 16
    ? `${token.slice(0, 8)}…${token.slice(-4)}`
    : token;

  display.textContent = `token: ${truncated}`;
  console.log('[review] Token received:', token);
})();
