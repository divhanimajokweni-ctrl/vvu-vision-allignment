/**
 * VVU · STUDIO — icon set (stroke-based, currentColor).
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 16, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export const FilesIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
);
export const SearchIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
);
export const GitIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="6" cy="6" r="3" /><circle cx="18" cy="18" r="3" /><path d="M6 9v6a3 3 0 0 0 3 3h6" /></svg>
);
export const PlayIcon = (p: IconProps) => (
  <svg {...base(p)}><polygon points="6 3 20 12 6 21 6 3" /></svg>
);
export const BugIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="8" y="6" width="8" height="14" rx="4" /><path d="M19 7l-3 2M5 7l3 2M19 19l-3-2M5 19l3-2M12 2v3" /></svg>
);
export const ShieldIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.7 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.5 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></svg>
);
export const LayersIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5" /><path d="m3 17 9 5 9-5" /></svg>
);
export const ExtIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
);
export const UserIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
);
export const SettingsIcon = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></svg>
);
export const ChevronIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>
);
export const XIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M18 6 6 18M6 6l12 12" /></svg>
);
export const SendIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M14.5 21.7a.5.5 0 0 0 .9 0l6.5-19a.5.5 0 0 0-.6-.6l-19 6.5a.5.5 0 0 0 0 .9l7.9 3.2a2 2 0 0 1 1.1 1.1z" /><path d="m21.9 2.1-10.9 10.9" /></svg>
);
export const TrashIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
);
export const HashIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" /></svg>
);
export const LockIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
);
export const TerminalIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 19h8" /><path d="m4 17 6-6-6-6" /></svg>
);
export const ChatIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
);
export const VideoIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 11" /><rect x="2" y="6" width="14" height="12" rx="2" /></svg>
);
export const MenuIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 6h18M3 12h18M3 18h18" /></svg>
);
export const RefreshIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></svg>
);
export const DownloadIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
);
export const CopyIcon = (p: IconProps) => (
  <svg {...base(p)}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
);
export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M20 6 9 17l-5-5" /></svg>
);
export const AlertIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3" /><path d="M12 9v4M12 17h.01" /></svg>
);
export const EditorLogo = (p: IconProps) => (
  <svg {...base(p)}><path d="M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.5.5v13a.5.5 0 0 0 .5.5H17a1 1 0 0 0 1-1v-2" /><path d="m13 8-4 4 4 4" /></svg>
);
export const SigmaIcon = (p: IconProps) => (
  <svg {...base(p)}><path d="M18 7V4H6l6 8-6 8h12v-3" /></svg>
);

export type IconName =
  | "files" | "search" | "git" | "play" | "bug" | "shield" | "layers"
  | "ext" | "user" | "settings" | "chevron" | "x" | "send" | "trash"
  | "hash" | "lock" | "terminal" | "chat" | "video" | "menu" | "refresh"
  | "download" | "copy" | "check" | "alert";

export function Icon({ name, ...props }: { name: IconName } & IconProps) {
  switch (name) {
    case "files": return <FilesIcon {...props} />;
    case "search": return <SearchIcon {...props} />;
    case "git": return <GitIcon {...props} />;
    case "play": return <PlayIcon {...props} />;
    case "bug": return <BugIcon {...props} />;
    case "shield": return <ShieldIcon {...props} />;
    case "layers": return <LayersIcon {...props} />;
    case "ext": return <ExtIcon {...props} />;
    case "user": return <UserIcon {...props} />;
    case "settings": return <SettingsIcon {...props} />;
    case "chevron": return <ChevronIcon {...props} />;
    case "x": return <XIcon {...props} />;
    case "send": return <SendIcon {...props} />;
    case "trash": return <TrashIcon {...props} />;
    case "hash": return <HashIcon {...props} />;
    case "lock": return <LockIcon {...props} />;
    case "terminal": return <TerminalIcon {...props} />;
    case "chat": return <ChatIcon {...props} />;
    case "video": return <VideoIcon {...props} />;
    case "menu": return <MenuIcon {...props} />;
    case "refresh": return <RefreshIcon {...props} />;
    case "download": return <DownloadIcon {...props} />;
    case "copy": return <CopyIcon {...props} />;
    case "check": return <CheckIcon {...props} />;
    case "alert": return <AlertIcon {...props} />;
  }
}
