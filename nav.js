/* Scouting Sprocket: hamburger drawer for the side navigation (tablets and phones).
   Works with the existing markup: <div class="layout"><aside class="sidebar">...</aside><main class="content">...</main></div>
   Load with: <script src="./nav.js" defer></script> */
(function () {
    "use strict";

    var side = document.querySelector(".layout > .sidebar");
    if (!side) return;

    var content = document.querySelector(".layout > .content");
    var query = window.matchMedia("(max-width: 1100px)");
    var open = false;

    if (!side.id) side.id = "site-nav";
    document.documentElement.classList.add("js-nav");

    // The bar shows which page you are on, taken from the active link
    var current = side.querySelector(".nav-link.active, [aria-current='page']");

    var bar = document.createElement("header");
    bar.className = "app-bar";

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "nav-toggle";
    toggle.setAttribute("aria-label", "Open menu");
    toggle.setAttribute("aria-controls", side.id);
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = '<span class="nav-toggle-bars" aria-hidden="true"></span>';

    var title = document.createElement("span");
    title.className = "app-bar-title";
    title.textContent = current ? current.textContent.trim() : document.title;

    bar.appendChild(toggle);
    bar.appendChild(title);

    var closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "nav-close";
    closeButton.setAttribute("aria-label", "Close menu");
    side.insertBefore(closeButton, side.firstChild);

    var scrim = document.createElement("div");
    scrim.className = "nav-scrim";
    scrim.setAttribute("aria-hidden", "true");

    document.body.insertBefore(bar, document.body.firstChild);
    document.body.appendChild(scrim);

    function setOpen(next, restoreFocus) {
        if (next === open) return;
        open = next;
        document.body.classList.toggle("nav-open", open);
        toggle.setAttribute("aria-expanded", String(open));

        // Keep keyboard and screen-reader focus inside the drawer while it is open
        [content, bar].forEach(function (el) {
            if (!el) return;
            if (open) el.setAttribute("inert", "");
            else el.removeAttribute("inert");
        });

        if (open) closeButton.focus();
        else if (restoreFocus !== false) toggle.focus();
    }

    toggle.addEventListener("click", function () { setOpen(true); });
    closeButton.addEventListener("click", function () { setOpen(false); });
    scrim.addEventListener("click", function () { setOpen(false); });

    side.addEventListener("click", function (event) {
        if (event.target.closest && event.target.closest("a")) setOpen(false, false);
    });

    document.addEventListener("keydown", function (event) {
        if (open && event.key === "Escape") setOpen(false);
    });

    // Swipe left on the drawer to close it
    var startX = null;
    side.addEventListener("touchstart", function (event) {
        startX = event.touches[0].clientX;
    }, { passive: true });
    side.addEventListener("touchend", function (event) {
        if (startX !== null && event.changedTouches[0].clientX - startX < -60) setOpen(false);
        startX = null;
    }, { passive: true });

    // Rotating or resizing up to the desktop layout resets the drawer
    function onBreakpoint(event) {
        if (!event.matches) setOpen(false, false);
    }
    if (query.addEventListener) query.addEventListener("change", onBreakpoint);
    else if (query.addListener) query.addListener(onBreakpoint);

    // Coming back via the browser's back button should not show an open drawer
    window.addEventListener("pageshow", function () { setOpen(false, false); });
})();