/* Kept as a classic script so restricted browsers can load the diagnostics. */
(function () {
  'use strict';
  window.TelaoCompat = {
    decodeImage: function (image, milliseconds) {
      return new Promise(function (resolve, reject) {
        var settled=false,timer=setTimeout(function(){finish(new Error('A imagem não respondeu a tempo.'));},milliseconds||15000);
        function finish(error){if(settled)return;settled=true;clearTimeout(timer);if(image.removeEventListener){image.removeEventListener('load',loaded);image.removeEventListener('error',failed);}if(error)reject(error);else resolve();}
        function loaded(){finish();}
        function failed(){finish(new Error('Imagem indisponível.'));}
        if(typeof image.decode==='function'){Promise.resolve().then(function(){return image.decode();}).then(loaded,finish);return;}
        if(image.complete){if(image.naturalWidth)loaded();else failed();return;}
        image.addEventListener('load',loaded);image.addEventListener('error',failed);
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
