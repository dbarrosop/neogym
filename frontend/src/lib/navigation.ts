import type { LinkProps } from "@tanstack/react-router";
import { ChartLine, Dumbbell, type LucideIcon, Sun, UserRound, Utensils } from "lucide-react";

/**
 * The five top-level areas shared by web and iOS (see CLAUDE.md › UI design
 * system). Sections keep the same labels and order on both platforms.
 */
export type AreaId = "today" | "train" | "nutrition" | "progress" | "me";

export interface AreaSection {
  label: string;
  to: NonNullable<LinkProps["to"]>;
  /** Path prefixes that mark this section as active. */
  match: readonly string[];
}

export interface Area {
  id: AreaId;
  label: string;
  to: NonNullable<LinkProps["to"]>;
  Icon: LucideIcon;
  /** Path prefixes that belong to this area. */
  match: readonly string[];
  sections: readonly AreaSection[];
}

export const AREAS: readonly Area[] = [
  { id: "today", label: "Today", to: "/today", Icon: Sun, match: ["/today"], sections: [] },
  {
    id: "train",
    label: "Train",
    to: "/sessions",
    Icon: Dumbbell,
    match: ["/sessions", "/workouts", "/exercises"],
    sections: [
      { label: "Sessions", to: "/sessions", match: ["/sessions"] },
      { label: "Workouts", to: "/workouts", match: ["/workouts"] },
      { label: "Exercises", to: "/exercises", match: ["/exercises"] },
    ],
  },
  {
    id: "nutrition",
    label: "Nutrition",
    to: "/nutrition",
    Icon: Utensils,
    match: ["/nutrition"],
    sections: [
      { label: "Log", to: "/nutrition/days", match: ["/nutrition/days"] },
      { label: "Plans", to: "/nutrition/plans", match: ["/nutrition/plans"] },
      { label: "Foods", to: "/nutrition/foods", match: ["/nutrition/foods"] },
      { label: "Meals", to: "/nutrition/meals", match: ["/nutrition/meals"] },
    ],
  },
  {
    id: "progress",
    label: "Progress",
    to: "/progress",
    Icon: ChartLine,
    match: ["/progress"],
    sections: [
      { label: "Body", to: "/progress/body", match: ["/progress/body"] },
      { label: "Energy", to: "/progress/energy", match: ["/progress/energy"] },
    ],
  },
  {
    id: "me",
    label: "Me",
    to: "/journal",
    Icon: UserRound,
    match: ["/journal", "/profile"],
    sections: [
      { label: "Journal", to: "/journal", match: ["/journal"] },
      { label: "Account", to: "/profile", match: ["/profile"] },
    ],
  },
];

export function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function areaForPath(pathname: string): Area | undefined {
  return AREAS.find((area) => area.match.some((prefix) => matchesPrefix(pathname, prefix)));
}

export function getArea(id: AreaId): Area {
  const area = AREAS.find((candidate) => candidate.id === id);
  if (!area) {
    throw new Error(`Unknown area: ${id}`);
  }
  return area;
}

export function isSectionActive(section: AreaSection, pathname: string): boolean {
  return section.match.some((prefix) => matchesPrefix(pathname, prefix));
}

const TRAILING_SLASH = /\/$/;
const DAY_LOG_PATH = /^\/nutrition\/days\/[^/]+$/;

/**
 * True on a page reached straight from an area tab (e.g. /nutrition/foods or
 * a day log). The header tabs already say where you are, so the breadcrumb
 * trail is redundant there.
 */
export function isSectionLanding(pathname: string): boolean {
  const path = pathname.replace(TRAILING_SLASH, "") || "/";
  if (DAY_LOG_PATH.test(path)) {
    return true;
  }
  return AREAS.some(
    (area) => area.to === path || area.sections.some((section) => section.to === path),
  );
}

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /** List + detail layout: from 1100 px the list stays visible beside the detail. */
    splitView?: boolean;
  }
}
