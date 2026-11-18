import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronLeftIcon, SearchIcon } from "./icons";
import { GlassButton } from "./GlassButton";

/// A `NavigationStack`: screens push in from the right and pop back out, with
/// the one underneath sliding a little and dimming, like UIKit.

interface Navigation {
  push: (screen: ReactNode) => void;
  pop: () => void;
  canGoBack: boolean;
}

const NavigationContext = createContext<Navigation>({
  push: () => {},
  pop: () => {},
  canGoBack: false,
});

export const useNavigation = () => useContext(NavigationContext);

interface Entry {
  key: number;
  screen: ReactNode;
}

const popDuration = 360;

/// Asks a `NavStack` to go back to its first screen. Each new request needs
/// a new `id`. `animated` slides the current screen away as Back does; without
/// it the stack just resets, for a tab that isn't showing.
export interface PopToRootRequest {
  id: number;
  animated: boolean;
}

export function NavStack({ root, popToRoot }: { root: ReactNode; popToRoot?: PopToRootRequest }) {
  const nextKey = useRef(1);
  const [entries, setEntries] = useState<Entry[]>([{ key: 0, screen: root }]);
  const [pushed, setPushed] = useState<number | null>(null);
  const [popping, setPopping] = useState<number | null>(null);

  const push = useCallback((screen: ReactNode) => {
    const key = nextKey.current++;
    setEntries((current) => [...current, { key, screen }]);
    setPushed(key);
    setPopping(null);
  }, []);

  const pop = useCallback(() => {
    setEntries((current) => {
      if (current.length < 2) return current;
      const top = current[current.length - 1]!;
      setPopping(top.key);
      setPushed(null);
      window.setTimeout(() => {
        setEntries((latest) => latest.filter((entry) => entry.key !== top.key));
        setPopping((key) => (key === top.key ? null : key));
      }, popDuration);
      return current;
    });
  }, []);

  /// Back to the first screen in one go. Screens in between leave at once;
  /// only the one showing slides away.
  const popAll = useCallback((animated: boolean) => {
    setEntries((current) => {
      if (current.length < 2) return current;
      const first = current[0]!;
      if (!animated) {
        setPushed(null);
        setPopping(null);
        return [first];
      }
      const top = current[current.length - 1]!;
      setPopping(top.key);
      setPushed(null);
      window.setTimeout(() => {
        setEntries((latest) => latest.filter((entry) => entry.key !== top.key));
        setPopping((key) => (key === top.key ? null : key));
      }, popDuration);
      return [first, top];
    });
  }, []);

  const handled = useRef(popToRoot?.id);
  useEffect(() => {
    if (!popToRoot || popToRoot.id === handled.current) return;
    handled.current = popToRoot.id;
    popAll(popToRoot.animated);
  }, [popToRoot, popAll]);

  const top = entries.length - 1;

  return (
    <>
      {entries.map((entry, index) => {
        let animation = "";
        if (index === top) {
          if (entry.key === popping) animation = "pop-exit";
          else if (entry.key === pushed) animation = "push-enter";
        } else if (index === top - 1) {
          if (popping !== null) animation = "uncovered";
          else if (pushed !== null) animation = "covered";
        }
        const hidden = index < top - 1 || (index === top - 1 && popping === null && pushed === null);
        return (
          <StackEntry
            key={entry.key}
            animation={animation}
            hidden={hidden}
            navigation={{ push, pop, canGoBack: index > 0 }}
          >
            {entry.screen}
          </StackEntry>
        );
      })}
    </>
  );
}

function StackEntry({
  animation,
  hidden,
  navigation,
  children,
}: {
  animation: string;
  hidden: boolean;
  navigation: Navigation;
  children: ReactNode;
}) {
  const { push, pop, canGoBack } = navigation;
  const value = useMemo(() => ({ push, pop, canGoBack }), [push, pop, canGoBack]);
  return (
    <NavigationContext.Provider value={value}>
      <div className={`stack-entry ${animation}`} data-animation={animation} hidden={hidden}>
        {children}
      </div>
    </NavigationContext.Provider>
  );
}

/// One screen: a floating nav bar over a scrolling body, with an optional
/// large title that hands over to the inline one as you scroll.
export function Screen({
  title,
  large,
  plain,
  leading,
  trailing,
  search,
  children,
  overlay,
}: {
  title: string;
  /// `.navigationBarTitleDisplayMode(.large)`.
  large?: boolean;
  /// White background instead of grouped grey — for empty states.
  plain?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  search?: { value: string; onChange: (value: string) => void; prompt?: string };
  children: ReactNode;
  /// Rendered over the scroll view, not inside it — empty states.
  overlay?: ReactNode;
}) {
  const { pop, canGoBack } = useNavigation();
  const [scrolled, setScrolled] = useState(false);
  const [pastTitle, setPastTitle] = useState(!large);

  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const top = event.currentTarget.scrollTop;
    setScrolled(top > 2);
    if (large) setPastTitle(top > 40);
  };

  return (
    <div className={plain ? "screen plain" : "screen"}>
      <div className="scroll" onScroll={onScroll}>
        {large && <h1 className="large-title">{title}</h1>}
        {search && (
          <label className="search">
            <SearchIcon size={17} strokeWidth={2.2} />
            <input
              type="search"
              value={search.value}
              placeholder={search.prompt ?? "Search"}
              onChange={(event) => search.onChange(event.target.value)}
              enterKeyHint="search"
              autoCorrect="off"
            />
          </label>
        )}
        {children}
      </div>
      {overlay}
      <header className={scrolled ? "navbar scrolled" : "navbar"}>
        <div className="navbar-leading">
          {canGoBack && (
            <GlassButton onClick={pop} label="Back">
              <ChevronLeftIcon size={24} strokeWidth={2.2} />
            </GlassButton>
          )}
          {leading}
        </div>
        <div className={pastTitle ? "navbar-title" : "navbar-title hidden"}>{title}</div>
        <div className="navbar-trailing">{trailing}</div>
      </header>
    </div>
  );
}
