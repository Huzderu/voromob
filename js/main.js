/* VoroMob – menu, looping videos, gallery filter + lightbox, contact message composer. No cookies, no storage. */
(() => {
  const d = document;
  d.documentElement.classList.add("js");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- mobile menu ---- */
  const toggle = d.querySelector(".nav-toggle");
  const setMenu = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    d.body.classList.toggle("nav-open", open);
  };
  if (toggle) {
    toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
    d.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && d.body.classList.contains("nav-open")) { setMenu(false); toggle.focus(); }
    });
  }

  /* ---- muted looping videos: play only while visible; never autoplay with reduced motion ---- */
  d.querySelectorAll("video[data-autoplay]").forEach((video) => {
    const button = d.querySelector(`[data-video-toggle][aria-controls="${video.id}"]`);
    let userPaused = reduceMotion;
    // the hero keeps its first-frame picture visible until the video has a frame of its own (CSS .has-frame)
    const hasFrame = () => video.classList.add("has-frame");
    if (video.readyState >= 2) hasFrame();
    else video.addEventListener("loadeddata", hasFrame, { once: true });
    const sync = () => button && button.classList.toggle("is-paused", video.paused);
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    if (button) {
      button.hidden = false;
      sync();
      button.addEventListener("click", () => {
        if (video.paused) { userPaused = false; video.play().catch(() => {}); }
        else { userPaused = true; video.pause(); }
      });
    }
    new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !userPaused) video.play().catch(() => {});
        else if (!entry.isIntersecting) video.pause();
      });
    }, { threshold: 0.3 }).observe(video);
  });

  /* ---- gallery: category filter ---- */
  const gallery = d.querySelector("[data-gallery]");
  const chips = [...d.querySelectorAll("[data-filter]")];
  const cards = gallery ? [...gallery.querySelectorAll(".card")] : [];
  const categories = chips.map((c) => c.dataset.filter);
  const applyFilter = (cat) => {
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.filter === cat)));
    cards.forEach((card) => { card.hidden = cat !== "toate" && !card.dataset.cats.split(" ").includes(cat); });
  };
  chips.forEach((chip) => chip.addEventListener("click", () => {
    applyFilter(chip.dataset.filter);
    history.replaceState(null, "", chip.dataset.filter === "toate" ? location.pathname : `#${chip.dataset.filter}`);
  }));

  /* ---- gallery: lightbox (one project at a time; arrows, keys and swipe move between its photos) ---- */
  const dialog = d.querySelector(".lightbox");
  const dataEl = d.getElementById("projects-data");
  if (gallery && dialog && dataEl) {
    const projects = Object.fromEntries(JSON.parse(dataEl.textContent).map((p) => [p.id, p]));
    const q = (sel) => dialog.querySelector(sel);
    const media = q("[data-lb-media]");
    let project = null;
    let index = 0;
    let opener = null;

    const render = () => {
      const item = project.items[index];
      media.replaceChildren();
      let el;
      if (item.type === "video") {
        el = d.createElement("video");
        Object.assign(el, { src: item.src, poster: item.poster, controls: true, playsInline: true, muted: true, loop: true, preload: "metadata" });
        if (!reduceMotion) el.autoplay = true;
      } else {
        el = d.createElement("img");
        Object.assign(el, { src: item.src, alt: `${project.title}, fotografia ${index + 1}`, decoding: "async" });
      }
      el.width = item.w;
      el.height = item.h;
      media.append(el);
      q("[data-lb-title]").textContent = project.title;
      q("[data-lb-meta]").textContent = project.meta;
      q("[data-lb-desc]").textContent = project.desc;
      q("[data-lb-count]").textContent = project.items.length > 1 ? `${index + 1} / ${project.items.length}` : "";
      const many = project.items.length > 1;
      dialog.querySelectorAll("[data-lb-step]").forEach((b) => { b.hidden = !many; });
      // warm the cache for the next photo
      const next = project.items[(index + 1) % project.items.length];
      if (many && next.type === "img") { const pre = new Image(); pre.src = next.src; }
    };
    const step = (delta) => {
      if (!project || project.items.length < 2) return;
      index = (index + delta + project.items.length) % project.items.length;
      render();
    };
    const open = (id, from) => {
      project = projects[id];
      if (!project) return;
      index = 0;
      opener = from || null;
      render();
      if (!dialog.open) dialog.showModal();
      d.body.classList.add("lb-open");
      history.replaceState(null, "", `#${id}`);
    };
    dialog.addEventListener("close", () => {
      media.replaceChildren();
      d.body.classList.remove("lb-open");
      history.replaceState(null, "", location.pathname);
      if (opener) opener.focus();
    });
    q("[data-lb-close]").addEventListener("click", () => dialog.close());
    dialog.querySelectorAll("[data-lb-step]").forEach((b) => b.addEventListener("click", () => step(Number(b.dataset.lbStep))));
    dialog.addEventListener("click", (e) => { if (e.target === dialog || e.target === media) dialog.close(); });
    dialog.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    });
    let touchX = null;
    media.addEventListener("pointerdown", (e) => { touchX = e.clientX; });
    media.addEventListener("pointerup", (e) => {
      if (touchX !== null && Math.abs(e.clientX - touchX) > 50) step(e.clientX < touchX ? 1 : -1);
      touchX = null;
    });
    gallery.addEventListener("click", (e) => {
      const link = e.target.closest("[data-project]");
      if (!link) return;
      e.preventDefault();
      open(link.dataset.project, link);
    });

    // deep links: proiecte.html#<project id> opens it, proiecte.html#<category> filters.
    // Also on hashchange, because a link to #<id> on this same page does not reload it.
    const route = () => {
      const hash = decodeURIComponent(location.hash.slice(1));
      if (categories.includes(hash)) applyFilter(hash);
      else if (projects[hash]) open(hash, d.querySelector(`[data-project="${CSS.escape(hash)}"]`));
    };
    route();
    addEventListener("hashchange", route);
  }

  /* ---- contact: compose a WhatsApp or e-mail message (nothing is sent to or stored by the site) ---- */
  const form = d.querySelector("[data-composer]");
  if (form) {
    const error = form.querySelector("[data-form-error]");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const val = (k) => String(f.get(k) || "").trim();
      const required = [form.elements.name, form.elements.message];
      const missing = required.filter((el) => !el.value.trim());
      required.forEach((el) => el.setAttribute("aria-invalid", String(missing.includes(el))));
      error.hidden = missing.length === 0;
      if (missing.length) { missing[0].focus(); return; }
      const lines = [`Bună ziua! Sunt ${val("name")}.`];
      if (val("type")) lines.push(`Aș dori: ${val("type").toLowerCase()}.`);
      if (val("dims")) lines.push(`Dimensiuni aproximative: ${val("dims")}.`);
      lines.push("", val("message"));
      const text = lines.join("\n");
      const via = e.submitter && e.submitter.value;
      if (via === "email" && form.dataset.email) {
        const subject = `Cerere ofertă – ${val("type") || "mobilier la comandă"}`;
        location.href = `mailto:${form.dataset.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
      } else {
        window.open(`https://wa.me/${form.dataset.whatsapp}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
      }
    });
  }
})();
