import type { SVGProps } from "react";

/// SF Symbols aren't available on the web, so the app uses Lucide (a close
/// match in weight and style) plus a few hand-drawn stand-ins for symbols
/// Lucide has no equivalent of, mostly the `.fill` variants.

export {
  Bell as BellIcon,
  Bold as BoldIcon,
  Camera as CameraIcon,
  Braces as CodeIcon,
  Check as CheckIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ChevronsUpDown as ChevronsUpDownIcon,
  CirclePlus as AddCircleIcon,
  CircleUser as PersonCircleIcon,
  Folder as FolderIcon,
  GraduationCap as GraduationCapIcon,
  Heading1 as TitleIcon,
  Heading2 as HeadingIcon,
  IdCard as PersonCardIcon,
  Image as PhotoIcon,
  Images as PhotoStackIcon,
  Import as ImportIcon,
  Italic as ItalicIcon,
  LayoutGrid as GridIcon,
  LibraryBig as BooksIcon,
  List as BulletListIcon,
  ListChecks as ChecklistIcon,
  ListOrdered as NumberedListIcon,
  Lock as LockIcon,
  Menu as ReorderIcon,
  Moon as MoonIcon,
  NotebookText as NoteIcon,
  FileText as PdfIcon,
  Pencil as PencilIcon,
  RotateCcw as ResetIcon,
  Plus as PlusIcon,
  Search as SearchIcon,
  Settings as GearIcon,
  Share as ShareIcon,
  Smile as SmileIcon,
  SquarePen as ComposeIcon,
  Sun as SunIcon,
  TextQuote as QuoteIcon,
  Trash2 as TrashIcon,
  Type as TextFormatIcon,
  Undo2 as UndoIcon,
  Upload as UploadIcon,
} from "lucide-react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, children, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...props}>
      {children}
    </svg>
  );
}

/// list.bullet.rectangle — the Assignments tab.
export function ListRectangleIcon({ filled, ...props }: IconProps & { filled?: boolean }) {
  const stroke = filled ? "var(--tab-icon-fg, #fff)" : "currentColor";
  return (
    <Svg {...props}>
      <rect x="2.5" y="4" width="19" height="16" rx="3.5"
        fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" />
      {[9, 12, 15].map((y) => (
        <g key={y}>
          <circle cx="7" cy={y} r="1.05" fill={stroke} />
          <line x1="9.6" y1={y} x2="17.5" y2={y} stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </g>
      ))}
    </Svg>
  );
}

/// circle — an unticked checkbox.
export function CircleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  );
}

/// checkmark.circle.fill — a ticked checkbox.
export function CheckCircleFillIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10.8" fill="currentColor" />
      <path d="M7.2 12.4l3.2 3.2 6.4-7" fill="none" stroke="#fff" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/// plus.circle.fill
export function PlusCircleFillIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10.8" fill="currentColor" />
      <path d="M12 7v10M7 12h10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

/// bell.fill
export function BellFillIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path fill="currentColor"
        d="M12 2.5a6.2 6.2 0 0 0-6.2 6.2v3.9L4.1 15.4c-.5.8.1 1.8 1 1.8h13.8c.9 0 1.5-1 1-1.8l-1.7-2.8V8.7A6.2 6.2 0 0 0 12 2.5zM9.3 18.6a2.8 2.8 0 0 0 5.4 0z" />
    </Svg>
  );
}

/// ellipsis.circle
export function EllipsisCircleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9.8" fill="none" stroke="currentColor" strokeWidth="1.7" />
      {[7.6, 12, 16.4].map((x) => (
        <circle key={x} cx={x} cy="12" r="1.35" fill="currentColor" />
      ))}
    </Svg>
  );
}

/// circle.lefthalf.filled — the "System" appearance.
export function HalfCircleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" />
    </Svg>
  );
}

/// The empty-state glyphs use the same icons, just big and thin.
export const emptyIconProps = { size: 52, strokeWidth: 1.4 };
