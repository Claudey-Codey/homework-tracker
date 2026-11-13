import { useState } from "react";
import { checkOff, checkOn, completedAll } from "../support/feedback";
import { CheckCircleFillIcon, CircleIcon } from "./icons";

/// A tappable checkbox that pops, bounces, clicks and taps back when you use it.
/// Used both for whole assignments and for individual to-do items.
export function CheckBox({
  isOn,
  tint = "var(--accent)",
  size = 26,
  toggle,
}: {
  isOn: boolean;
  tint?: string;
  size?: number;
  /// Return true if this tick completed the very last outstanding item, which
  /// upgrades the feedback to the "all done" cue.
  toggle: () => boolean;
}) {
  const [pop, setPop] = useState(false);
  const [bounce, setBounce] = useState(0);

  const tapped = (event: React.MouseEvent) => {
    // The row's own "tap to edit" mustn't swallow taps aimed at the box.
    event.stopPropagation();
    const turningOn = !isOn;
    const finishedEverything = toggle();

    setPop(true);
    setBounce((n) => n + 1);
    // Settle back down a beat later so the overshoot is visible.
    window.setTimeout(() => setPop(false), 120);

    if (turningOn) {
      if (finishedEverything) completedAll();
      else checkOn();
    } else {
      checkOff();
    }
  };

  const classes = ["checkbox"];
  if (pop) classes.push("pop");
  if (bounce > 0) classes.push("bounce");

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={isOn}
      aria-label={isOn ? "Mark as not done" : "Mark as done"}
      className={classes.join(" ")}
      style={{ color: isOn ? "var(--green)" : tint }}
      onClick={tapped}
    >
      {/* Keyed so the bounce animation restarts on every tap. */}
      <span key={bounce} style={{ display: "flex" }}>
        {isOn ? <CheckCircleFillIcon size={size} /> : <CircleIcon size={size} />}
      </span>
    </button>
  );
}
