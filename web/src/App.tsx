import { useEffect, useState, type ReactNode } from "react";
import { requestPersistentStorage } from "./db";
import { configureAudioSession, prepareFeedback } from "./support/feedback";
import { keys, useSetting } from "./support/settings";
import { defaultAccentHex, type ThemeAppearance } from "./support/theme";
import { BooksIcon, GraduationCapIcon, ListRectangleIcon } from "./ui/icons";
import { NavStack, type PopToRootRequest } from "./ui/NavStack";
import { AccountView } from "./views/account/AccountView";
import { AvatarView } from "./views/account/AvatarView";
import { useAccount } from "./views/account/useAccount";
import { AssignmentsView } from "./views/assignments/AssignmentsView";
import { ExamsView } from "./views/exams/ExamsView";
import { SubjectsView } from "./views/subjects/SubjectsView";

/// Readable text on top of the accent colour — Yellow needs dark text.
function onAccentColor(hex: string): string {
  const value = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 186 ? "#000" : "#fff";
}

const tabs = ["assignments", "exams", "subjects", "account"] as const;
type Tab = (typeof tabs)[number];

/// The four tabs, each with its own navigation stack. As on iOS, tapping the
/// tab you're on goes back to its first screen; leaving a tab also sends it
/// back there, so coming back to Account shows Account, not the page that was
/// open before.
export function App() {
  const [accentHex] = useSetting(keys.accent, defaultAccentHex);
  const [appearance] = useSetting<ThemeAppearance>(keys.appearance, "system");
  const [showTabLabels] = useSetting(keys.showTabLabels, true);
  const [selected, setSelected] = useState<Tab>("assignments");
  const [popRequests, setPopRequests] = useState<Partial<Record<Tab, PopToRootRequest>>>({});

  const selectTab = (tab: Tab) => {
    // The tab being tapped if it's already showing, or the one being left.
    const target = tab === selected ? tab : selected;
    setPopRequests((current) => ({
      ...current,
      [target]: { id: (current[target]?.id ?? 0) + 1, animated: tab === selected },
    }));
    setSelected(tab);
  };
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
    subjects: <SubjectsView />,
    account: <AccountView />,
  };

  const items: { id: Tab; label: string; icon: (selected: boolean) => ReactNode }[] = [
    { id: "assignments", label: "Assignments", icon: (on) => <ListRectangleIcon size={26} filled={on} /> },
    { id: "exams", label: "Exams", icon: () => <GraduationCapIcon size={26} strokeWidth={1.8} /> },
    { id: "subjects", label: "Subjects", icon: () => <BooksIcon size={25} strokeWidth={1.8} /> },
    { id: "account", label: "Account", icon: () => <AvatarView {...avatar} size={26} /> },
  ];

  return (
    <div className="app">
      {tabs.map((tab) => (
        <div key={tab} className="tab-pane" hidden={tab !== selected}>
          <NavStack root={roots[tab]} popToRoot={popRequests[tab]} />
        </div>
      ))}

      <nav className={showTabLabels ? "tabbar glass" : "tabbar glass icons-only"}>
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
