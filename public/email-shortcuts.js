// Browser-only convenience controls; no email is submitted by a shortcut.
(function (root) {
  const domains = Object.freeze(['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com']);

  function withDomain(value, domain) {
    if (!domains.includes(domain)) throw new RangeError('Unsupported email shortcut');
    const localPart = String(value ?? '').trim().split('@')[0];
    // Require the name first, so normal keyboard typing never lands after a domain.
    return localPart ? `${localPart}@${domain}` : null;
  }

  function mount(container, input, status) {
    container.replaceChildren();
    for (const domain of domains) {
      const button = container.ownerDocument.createElement('button');
      button.type = 'button';
      button.textContent = '@' + domain;
      button.setAttribute('aria-label', 'Use @' + domain);
      button.addEventListener('click', () => {
        const next = withDomain(input.value, domain);
        if (next === null) {
          status.textContent = 'Type your email name first (the part before @), then choose an ending.';
        } else {
          input.value = next;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          status.textContent = '';
        }
        input.focus({ preventScroll: true });
      });
      container.appendChild(button);
    }
  }

  root.BarceloEmailShortcuts = Object.freeze({ domains, withDomain, mount });
})(typeof window === 'undefined' ? globalThis : window);
