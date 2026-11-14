import { describe, expect, it } from "bun:test";
import { areaForPath, getArea, isSectionActive, isSectionLanding } from "./navigation";

describe("area navigation", () => {
  it("maps area-scoped paths to their area", () => {
    expect(areaForPath("/train/sessions/s-1")?.id).toBe("train");
    expect(areaForPath("/train/exercises")?.id).toBe("train");
    expect(areaForPath("/nutrition/log/2026-11-12")?.id).toBe("nutrition");
    expect(areaForPath("/progress/muscles")?.id).toBe("progress");
    expect(areaForPath("/me/account")?.id).toBe("me");
    expect(areaForPath("/sessions")).toBeUndefined();
  });

  it("marks the Log section active on any day", () => {
    const log = getArea("nutrition").sections.find((section) => section.label === "Log");
    expect(log && isSectionActive(log, "/nutrition/log/2026-11-12")).toBe(true);
  });

  it("opens Progress on Overview, its first section", () => {
    const progress = getArea("progress");
    expect(progress.to).toBe("/progress/overview");
    expect(progress.sections.map((section) => section.label)).toEqual([
      "Overview",
      "Muscles",
      "Strength",
      "Body",
      "Energy",
    ]);
    expect(progress.sections[0]?.to).toBe(progress.to);
    const overview = progress.sections[0];
    expect(overview && isSectionActive(overview, "/progress/overview")).toBe(true);
    expect(overview && isSectionActive(overview, "/progress/muscles")).toBe(false);
    expect(areaForPath("/progress/overview")?.id).toBe("progress");
    expect(isSectionLanding("/progress/overview")).toBe(true);
  });

  it("treats tab destinations and day logs as section landings", () => {
    expect(isSectionLanding("/train/workouts")).toBe(true);
    expect(isSectionLanding("/nutrition/log/2026-11-12")).toBe(true);
    expect(isSectionLanding("/me/account/")).toBe(true);
    expect(isSectionLanding("/train/workouts/w-1/edit")).toBe(false);
  });
});
