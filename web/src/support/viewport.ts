/// Works around iOS Home Screen apps reporting a viewport shorter than the
/// screen. With the status bar overlaid on the page (`black-translucent`),
/// iOS still subtracts the status bar's height from the layout viewport, so
/// anything pinned to `bottom: 0` floats that far above the bottom edge.
///
/// This measures the missing strip and publishes it as `--bottom-gap`, which
/// the bottom-anchored elements in styles.css push down by. Everywhere else
/// (Safari tabs, other browsers, or a fixed iOS) it measures 0 and nothing
/// moves.

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

let gap = 0;

export const bottomGap = () => gap;

function measure(): number {
  if ((navigator as NavigatorWithStandalone).standalone !== true) return 0;
  // iOS reports `screen` in portrait no matter how the phone is held.
  const portrait = window.matchMedia("(orientation: portrait)").matches;
  const long = Math.max(screen.width, screen.height);
  const short = Math.min(screen.width, screen.height);
  const missing = (portrait ? long : short) - window.innerHeight;
  // Only a status-bar-sized shortfall is this bug; anything bigger is
  // something else and better left alone.
  return missing > 0 && missing <= 80 ? missing : 0;
}

function update() {
  gap = measure();
  document.documentElement.style.setProperty("--bottom-gap", `${gap}px`);
}

export function fixStandaloneViewport() {
  update();
  window.addEventListener("orientationchange", () => window.setTimeout(update, 300));
  window.addEventListener("resize", update);
}
