import { describe, expect, it } from "bun:test";
import { __testing } from "./breadcrumbs";

const labelsFor = (pathname: string) => __testing.trailFor(pathname).map((crumb) => crumb.label);

describe("nutrition breadcrumb routes", () => {
  it("builds the root and index trails", () => {
    expect(labelsFor("/nutrition")).toEqual(["Nutrition"]);
    expect(labelsFor("/nutrition/days")).toEqual(["Nutrition", "Days"]);
    expect(labelsFor("/nutrition/foods")).toEqual(["Nutrition", "Foods"]);
    expect(labelsFor("/nutrition/meals")).toEqual(["Nutrition", "Meals"]);
    expect(labelsFor("/nutrition/plans")).toEqual(["Nutrition", "Plans"]);
  });

  it("builds dynamic nutrition detail and edit trails", () => {
    expect(labelsFor("/nutrition/days/2026-06-25")).toEqual(["Nutrition", "Days", "Day"]);
    expect(labelsFor("/nutrition/foods/food-1/edit")).toEqual([
      "Nutrition",
      "Foods",
      "Food",
      "Edit",
    ]);
    expect(labelsFor("/nutrition/meals/meal-1/edit")).toEqual([
      "Nutrition",
      "Meals",
      "Meal",
      "Edit",
    ]);
    expect(labelsFor("/nutrition/plans/plan-1/edit")).toEqual([
      "Nutrition",
      "Plans",
      "Plan",
      "Edit",
    ]);
  });

  it("matches new routes as static paths instead of dynamic ids", () => {
    expect(__testing.matchPattern("/nutrition/foods/new")?.pattern).toBe("/nutrition/foods/new");
    expect(__testing.matchPattern("/nutrition/meals/new")?.pattern).toBe("/nutrition/meals/new");
    expect(__testing.matchPattern("/nutrition/plans/new")?.pattern).toBe("/nutrition/plans/new");
  });
});
