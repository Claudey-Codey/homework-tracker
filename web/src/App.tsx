import { useEffect, useRef, useState, type ReactNode } from "react";
import { requestPersistentStorage } from "./db";
import { configureAudioSession, prepareFeedback } from "./support/feedback";
import { keys, useSetting } from "./support/settings";
import { defaultAccentHex, type ThemeAppearance } from "./support/theme";
import { GraduationCapIcon, ListRectangleIcon } from "./ui/icons";
import { NavStack, type PopToRootRequest } from "./ui/NavStack";
import { AccountView } from "./views/account/AccountView";
import { AvatarView } from "./views/account/AvatarView";
import { useAccount } from "./views/account/useAccount";
import { AssignmentsView } from "./views/assignments/AssignmentsView";
import { ExamsView } from "./views/exams/ExamsView";

/// Readable text on top of the accent colour — Yellow needs dark text.
function onAccentColor(hex: string): string {
  const value = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 186 ? "#000" : "#fff";
}

const tabs = ["assignments", "exams", "account"] as const;
type Tab = (typeof tabs)[number];

/// How long the tab being opened takes to fade in over the one being left,
/// matching `.tab-pane.entering` in styles.css.
const tabFadeDuration = 220;

/// The three tabs, each with its own navigation stack. As on iOS, tapping the
/// tab you're on goes back to its first screen; leaving a tab also sends it
/// back there, so coming back to Account shows Account, not the page that was
/// open before. Switching tabs cross-fades the pages and slides the tab bar's
/// highlight across, as UITabBarController does.
export function App() {
  const [accentHex] = useSetting(keys.accent, defaultAccentHex);
  const [appearance] = useSetting<ThemeAppearance>(keys.appearance, "system");
  const [showTabLabels] = useSetting(keys.showTabLabels, true);
  const [selected, setSelected] = useState<Tab>("assignments");
  const [popRequests, setPopRequests] = useState<Partial<Record<Tab, PopToRootRequest>>>({});

  // The tab fading out underneath the one being opened, while it does.
  const [leaving, setLeaving] = useState<Tab | null>(null);
  const pendingReset = useRef<{ tab: Tab; timer: number } | null>(null);
  // The highlight only swells once a tab has been switched, not on launch.
  const hasSwitched = useRef(false);

  const popToRoot = (tab: Tab, animated: boolean) =>
    setPopRequests((current) => ({
      ...current,
      [tab]: { id: (current[tab]?.id ?? 0) + 1, animated },
    }));

  const selectTab = (tab: Tab) => {
    if (tab === selected) {
      popToRoot(tab, true);
      return;
    }
    // The tab being left goes back to its first page once it has faded out,
    // so it doesn't visibly jump there during the fade. A tab left by an
    // earlier, unfinished switch resets now, unless it's being reopened.
    const pending = pendingReset.current;
    if (pending) {
      window.clearTimeout(pending.timer);
      if (pending.tab !== tab) popToRoot(pending.tab, false);
    }
    const left = selected;
    hasSwitched.current = true;
    pendingReset.current = {
      tab: left,
      timer: window.setTimeout(() => {
        pendingReset.current = null;
        setLeaving(null);
        popToRoot(left, false);
      }, tabFadeDuration),
    };
    setLeaving(left);
    setSelected(tab);
  };
  useEffect(() => () => window.clearTimeout(pendingReset.current?.timer), []);
  const { avatar } = useAccount();

  // `.tint(...)` and `.preferredColorScheme(...)` for the whole app.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", accentHex);
    root.style.setProperty("--on-accent", onAccentColor(accentHex));
    if (appearance === "system") delete root.dataset.theme;
    else root.dataset.theme = appearance;

    // Keeps the status bar / browser chrome in step with the theme. On the
    // Home Screen the status bar is opaque and painted this colour, so it
    // also has to follow the phone switching between light and dark.
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
    const paintStatusBar = () => {
      const dark = appearance === "dark" || (appearance === "system" && systemDark.matches);
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#000000" : "#f2f2f7");
    };
    paintStatusBar();
    systemDark.addEventListener("change", paintStatusBar);
    return () => systemDark.removeEventListener("change", paintStatusBar);
  }, [accentHex, appearance]);

  useEffect(() => {
    configureAudioSession();
    requestPersistentStorage();
    // iOS only lets audio start inside a user gesture, so warm it on the first one.
    const warm = () => prepareFeedback();
    window.addEventListener("pointerdown", warm, { once: true });
    return () => window.removeEventListener("pointerdown", warm);
  }, []);

  const roots: Record<Tab, ReactNode> = {
    assignments: <AssignmentsView />,
    exams: <ExamsView />,
    account: <AccountView />,
  };

  const items: { id: Tab; label: string; icon: (selected: boolean) => ReactNode }[] = [
    { id: "assignments", label: "Assignments", icon: (on) => <ListRectangleIcon size={26} filled={on} /> },
    { id: "exams", label: "Exams", icon: () => <GraduationCapIcon size={26} strokeWidth={1.8} /> },
    { id: "account", label: "Account", icon: () => <AvatarView {...avatar} size={26} /> },
  ];

  return (
    <div className="app">
      {tabs.map((tab) => (
        <div
          key={tab}
          className={tab === selected && leaving !== null ? "tab-pane entering" : "tab-pane"}
          hidden={tab !== selected && tab !== leaving}
        >
          <NavStack root={roots[tab]} popToRoot={popRequests[tab]} />
        </div>
      ))}

      <nav className={showTabLabels ? "tabbar glass" : "tabbar glass icons-only"}>
        <span
          className="tab-highlight-slot"
          style={{ transform: `translateX(${tabs.indexOf(selected) * 100}%)` }}
          aria-hidden="true"
        >
          {/* Keyed by tab so the swell replays on every move. */}
          <span key={selected} className={hasSwitched.current ? "tab-highlight swell" : "tab-highlight"} />
        </span>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === selected ? "tab selected" : "tab"}
            aria-label={item.label}
            aria-current={item.id === selected ? "page" : undefined}
            onClick={() => selectTab(item.id)}
          >
            {item.icon(item.id === selected)}
            {showTabLabels && <span>{item.label}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}
