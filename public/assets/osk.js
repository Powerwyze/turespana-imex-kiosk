(function (global) {
  let currentOpts = {
    targets: [],
    lang: "en",
    onSubmit: null
  };

  let boundElements = [];
  let activeInput = null;
  let oskEl = null;
  let isNumeric = false;
  let isCaps = false;

  const L = {
    en: { submitLabel: "Submit", submitAria: "Submit", space: "space" },
    es: { submitLabel: "Enviar", submitAria: "Enviar", space: "espacio" }
  };

  const LAYOUTS = {
    alpha: [
      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
      ['Shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'Backspace'],
      ['123', 'space', '.', '@', 'Enter']
    ],
    numeric: [
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
      ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
      ['#+=', '.', ',', '?', '!', "'", 'Backspace'],
      ['ABC', 'space', 'Enter']
    ]
  };

  const DOMAINS = {
    en: ['.com', '.net', '.org', '@gmail.com', '@yahoo.com', '@hotmail.com'],
    es: ['.com', '.es', '@gmail.com', '@hotmail.com', '@yahoo.com']
  };

  function createDOM() {
    if (oskEl) return oskEl;

    oskEl = document.createElement('div');
    oskEl.className = 'pw-osk';
    oskEl.setAttribute('role', 'dialog');
    oskEl.setAttribute('aria-modal', 'true');
    oskEl.setAttribute('aria-label', 'On-screen keyboard');

    const backdrop = document.createElement('div');
    backdrop.className = 'pw-osk__backdrop';
    backdrop.addEventListener('click', closeOSK);
    oskEl.appendChild(backdrop);

    const panel = document.createElement('div');
    panel.className = 'pw-osk__panel';
    
    const header = document.createElement('div');
    header.className = 'pw-osk__header';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'pw-osk__close';
    closeBtn.innerHTML = 'X';
    closeBtn.setAttribute('aria-label', 'Close keyboard');
    closeBtn.addEventListener('click', closeOSK);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    const domainsWrap = document.createElement('div');
    domainsWrap.className = 'pw-osk__domains';
    panel.appendChild(domainsWrap);

    const keysWrap = document.createElement('div');
    keysWrap.className = 'pw-osk__keys';
    panel.appendChild(keysWrap);

    oskEl.appendChild(panel);
    document.body.appendChild(oskEl);

    // Prevent touches on panel from stealing focus
    panel.addEventListener('mousedown', (e) => e.preventDefault());
    panel.addEventListener('touchstart', (e) => {
      // allow buttons to be pressed but stop focus steal
      if(e.target.closest('button')) return;
      e.preventDefault();
    }, {passive: false});

    return oskEl;
  }

  function renderKeys() {
    if (!oskEl) return;
    const keysWrap = oskEl.querySelector('.pw-osk__keys');
    keysWrap.innerHTML = '';

    const layout = isNumeric ? LAYOUTS.numeric : LAYOUTS.alpha;
    
    layout.forEach(row => {
      const rowEl = document.createElement('div');
      rowEl.className = 'pw-osk__row';
      
      row.forEach(key => {
        const btn = document.createElement('button');
        btn.className = 'pw-osk__key';
        btn.setAttribute('type', 'button');
        btn.setAttribute('tabindex', '-1');
        
        let val = key;
        if (!isNumeric && isCaps && key.length === 1 && /[a-z]/.test(key)) {
          val = key.toUpperCase();
        }

        if (key === 'space') {
          btn.classList.add('pw-osk__key--space');
          btn.innerHTML = '<span class="pw-osk__key-main"> </span><span class="pw-osk__key-sub">' + L[currentOpts.lang].space + '</span>';
        } else if (key === 'Shift') {
          btn.classList.add('pw-osk__key--special');
          if (isCaps) btn.classList.add('is-active');
          btn.textContent = key;
        } else if (key === '123' || key === 'ABC' || key === '#+=') {
          btn.classList.add('pw-osk__key--special');
          btn.textContent = key;
        } else if (key === 'Backspace') {
          btn.classList.add('pw-osk__key--special');
          btn.innerHTML = '&#9003;'; // HTML entity for backspace
        } else if (key === 'Enter') {
          btn.classList.add('pw-osk__key--enter');
          btn.innerHTML = '&#9166;'; // HTML entity for return symbol
          btn.setAttribute('aria-label', L[currentOpts.lang].submitAria);
        } else {
          btn.textContent = val;
        }

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          handleKey(key, val);
        });

        rowEl.appendChild(btn);
      });
      keysWrap.appendChild(rowEl);
    });
  }

  function renderDomains() {
    if (!oskEl) return;
    const domainsWrap = oskEl.querySelector('.pw-osk__domains');
    domainsWrap.innerHTML = '';
    
    if (activeInput && activeInput.type === 'email') {
      domainsWrap.style.display = 'flex';
      const domains = DOMAINS[currentOpts.lang] || DOMAINS.en;
      domains.forEach(d => {
        const btn = document.createElement('button');
        btn.className = 'pw-osk__domain';
        btn.setAttribute('type', 'button');
        btn.setAttribute('tabindex', '-1');
        btn.textContent = d;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          insertText(d);
        });
        domainsWrap.appendChild(btn);
      });
    } else {
      domainsWrap.style.display = 'none';
    }
  }

  function handleKey(key, val) {
    if (!activeInput) return;

    if (key === 'space') {
      insertText(' ');
    } else if (key === 'Backspace') {
      if (activeInput.value.length > 0) {
        activeInput.value = activeInput.value.slice(0, -1);
        triggerInputEvent();
      }
    } else if (key === 'Shift') {
      isCaps = !isCaps;
      renderKeys();
    } else if (key === '123' || key === '#+=') {
      isNumeric = true;
      renderKeys();
    } else if (key === 'ABC') {
      isNumeric = false;
      renderKeys();
    } else if (key === 'Enter') {
      if (currentOpts.onSubmit && activeInput.checkValidity()) {
        closeOSK();
        currentOpts.onSubmit();
      } else {
        // try to find next input
        const idx = boundElements.indexOf(activeInput);
        if (idx !== -1 && idx < boundElements.length - 1) {
          boundElements[idx + 1].focus();
        } else {
          closeOSK();
        }
      }
    } else {
      insertText(val);
      if (!isNumeric && isCaps) {
        isCaps = false;
        renderKeys();
      }
    }
  }

  function insertText(text) {
    if (!activeInput) return;
    // Max length check if needed
    if (activeInput.maxLength > 0 && activeInput.value.length >= activeInput.maxLength) return;
    activeInput.value += text;
    triggerInputEvent();
  }

  function triggerInputEvent() {
    if (!activeInput) return;
    activeInput.dispatchEvent(new Event('input', { bubbles: true }));
    activeInput.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function openOSK(inputEl) {
    activeInput = inputEl;
    // Suppress native keyboard
    activeInput.readOnly = true;
    
    createDOM();
    renderDomains();
    renderKeys();
    
    // Force reflow before adding active class
    void oskEl.offsetWidth;
    oskEl.classList.add('is-active');

    // Add osk-open class and set height variable
    document.body.classList.add('osk-open');
    const panelHeight = oskEl.querySelector('.pw-osk__panel').getBoundingClientRect().height;
    document.documentElement.style.setProperty('--osk-height', `${panelHeight}px`);

    // Ensure input is visible
    setTimeout(() => {
      activeInput.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 250);
  }

  function closeOSK() {
    if (oskEl) {
      oskEl.classList.remove('is-active');
    }
    document.body.classList.remove('osk-open');
    if (activeInput) {
      activeInput.readOnly = false;
      activeInput = null;
    }
  }

  function handleFocus(e) {
    openOSK(e.target);
  }

  function attach(opts) {
    currentOpts = { ...currentOpts, ...opts };
    
    // cleanup old
    boundElements.forEach(el => {
      el.removeEventListener('focus', handleFocus);
      el.removeEventListener('click', handleFocus);
    });
    boundElements = [];

    // bind new
    if (currentOpts.targets) {
      currentOpts.targets.forEach(sel => {
        const els = document.querySelectorAll(sel);
        els.forEach(el => {
          boundElements.push(el);
          el.addEventListener('focus', handleFocus);
          el.addEventListener('click', handleFocus);
        });
      });
    }

    // if already open and lang changed, re-render
    if (oskEl && oskEl.classList.contains('is-active')) {
      renderDomains();
      renderKeys();
    }
  }

  global.OSK = {
    attach: attach,
    close: closeOSK,
    setLang: function(lang) {
        currentOpts.lang = lang;
        if (oskEl && oskEl.classList.contains('is-active')) {
            renderDomains();
            renderKeys();
        }
    }
  };

})(window);