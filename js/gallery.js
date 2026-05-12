/* =====================================================================
   Gallery — interaction layer (vanilla, framework-free)
   ===================================================================== */

(() => {
  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  /* ---------- Sticky nav state ---------- */
  const nav = $('.nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const burger = $('.nav__burger');
    burger?.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    });
    $$('.nav__menu a').forEach(a =>
      a.addEventListener('click', () => {
        nav.classList.remove('is-open');
        document.body.style.overflow = '';
      })
    );
  }

  /* ---------- Reveal on scroll ---------- */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    $$('.fade-up, .reveal-stagger').forEach(el => io.observe(el));
  } else {
    $$('.fade-up, .reveal-stagger').forEach(el => el.classList.add('is-in'));
  }

  /* ---------- Image zoom (detail page) ---------- */
  const frame = $('.detail__frame');
  if (frame) {
    frame.addEventListener('click', () => frame.classList.toggle('is-zoomed'));
    frame.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        frame.classList.toggle('is-zoomed');
      }
    });
    frame.setAttribute('tabindex', '0');
    frame.setAttribute('role', 'button');
    frame.setAttribute('aria-label', 'Zoom artwork');
  }

  /* ---------- Lightbox ---------- */
  const modal = $('.modal');
  if (modal) {
    const close = () => {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
    };
    $$('[data-lightbox]').forEach(el => {
      el.addEventListener('click', () => {
        modal.classList.add('is-open');
        document.body.style.overflow = 'hidden';
      });
    });
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    $('.modal__close')?.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  /* ---------- Auction countdown ---------- */
  const timer = $('.bid__timer');
  if (timer && timer.dataset.end) {
    const end = new Date(timer.dataset.end).getTime();
    const tpl = timer.innerHTML;
    const tick = () => {
      const diff = end - Date.now();
      if (diff <= 0) { timer.innerHTML = '<span><strong>Closed</strong><em>Auction</em></span>'; return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff / 3600000) % 24);
      const m = Math.floor((diff / 60000) % 60);
      const s = Math.floor((diff / 1000) % 60);
      const pad = n => String(n).padStart(2, '0');
      timer.innerHTML = `
        <span><strong>${pad(d)}</strong><em>Days</em></span>
        <span><strong>${pad(h)}</strong><em>Hours</em></span>
        <span><strong>${pad(m)}</strong><em>Min</em></span>
        <span><strong>${pad(s)}</strong><em>Sec</em></span>`;
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- Bid submission (mock, demo only) ---------- */
  const bidForm = $('.bid__form');
  if (bidForm) {
    bidForm.addEventListener('submit', e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(bidForm));
      const amount = Number(data.amount);
      const minimum = Number(bidForm.dataset.minimum || 0);
      if (!amount || amount < minimum) {
        alert(`Minimum bid is IDR ${minimum.toLocaleString('id-ID')}.`);
        return;
      }
      if (!data.justification || data.justification.trim().length < 12) {
        alert('Please share a short reflection on why you propose this price.');
        return;
      }
      const note = $('#bid-status');
      if (note) {
        note.hidden = false;
        note.textContent = 'Bid submitted for curatorial review. We will contact you shortly.';
      }
      bidForm.reset();
    });
  }

  /* ---------- Comment composer (mock) ---------- */
  const commentForm = $('#comment-form');
  if (commentForm) {
    commentForm.addEventListener('submit', e => {
      e.preventDefault();
      const text = commentForm.querySelector('textarea').value.trim();
      if (text.length < 4) return;
      const list = $('#comments-list');
      const item = document.createElement('article');
      item.className = 'comment';
      item.innerHTML = `
        <div class="comment__avatar" aria-hidden="true">Y</div>
        <div>
          <div class="comment__head">
            <span class="comment__name">You</span>
            <span class="comment__time">just now</span>
          </div>
          <p class="comment__body">${text.replace(/</g, '&lt;')}</p>
        </div>`;
      list.prepend(item);
      commentForm.reset();
    });
  }

  /* ---------- Tabs ---------- */
  $$('[role="tablist"]').forEach(list => {
    const tabs = $$('[role="tab"]', list);
    const panels = $$('[role="tabpanel"]', list.parentElement);
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.setAttribute('aria-selected', 'false'));
        panels.forEach(p => p.hidden = true);
        tab.setAttribute('aria-selected', 'true');
        const id = tab.getAttribute('aria-controls');
        $(`#${id}`).hidden = false;
      });
    });
  });

  /* ---------- Newsletter (mock) ---------- */
  $$('.newsletter').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const input = form.querySelector('input');
      if (!input.value) return;
      form.innerHTML = '<span style="padding:0.85rem 1rem;font-size:0.86rem;color:var(--ink-3);font-style:italic;">Thank you — your invitation will arrive shortly.</span>';
    });
  });

  /* ---------- Thumbnail switcher (detail page) ---------- */
  const thumbs = $$('.detail__thumb');
  if (thumbs.length) {
    const main = $('.detail__frame .canvas-art');
    thumbs.forEach(t => {
      t.addEventListener('click', () => {
        thumbs.forEach(x => x.setAttribute('aria-selected', 'false'));
        t.setAttribute('aria-selected', 'true');
        if (main) {
          main.style.opacity = '0';
          setTimeout(() => {
            main.className = `canvas-art ${t.dataset.variant || ''}`;
            main.dataset.overlay = t.dataset.overlay || main.dataset.overlay;
            main.style.opacity = '1';
          }, 220);
        }
      });
    });
  }

  /* ---------- Year ---------- */
  $$('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
})();
