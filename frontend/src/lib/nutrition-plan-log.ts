import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";
import type { PlanLogMaterialization } from "@/lib/nutrition";

export const LogSelectedPlanMutation = graphql(`
  mutation LogSelectedPlan(
    $mealObjects: [nutritionLogMeals_insert_input!]!
    $entryObjects: [nutritionLogEntries_insert_input!]!
  ) {
    insertNutritionLogMeals(objects: $mealObjects) {
      affected_rows
    }
    insertNutritionLogEntries(objects: $entryObjects) {
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
  });

  return {
    mealRows: result.insertNutritionLogMeals?.affected_rows ?? 0,
    entryRows: result.insertNutritionLogEntries?.affected_rows ?? 0,
  };
}
