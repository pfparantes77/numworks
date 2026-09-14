(() => {
  "use strict";

  const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    || window.matchMedia("(pointer: coarse)").matches;

  if (!IS_MOBILE) return;

  // Em dispositivos móveis não forçamos o Fullscreen API.
  // Alguns navegadores Android podem tornar o iframe da NumWorks instável
  // quando a página entra em fullscreen programaticamente.
  try {
    if (Element.prototype.requestFullscreen) {
      Element.prototype.requestFullscreen = function () {
        return Promise.resolve();
      };
    }
  } catch {}
})();
