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
    onSuccess: (res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      // Exercise-detail pages render history derived from sessions. From a
      // workout-driven start, every exercise in the workout gains a new entry,
      // but we don't know their ids here — leave their caches alone and let
      // each detail page refetch lazily when next visited (the ["sessions"]
      // invalidation above already covers session lists). For the
      // exercise-driven start we know exactly which exercise's history just
      // changed, so target only that one.
      if (!("workoutId" in vars)) {
        queryClient.invalidateQueries({
          queryKey: ["exercises", "detail", vars.exerciseId],
        });
      }
      const id = res.insertWorkoutSession?.id;
      if (id) {
        navigate({ to: "/sessions/$sessionId", params: { sessionId: id } });
      } else {
        toast.error("Session created but the server didn't return an id");
        // Originating page (/workouts/$workoutId, /exercises/$exerciseId) is a
        // durable detail page — keep it on the Back stack per CLAUDE.md's
        // navigation convention. No `replace` here.
        navigate({ to: "/sessions" });
      }
    },
    onError: (e) => {
      toast.error(`Failed to start: ${e.message}`);
    },
  });
}
