(() => {
  const PENDING_KEY = 'blog-writer:pending-entry';
  const CATEGORY_LABELS = {
    projects: '프로젝트',
    'project-a': '프로젝트 A',
    design: '설계',
    notes: '잡설',
    games: '게임',
    'game-a': '게임A',
    'game-b': '게임B',
    'game-c': '게임C',
    thoughts: '잡생각',
    food: '식사',
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const isNewBlogEntry = () => window.location.hash.includes('/collections/blog/new');

  const getPending = () => {
    try {
      return JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
    } catch {
      return null;
    }
  };

  const visible = (element) => {
    if (!element || !(element instanceof Element)) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  };

  const cleanText = (text) =>
    (text || '')
      .replace(/\*/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

  const matchesLabel = (text, labels) => {
    const value = cleanText(text);
    return labels.some((label) => value === cleanText(label) || value.startsWith(cleanText(label)));
  };

  const controlsIn = (root) =>
    Array.from(
      root.querySelectorAll(
        'input:not([type="hidden"]):not([type="button"]):not([type="submit"]), textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"]',
      ),
    ).filter(visible);

  const findFieldRoot = (labels) => {
    const candidates = Array.from(document.querySelectorAll('label, span, p, div, h1, h2, h3, h4')).filter((element) => {
      const text = element.textContent || '';
      return visible(element) && text.length <= 80 && matchesLabel(text, labels);
    });

    for (const candidate of candidates) {
      let node = candidate;
      for (let depth = 0; node && depth < 8; depth += 1) {
        const controls = controlsIn(node);
        if (controls.length > 0) return node;
        node = node.parentElement;
      }
    }

    return null;
  };

  const emitInput = (element) => {
    element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
  };

  const setNativeValue = (element, value) => {
    if (!element) return false;

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) setter.call(element, value);
      else element.value = value;
      emitInput(element);
      return true;
    }

    if (element instanceof HTMLSelectElement) {
      element.value = value;
      emitInput(element);
      return true;
    }

    if (element.isContentEditable || element.getAttribute('role') === 'textbox') {
      element.focus();
      document.execCommand('selectAll', false);
      document.execCommand('insertText', false, value);
      if ((element.textContent || '').trim() !== value.trim()) {
        element.textContent = value;
      }
      emitInput(element);
      return true;
    }

    return false;
  };

  const chooseControl = (root, kind) => {
    const controls = controlsIn(root || document);
    if (kind === 'body') {
      return controls
        .filter((control) => control instanceof HTMLTextAreaElement || control.isContentEditable || control.getAttribute('role') === 'textbox')
        .sort((a, b) => {
          const aRect = a.getBoundingClientRect();
          const bRect = b.getBoundingClientRect();
          return bRect.width * bRect.height - aRect.width * aRect.height;
        })[0];
    }

    if (kind === 'date') {
      return (
        controls.find((control) => control instanceof HTMLInputElement && control.type === 'datetime-local') ||
        controls.find((control) => control instanceof HTMLInputElement && control.type === 'date') ||
        controls.find((control) => control instanceof HTMLInputElement)
      );
    }

    if (kind === 'category') {
      return (
        controls.find((control) => control instanceof HTMLSelectElement) ||
        controls.find((control) => control.getAttribute('role') === 'combobox') ||
        controls.find((control) => control instanceof HTMLInputElement)
      );
    }

    return (
      controls.find((control) => control instanceof HTMLInputElement && control.type !== 'datetime-local' && control.type !== 'date') ||
      controls.find((control) => control instanceof HTMLTextAreaElement)
    );
  };

  const fillField = (labels, value, kind = 'text') => {
    const root = findFieldRoot(labels);
    const control = chooseControl(root, kind);
    if (!control) return false;
    return setNativeValue(control, value);
  };

  const fillCategory = async (value) => {
    const label = CATEGORY_LABELS[value] || value;
    const root = findFieldRoot(['Category', '카테고리']);
    const control = chooseControl(root, 'category');

    if (!control) return false;

    let inputOk = false;

    if (control instanceof HTMLSelectElement) {
      const ok = setNativeValue(control, value);
      if (ok && control.value === value) return true;
    }

    if (control instanceof HTMLInputElement) {
      inputOk = setNativeValue(control, label);
    }

    control.click();
    await sleep(150);

    const options = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], li, button, div')).filter((element) => {
      const text = cleanText(element.textContent || '');
      return visible(element) && (text === cleanText(label) || text === cleanText(value));
    });

    if (options.length > 0) {
      options[0].click();
      await sleep(100);
      return true;
    }

    return inputOk;
  };

  const showNotice = (message) => {
    let notice = document.querySelector('[data-writer-bridge-notice]');
    if (!notice) {
      notice = document.createElement('div');
      notice.dataset.writerBridgeNotice = 'true';
      notice.style.cssText = [
        'position:fixed',
        'left:50%',
        'bottom:24px',
        'z-index:999999',
        'transform:translateX(-50%)',
        'max-width:min(520px,calc(100vw - 32px))',
        'padding:12px 16px',
        'border:1px solid #d5d9df',
        'background:#fff',
        'box-shadow:0 14px 34px rgba(15,23,42,.16)',
        'color:#202124',
        'font:14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      ].join(';');
      document.body.appendChild(notice);
    }
    notice.textContent = message;
  };

  let running = false;

  const importPendingEntry = async () => {
    if (running || !isNewBlogEntry()) return;

    const pending = getPending();
    if (!pending) return;

    running = true;
    showNotice('글쓰기 페이지의 초안을 CMS에 입력하는 중입니다.');

    for (let attempt = 0; attempt < 60; attempt += 1) {
      const titleOk = fillField(['Title', '제목'], pending.title || '', 'text');
      const descOk = fillField(['Description', '요약'], pending.description || pending.title || '', 'text');
      const dateOk = fillField(['Publish Date', 'Pub Date', '게시일'], pending.pubDate || '', 'date');
      const bodyOk = fillField(['Body', '본문'], pending.body || '', 'body');
      const categoryOk = await fillCategory(pending.category || 'notes');

      if (titleOk && descOk && dateOk && bodyOk) {
        localStorage.removeItem(PENDING_KEY);
        showNotice(categoryOk ? '초안을 CMS 새 글에 넣었습니다. 확인 후 Save를 눌러주세요.' : '초안을 넣었습니다. 카테고리만 확인 후 Save를 눌러주세요.');
        running = false;
        return;
      }

      await sleep(500);
    }

    showNotice('자동 입력을 끝내지 못했습니다. 글쓰기 페이지의 초안은 브라우저에 남아 있습니다.');
    running = false;
  };

  window.addEventListener('hashchange', importPendingEntry);
  window.addEventListener('load', importPendingEntry);
  const scheduleImport = () => {
    if (!getPending() || !isNewBlogEntry()) return;
    clearTimeout(window.__writerBridgeTimer);
    window.__writerBridgeTimer = setTimeout(importPendingEntry, 400);
  };
  new MutationObserver(scheduleImport).observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(importPendingEntry, 1200);
})();
