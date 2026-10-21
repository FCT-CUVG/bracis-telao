/* Kept as a classic script so restricted browsers can load the diagnostics. */
(function () {
  'use strict';
  window.TelaoCompat = {
    decodeImage: function (image) {
      if (typeof image.decode === 'function') return image.decode();
      return new Promise(function (resolve, reject) {
        if (image.complete) { if (image.naturalWidth) resolve(); else reject(new Error('Imagem indisponível.')); return; }
        function clean() { image.removeEventListener('load', loaded); image.removeEventListener('error', failed); }
        function loaded() { clean(); resolve(); }
        function failed() { clean(); reject(new Error('Imagem indisponível.')); }
        image.addEventListener('load', loaded); image.addEventListener('error', failed);
      });
    },
    timeoutSignal: function (milliseconds) {
      if (window.AbortSignal && typeof window.AbortSignal.timeout === 'function') return window.AbortSignal.timeout(milliseconds);
      if (!window.AbortController) return undefined;
      var controller = new window.AbortController();
      setTimeout(function () { controller.abort(); }, milliseconds);
      return controller.signal;
    }
  };
}());
