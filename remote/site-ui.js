/* BX layout navigation v0.26
 * Progressive enhancement: internal shortcuts open their target accordion.
 * Deliberately never alters pairing, streaming, controllers or credentials.
 */
(() => {
  "use strict";
  const links = Array.from(document.querySelectorAll('.bx-toplinks a[href^="#"],.bx-quicknav a[href^="#"],.bx-main-action[href^="#"],.bx-system-action[href^="#"],.bx-mobile-dock a[href^="#"]'));
  function reveal(hash) {
    if (!/^#[A-Za-z][A-Za-z0-9_-]{0,79}$/.test(hash)) return;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    if (target.tagName === "DETAILS") target.open = true;
    const containingDetails = target.closest("details");
    if (containingDetails) containingDetails.open = true;
    for (const link of document.querySelectorAll(".bx-toplinks a")) {
      if (link.getAttribute("href") === hash) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
  }
  for (const link of links) link.addEventListener("click", () => {
    reveal(link.getAttribute("href") || "");
  });
  if (window.location.hash) reveal(window.location.hash);
  window.addEventListener("hashchange", () => reveal(window.location.hash));
})();
