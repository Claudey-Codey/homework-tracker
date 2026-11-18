import { keys, readSetting } from "./settings";

/// Sound + haptics for ticking things off, behind a single "Sounds & Haptics"
/// switch in Settings (defaulting to on).
///
/// Sounds go through Web Audio rather than `<audio>`: iOS ignores an audio
/// element's volume and adds a noticeable delay before it plays.

type NavigatorWithAudioSession = Navigator & { audioSession?: { type: string } };

let context: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();

const isEnabled = () => readSetting(keys.feedbackEnabled, true);

/// Called once at launch. "ambient" keeps the app respectful — on iOS it
/// honours the silent switch and won't interrupt music already playing.
export function configureAudioSession() {
  const session = (navigator as NavigatorWithAudioSession).audioSession;
  if (session) session.type = "ambient";
}

function audioContext(): AudioContext | null {
  if (context) return context;
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  context = new Context();
  // Fetch both sounds up front so the first tick isn't silent.
  for (const name of ["tick", "complete"]) void load(name);
  return context;
}

async function load(name: string) {
  if (!context || buffers.has(name)) return;
  try {
    const response = await fetch(`./sounds/${name}.wav`);
    buffers.set(name, await context.decodeAudioData(await response.arrayBuffer()));
  } catch {
    // No sound is better than a crash.
  }
}

function play(name: string) {
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const buffer = buffers.get(name);
  if (!buffer) {
    void load(name);
    return;
  }
  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  gain.gain.value = 0.55;
  source.buffer = buffer;
  source.connect(gain).connect(ctx.destination);
  source.start();
}

/// Safari has no vibration API, but tapping an `<input switch>` makes iOS 18+
/// play its own toggle haptic — so a hidden one is clicked on our behalf.
/// Elsewhere `navigator.vibrate` does the job.
let hapticLabel: HTMLLabelElement | null = null;

function haptic(pattern: number | number[] = 10) {
  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
    return;
  }
  if (!hapticLabel) {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.id = "donedey-haptic";
    hapticLabel = document.createElement("label");
    hapticLabel.htmlFor = input.id;
    hapticLabel.style.display = "none";
    hapticLabel.appendChild(input);
    document.body.appendChild(hapticLabel);
  }
  hapticLabel.click();
}

/// Warms the audio context on the first touch, which iOS requires.
export function prepareFeedback() {
  if (isEnabled()) audioContext();
}

export function checkOn() {
  if (!isEnabled()) return;
  play("tick");
  haptic(10);
}

export function checkOff() {
  if (!isEnabled()) return;
  haptic(6);
}

/// Clearing the last item in a to-do list earns a bit more fanfare.
export function completedAll() {
  if (!isEnabled()) return;
  play("complete");
  haptic([12, 60, 18]);
}
