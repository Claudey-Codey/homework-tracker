import { useEffect, useState, type ReactNode } from "react";
import { requestPersistentStorage } from "./db";
import { configureAudioSession, prepareFeedback } from "./support/feedback";
import { keys, useSetting } from "./support/settings";
import { defaultAccentHex, type ThemeAppearance } from "./support/theme";
import { BooksIcon, GraduationCapIcon, ListRectangleIcon } from "./ui/icons";
import { NavStack } from "./ui/NavStack";
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

/// The four tabs, each with its own navigation stack that survives switching.
export function App() {
  const [accentHex] = useSetting(keys.accent, defaultAccentHex);
  const [appearance] = useSetting<ThemeAppearance>(keys.appearance, "system");
  const [showTabLabels] = useSetting(keys.showTabLabels, true);
  const [selected, setSelected] = useState<Tab>("assignments");
  const { avatar } = useAccount();

  // `.tint(...)` and `.preferredColorScheme(...)` for the whole app.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", accentHex);
    root.style.setProperty("--on-accent", onAccentColor(accentHex));
    if (appearance === "system") delete root.dataset.theme;
    else root.dataset.theme = appearance;
    // Keeps the status bar / browser chrome in step with the theme.
    const dark = appearance === "dark" ||
      (appearance === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#000000" : "#f2f2f7");
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
          <NavStack root={roots[tab]} />
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
            onClick={() => setSelected(item.id)}
          >
            {item.icon(item.id === selected)}
            {showTabLabels && <span>{item.label}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}
