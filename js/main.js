document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");

  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      nav.classList.toggle("open");
      const expanded = nav.classList.contains("open");
      toggle.setAttribute("aria-expanded", expanded);
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && nav.classList.contains("open")) {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  const gallery = document.querySelector("#letter-gallery");
  const lightbox = document.querySelector("#letter-lightbox");
  if (gallery && lightbox) {
    const opens = [...gallery.querySelectorAll(".letter-open")];
    const shot = lightbox.querySelector(".lightbox-img");
    const closeBtn = lightbox.querySelector(".lightbox-close");
    const prevBtn = lightbox.querySelector(".lightbox-prev");
    const nextBtn = lightbox.querySelector(".lightbox-next");
    let index = 0;
    let lastFocus = null;

    const show = (next) => {
      index = (next + opens.length) % opens.length;
      const source = opens[index].querySelector("img");
      shot.src = source.currentSrc || source.src;
      shot.alt = source.alt;
    };

    const open = (start) => {
      lastFocus = document.activeElement;
      show(start);
      lightbox.hidden = false;
      document.body.style.overflow = "hidden";
      closeBtn.focus({ preventScroll: true });
    };

    const close = () => {
      lightbox.hidden = true;
      shot.removeAttribute("src");
      document.body.style.overflow = "";
      if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus({ preventScroll: true });
    };

    opens.forEach((button, i) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        open(i);
      });
    });
    closeBtn.addEventListener("click", close);
    prevBtn.addEventListener("click", () => show(index - 1));
    nextBtn.addEventListener("click", () => show(index + 1));
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) close();
    });
    document.addEventListener("keydown", (event) => {
      if (lightbox.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "ArrowRight") {
        show(index + 1);
      } else if (event.key === "ArrowLeft") {
        show(index - 1);
      } else if (event.key === "Tab") {
        const items = [prevBtn, nextBtn, closeBtn];
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  }
});