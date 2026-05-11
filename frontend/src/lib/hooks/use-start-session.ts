import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { graphql } from "@/gql";
import { gqlRequest } from "@/lib/graphql";

const StartSessionMutation = graphql(`
  mutation StartSession($obj: workoutSessions_insert_input!) {
    insertWorkoutSession(object: $obj) {
      id
    }
  }
`);

interface FromWorkout {
  workoutId: string;
  exercises: Array<{ exerciseId: string; position: number }>;
}

interface FromExercise {
  exerciseId: string;
}

export function useStartSession() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: FromWorkout | FromExercise) => {
      const startedAt = new Date().toISOString();
      const obj =
        "workoutId" in vars
          ? {
              workoutId: vars.workoutId,
              startedAt,
              workoutSessionExercises: { data: vars.exercises },
            }
          : {
              workoutId: null,
              startedAt,
              workoutSessionExercises: {
                data: [{ exerciseId: vars.exerciseId, position: 0 }],
              },
            };
      return gqlRequest(StartSessionMutation, { obj });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      // The exercise detail page renders this session in its history list;
      // matches the invalidation pattern in sessions/$sessionId.tsx so the
      // "started from exercise" flow stays consistent with in-session edits.
      queryClient.invalidateQueries({ queryKey: ["exercises", "detail"] });
      const id = res.insertWorkoutSession?.id;
      if (id) {
        navigate({ to: "/sessions/$sessionId", params: { sessionId: id } });
      } else {
        toast.error("Session created but the server didn't return an id");
        navigate({ to: "/sessions", replace: true });
      }
    },
    onError: (e) => {
      toast.error(`Failed to start: ${e.message}`);
    },
  });
}
