// Stream Wall — scroll-back for the Meld chat overlay (elements.meldstudio.co …/vazir-chat.html).
// The overlay keeps only its last 7 messages in #chat-container and deletes older ones, so a fast
// chat is gone before it can be read. This keeps a copy of every message (same DOM, so the same
// look) and lets the panel scroll through them:
//   • scroll up → history mode: live chat pauses, the copies scroll freely;
//   • new messages meanwhile are counted on a "back to live" pill;
//   • scroll back to the bottom, click the pill, or leave it alone 45 s → live again.
// A message the widget removes because a moderator deleted it (not because it was the oldest)
// disappears from the history too. Runs only inside the wall.
(() => {
  if (window === window.top) return;
  const anc = location.ancestorOrigins;
  const top = anc && anc.length ? anc[anc.length - 1] : '';
  if (!window.__swHistoryForce && !top.startsWith('chrome-extension://')) return;

  const LIMIT = 300; // copies kept
  // Saved in the widget's own storage, so a reload keeps it; one history per widget (the solo and
  // the dual chat share this origin). The solo chat kept its history under the plain key before.
  const LEGACY_KEY = 'sw-chat-history';
  const STORE_KEY = LEGACY_KEY + ':' + location.pathname;
  const IDLE_MS = 45000; // history mode gives way to live chat after this long untouched

  function start(live) {
    const hist = document.createElement('div');
    hist.id = 'sw-history';
    const pill = document.createElement('button');
    pill.id = 'sw-live';
    pill.type = 'button';
    const hint = document.createElement('div');
    hint.id = 'sw-hint';
    hint.textContent = 'تاریخچهٔ چت · برای برگشت به زنده پایین بکش';
    const hintFor = (n) => `تاریخچهٔ چت · ${new Intl.NumberFormat('fa-IR').format(n)} پیام · برای برگشت پایین بکش`;
    const style = document.createElement('style');
    style.textContent = `
      #sw-history {
        position: fixed; z-index: 50; display: none;
        flex-direction: column; gap: var(--sw-gap, 30px);
        overflow-y: auto; overscroll-behavior: contain;
        scrollbar-width: none;
      }
      #sw-history::-webkit-scrollbar { display: none; }
      html.sw-history #sw-history { display: flex; }
      html.sw-history #chat-container { visibility: hidden; }
      #sw-history .message-item { animation: none !important; opacity: 1 !important; transform: none !important; flex: none; }
      #sw-history .message-item:first-child { margin-top: auto; }
      #sw-history::before { content: ""; flex: none; height: 30px; } /* room for the first name tag */
      #sw-live, #sw-hint {
        position: fixed; z-index: 51; left: 50%; translate: -50% 0;
        display: none; align-items: center; gap: 8px;
        padding: 8px 18px;
        border-radius: 999px;
        background: var(--pill-bg, #10180e);
        border: var(--pill-border, 2px solid rgba(139,197,63,.7));
        box-shadow: var(--pill-shadow, 0 0 10px rgba(74,122,26,.5)), 0 8px 24px rgba(0,0,0,.6);
        color: var(--text-cream, #f3f7d6);
        font: 800 17px/1.3 var(--font-family, Vazirmatn, Tahoma, sans-serif);
        direction: rtl; white-space: nowrap;
      }
      #sw-live { bottom: 18px; cursor: pointer; }
      #sw-hint { top: 10px; font-size: 14px; font-weight: 700; opacity: 0.9; pointer-events: none; }
      html.sw-history #sw-live, html.sw-history #sw-hint { display: flex; }
    `;
    document.head.append(style);
    document.body.append(hist, pill, hint);

    const copyOf = new WeakMap(); // original message → its copy
    const liveOrder = []; // originals currently in the widget, oldest first
    let maxSeen = 0;
    let unseen = 0;
    let idleTimer = 0;
    let lastDown = 0;
    const faNum = new Intl.NumberFormat('fa-IR');

    let saveTimer = 0;
    function save() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify([...hist.children].map((c) => c.outerHTML)));
        } catch {
          // storage full or blocked: the history still works, it just won't survive a reload
        }
      }, 800);
    }
    function restore() {
      let saved = [];
      try {
        const legacy = /\/vazir-chat\.html$/.test(location.pathname) ? localStorage.getItem(LEGACY_KEY) : null;
        saved = JSON.parse(localStorage.getItem(STORE_KEY) || legacy || '[]');
      } catch {}
      if (!Array.isArray(saved)) return;
      const tpl = document.createElement('template');
      tpl.innerHTML = saved.slice(-LIMIT).filter((h) => typeof h === 'string').join('');
      for (const el of tpl.content.children) {
        el.classList.add('no-anim');
        restored.add(el);
      }
      hist.append(tpl.content);
    }
    // A live message that is already in the restored history reuses that copy: same meta id, or for
    // widgets that don't mark their messages (the dual chat) same name and text among the restored ones.
    const restored = new Set();
    const sigOf = (el) => (el.dataset.userName || '') + '|' + el.textContent.replace(/\s+/g, ' ').trim();
    const restoredCopy = (node) => {
      const id = node.dataset && node.dataset.metaId;
      if (id) return hist.querySelector(`[data-meta-id="${CSS.escape(id)}"]`);
      const sig = sigOf(node);
      const hit = [...restored].reverse().find((c) => c.isConnected && sigOf(c) === sig) || null;
      if (hit) restored.delete(hit);
      return hit;
    };

    const inHistory = () => document.documentElement.classList.contains('sw-history');
    const atBottom = () => hist.scrollTop + hist.clientHeight >= hist.scrollHeight - 4;

    function updatePill() {
      pill.textContent = unseen ? `${faNum.format(unseen)} پیام تازه ↓` : 'برگشت به چت زنده ↓';
    }

    function archive(node) {
      if (!(node instanceof HTMLElement) || !node.classList.contains('message-item') || copyOf.has(node)) return;
      const existing = restoredCopy(node);
      if (existing) {
        copyOf.set(node, existing);
        liveOrder.push(node);
        return;
      }
      const copy = node.cloneNode(true);
      copy.classList.add('no-anim');
      copyOf.set(node, copy);
      liveOrder.push(node);
      const follow = !inHistory() || atBottom();
      hist.append(copy);
      while (hist.children.length > LIMIT) hist.firstElementChild.remove();
      save();
      if (inHistory()) {
        if (follow) hist.scrollTop = hist.scrollHeight;
        else {
          unseen += 1;
          updatePill();
        }
      }
    }

    function forget(node) {
      const i = liveOrder.indexOf(node);
      if (i === -1) return;
      // The oldest message dropping out while the chat is full is the widget's own trimming —
      // keep its copy. Anything else is a moderator deleting it: drop the copy as well.
      const trimmed = i === 0 && live.children.length >= maxSeen;
      liveOrder.splice(i, 1);
      if (!trimmed) {
        copyOf.get(node)?.remove();
        save();
      }
    }

    new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach(archive);
        r.removedNodes.forEach(forget);
      }
      maxSeen = Math.max(maxSeen, live.children.length);
    }).observe(live, { childList: true });
    restore();
    [...live.children].forEach(archive);
    maxSeen = live.children.length;

    function bumpIdle() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(exitHistory, IDLE_MS);
    }

    function enterHistory() {
      // lay the history exactly over the live chat, with its spacing
      const r = live.getBoundingClientRect();
      const cs = getComputedStyle(live);
      Object.assign(hist.style, {
        left: r.left + 'px',
        right: Math.max(0, innerWidth - r.right) + 'px',
        top: '0px',
        bottom: Math.max(0, innerHeight - r.bottom) + 'px',
      });
      hist.style.setProperty('--sw-gap', cs.rowGap && cs.rowGap !== 'normal' ? cs.rowGap : '30px');
      unseen = 0;
      updatePill();
      hint.textContent = hintFor(hist.children.length);
      document.documentElement.classList.add('sw-history');
      hist.scrollTop = hist.scrollHeight;
      bumpIdle();
    }

    function exitHistory() {
      clearTimeout(idleTimer);
      document.documentElement.classList.remove('sw-history');
      unseen = 0;
    }

    window.addEventListener(
      'wheel',
      (e) => {
        if (!inHistory()) {
          if (e.deltaY >= 0 || !hist.children.length) return;
          enterHistory();
          hist.scrollTop += e.deltaY;
          e.preventDefault();
          return;
        }
        bumpIdle();
        if (e.deltaY > 0) {
          // already at the bottom and still scrolling down → back to live
          if (atBottom()) exitHistory();
          else lastDown = Date.now();
        }
      },
      { passive: false },
    );
    // reaching the bottom while scrolling down → back to live
    hist.addEventListener('scroll', () => {
      if (atBottom() && Date.now() - lastDown < 700) exitHistory();
    });
    hist.addEventListener('pointermove', bumpIdle, { passive: true });
    pill.addEventListener('click', exitHistory);
    window.addEventListener('keydown', (e) => e.key === 'Escape' && exitHistory());
  }

  // The widget builds #chat-container itself; wait for it.
  const found = document.getElementById('chat-container');
  if (found) start(found);
  else {
    const wait = new MutationObserver(() => {
      const el = document.getElementById('chat-container');
      if (el) {
        wait.disconnect();
        start(el);
      }
    });
    wait.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
