import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import type { PlanLogMaterialization } from "@/lib/nutrition";

export const LogSelectedPlanMutation = graphql(`
  mutation LogSelectedPlan(
    $mealObjects: [nutritionLogMeals_insert_input!]!
    $entryObjects: [nutritionLogEntries_insert_input!]!
    $hasMealObjects: Boolean!
    $hasEntryObjects: Boolean!
  ) {
    insertNutritionLogMeals(objects: $mealObjects) @include(if: $hasMealObjects) {
      affected_rows
    }
    insertNutritionLogEntries(objects: $entryObjects) @include(if: $hasEntryObjects) {
      affected_rows
    }
  }
`);

export interface LogSelectedPlanResult {
  mealRows: number;
  entryRows: number;
}

type LogSelectedPlanMutationResult = {
  insertNutritionLogMeals?: { affected_rows?: number | null } | null;
  insertNutritionLogEntries?: { affected_rows?: number | null } | null;
};

type LogSelectedPlanMutationVariables = {
  mealObjects: PlanLogMaterialization["mealObjects"];
  entryObjects: PlanLogMaterialization["entryObjects"];
  hasMealObjects: boolean;
  hasEntryObjects: boolean;
};

export type LogSelectedPlanRequester = (
  document: TypedDocumentNode<LogSelectedPlanMutationResult, LogSelectedPlanMutationVariables>,
  variables: LogSelectedPlanMutationVariables,
) => Promise<LogSelectedPlanMutationResult>;

export async function logSelectedPlanMaterialization(
  materialization: PlanLogMaterialization,
  requester: LogSelectedPlanRequester = gqlRequest,
): Promise<LogSelectedPlanResult> {
  const document = LogSelectedPlanMutation as TypedDocumentNode<
    LogSelectedPlanMutationResult,
    LogSelectedPlanMutationVariables
  >;
  const result = await requester(document, {
    mealObjects: materialization.mealObjects,
    entryObjects: materialization.entryObjects,
    hasMealObjects: materialization.mealObjects.length > 0,
    hasEntryObjects: materialization.entryObjects.length > 0,
  });

  return {
    mealRows: result.insertNutritionLogMeals?.affected_rows ?? 0,
    entryRows: result.insertNutritionLogEntries?.affected_rows ?? 0,
  };
}
