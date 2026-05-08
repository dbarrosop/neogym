import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { print } from "graphql";
import { nhost } from "./nhost/client";

export async function gqlRequest<TResult, TVariables>(
  document: TypedDocumentNode<TResult, TVariables>,
  variables?: TVariables,
): Promise<TResult> {
  const res = await nhost.graphql.request({
    query: print(document),
    variables: variables as Record<string, unknown> | undefined,
  });
  if (res.body.errors && res.body.errors.length > 0) {
    throw new Error(res.body.errors.map((e) => e.message).join("; "));
  }
  if (!res.body.data) {
    throw new Error("GraphQL response missing data");
  }
  return res.body.data as TResult;
}
