// src/components/common/ReportistLogo.tsx
// Backward-compatibility wrapper delegating to PenguinLogo

export {
  PenguinLogo as ReportistLogo,
  PenguinLogoBadge as ReportistLogoBadge,
} from "./PenguinLogo.tsx";
export type {
  PenguinLogoProps as ReportistLogoProps,
  PenguinLogoBadgeProps as ReportistLogoBadgeProps,
} from "./PenguinLogo.tsx";

export { default } from "./PenguinLogo.tsx";
