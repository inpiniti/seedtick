(() => {
  const nav = document.querySelector("[data-nav]");
  const toggle = document.querySelector("[data-nav-toggle]");
  const langSwitcher = document.querySelector(".lang-switcher");

  if (nav && toggle) {
    const setOpen = (open) => {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    };

    toggle.addEventListener("click", () => {
      setOpen(!nav.classList.contains("is-open"));
    });

    nav.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("a")) {
        setOpen(false);
      }
    });

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (
        nav.classList.contains("is-open") &&
        target instanceof Node &&
        !nav.contains(target) &&
        !toggle.contains(target)
      ) {
        setOpen(false);
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 840) setOpen(false);
    });
  }

  if (langSwitcher) {
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (
        langSwitcher.open &&
        target instanceof Node &&
        !langSwitcher.contains(target)
      ) {
        langSwitcher.open = false;
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (langSwitcher?.open) langSwitcher.open = false;
    if (nav?.classList.contains("is-open")) {
      nav.classList.remove("is-open");
      toggle?.setAttribute("aria-expanded", "false");
      toggle?.focus();
    }
  });
})();
