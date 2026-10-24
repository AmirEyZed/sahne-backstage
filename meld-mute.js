// Stream Wall — keeps the Meld chat widgets silent inside the wall (in Meld/OBS they play as
// designed). Runs in the page's own JS world before the widget's script, only in wall frames.
// Some chat widgets pop a Web Audio chime on every message; an AudioContext
// that stays suspended makes no sound, and any <audio>/<video> it plays starts muted.
(() => {
  if (window === window.top) return;
  let ancestors;
  try {
    ancestors = location.ancestorOrigins;
  } catch {
    return;
  }
  if (!ancestors || !ancestors.length || !ancestors[ancestors.length - 1].startsWith('chrome-extension://')) return;

  const Native = window.AudioContext || window.webkitAudioContext;
  if (Native) {
    class SilentAudioContext extends Native {
      constructor(...args) {
        super(...args);
        super.suspend().catch(() => {});
      }
      resume() {
        return Promise.resolve();
      }
    }
    window.AudioContext = SilentAudioContext;
    if (window.webkitAudioContext) window.webkitAudioContext = SilentAudioContext;
  }
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    this.muted = true;
    return play.apply(this, arguments);
  };
})();
