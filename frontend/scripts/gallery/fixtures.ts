import type { CaptureBackend } from "./backend";

// Plain, validated documents are tooling-only, outside the app's codegen inputs.
export const SEED_DOCUMENTS = {
  exercises: `mutation GalleryExercises($objects: [exercises_insert_input!]!) {
    insertExercises(objects: $objects) { returning { id name } }
  }`,
  workouts: `mutation GalleryWorkouts($object: workouts_insert_input!) {
    insertWorkout(object: $object) { id }
  }`,
  sessions: `mutation GallerySessions($objects: [workoutSessions_insert_input!]!) {
    insertWorkoutSessions(objects: $objects) { returning { id startedAt } }
  }`,
  foods: `mutation GalleryFoods($objects: [foods_insert_input!]!) {
    insertFoods(objects: $objects) { returning { id name } }
  }`,
  meals: `mutation GalleryMeal($object: meals_insert_input!) {
    insertMeal(object: $object) { id }
  }`,
  plan: `mutation GalleryPlan($object: nutritionPlans_insert_input!) {
    insertNutritionPlan(object: $object) { id }
  }`,
  days: `mutation GalleryDays($objects: [nutritionDays_insert_input!]!) {
    insertNutritionDays(objects: $objects) { returning { id logDate } }
  }`,
  entries: `mutation GalleryEntries($objects: [nutritionLogEntries_insert_input!]!) {
    insertNutritionLogEntries(objects: $objects) { affected_rows }
  }`,
  measurements: `mutation GalleryMeasurements($objects: [bodyMeasurements_insert_input!]!) {
    insertBodyMeasurements(objects: $objects) { affected_rows }
  }`,
  energy: `mutation GalleryEnergy($objects: [dailyEnergy_insert_input!]!) {
    insertDailyEnergyEntries(objects: $objects) { affected_rows }
  }`,
  journal: `mutation GalleryJournal($objects: [journalEntries_insert_input!]!) {
    insertJournalEntries(objects: $objects) { affected_rows }
  }`,
};

export interface FixtureIDs {
  session: string;
  workout: string;
  bench: string;
  day: string;
  today: string;
}

type NamedID = { id: string; name: string };

export function dateBefore(today: string, days: number): string {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function exerciseFixtures() {
  return [
    { name: "Bench press", muscle: "chest", equipment: "barbell", force: "push" },
    { name: "Dumbbell row", muscle: "middle_back", equipment: "dumbbell", force: "pull" },
    { name: "Back squat", muscle: "quadriceps", equipment: "barbell", force: "push" },
  ].map(({ name, muscle, equipment, force }) => ({
    name,
    primaryMuscleGroup: muscle,
    equipment,
    category: "strength",
    level: "intermediate",
    instructions: ["Brace, move through a comfortable range, and keep each repetition controlled."],
    strength: { data: { doubleWeight: equipment === "dumbbell", force, mechanic: "compound" } },
  }));
}

export function foodFixtures() {
  return [
    {
      name: "Rolled oats",
      kcalPer100g: 389,
      proteinPer100g: 17,
      carbsPer100g: 66,
      fatPer100g: 7,
      fiberPer100g: 10,
    },
    {
      name: "Greek yogurt",
      kcalPer100g: 73,
      proteinPer100g: 10,
      carbsPer100g: 4,
      fatPer100g: 2,
      fiberPer100g: 0,
    },
    {
      name: "Banana",
      kcalPer100g: 89,
      proteinPer100g: 1,
      carbsPer100g: 23,
      fatPer100g: 0.3,
      fiberPer100g: 3,
    },
    {
      name: "Chicken breast",
      kcalPer100g: 165,
      proteinPer100g: 31,
      carbsPer100g: 0,
      fatPer100g: 4,
      fiberPer100g: 0,
    },
    {
      name: "Brown rice",
      kcalPer100g: 123,
      proteinPer100g: 3,
      carbsPer100g: 26,
      fatPer100g: 1,
      fiberPer100g: 2,
    },
  ].map((food) => ({ ...food, sugarPer100g: food.name === "Banana" ? 12 : 1 }));
}

async function seedTraining(backend: CaptureBackend, today: string) {
  const { insertExercises } = await backend.query<{ insertExercises: { returning: NamedID[] } }>(
    SEED_DOCUMENTS.exercises,
    { objects: exerciseFixtures() },
  );
  const exercises = insertExercises.returning;
  const { insertWorkout } = await backend.query<{ insertWorkout: { id: string } }>(
    SEED_DOCUMENTS.workouts,
    {
      object: {
        name: "Full body A",
        description: "Three controlled working sets per movement. Rest 90 seconds between sets.",
        workoutExercises: {
          data: exercises.map((exercise, position) => ({ exerciseId: exercise.id, position })),
        },
      },
    },
  );
  const sessions = Array.from({ length: 21 }, (_, index) => ({
    workoutId: insertWorkout.id,
    startedAt: `${dateBefore(today, index * 3)}T08:30:00Z`,
    workoutSessionExercises: {
      data: exercises.map((exercise, position) => ({
        exerciseId: exercise.id,
        position,
        ...(index === 0 && position > 0
          ? {}
          : {
              workoutSessionStrengthSets: {
                data: Array.from({ length: index === 0 ? 1 : 3 }, (_, set) => ({
                  setNumber: set + 1,
                  reps: 10 - set,
                  weight: ([60, 24, 80][position] ?? 60) - Math.floor(index / 5) * 2.5,
                })),
              },
            }),
      })),
    },
  }));
  const { insertWorkoutSessions } = await backend.query<{
    insertWorkoutSessions: { returning: { id: string; startedAt: string }[] };
  }>(SEED_DOCUMENTS.sessions, { objects: sessions });
  const current = insertWorkoutSessions.returning.find((session) =>
    session.startedAt.startsWith(today),
  );
  if (!current || !exercises[0]) {
    throw new Error("Gallery training fixtures are incomplete");
  }
  return { session: current.id, workout: insertWorkout.id, bench: exercises[0].id };
}

async function seedNutrition(backend: CaptureBackend, today: string) {
  const { insertFoods } = await backend.query<{ insertFoods: { returning: NamedID[] } }>(
    SEED_DOCUMENTS.foods,
    { objects: foodFixtures() },
  );
  const [oats, yogurt, banana, chicken, rice] = foodFixtures().map((food) => {
    const saved = insertFoods.returning.find((row) => row.name === food.name);
    if (!saved) {
      throw new Error("Gallery food fixture missing");
    }
    return saved.id;
  });
  const { insertMeal: breakfast } = await backend.query<{ insertMeal: { id: string } }>(
    SEED_DOCUMENTS.meals,
    {
      object: {
        name: "Breakfast bowl",
        description: "Oats, yogurt and banana.",
        mealIngredients: {
          data: [
            { foodId: oats, grams: 60, position: 0 },
            { foodId: yogurt, grams: 170, position: 1 },
            { foodId: banana, grams: 100, position: 2 },
          ],
        },
      },
    },
  );
  const { insertMeal: lunch } = await backend.query<{ insertMeal: { id: string } }>(
    SEED_DOCUMENTS.meals,
    {
      object: {
        name: "Chicken & rice",
        description: "A simple post-training lunch.",
        mealIngredients: {
          data: [
            { foodId: chicken, grams: 180, position: 0 },
            { foodId: rice, grams: 200, position: 1 },
          ],
        },
      },
    },
  );
  const { insertNutritionPlan } = await backend.query<{ insertNutritionPlan: { id: string } }>(
    SEED_DOCUMENTS.plan,
    {
      object: {
        name: "Training day",
        description: "Fictional example plan for the web gallery.",
        nutritionPlanMeals: {
          data: [
            { mealId: breakfast.id, slotTime: "07:15", position: 0 },
            { mealId: lunch.id, slotTime: "12:30", position: 0 },
          ],
        },
        nutritionPlanFoods: {
          data: [{ foodId: banana, grams: 120, slotTime: "16:00", position: 0 }],
        },
      },
    },
  );
  const { insertNutritionDays } = await backend.query<{
    insertNutritionDays: { returning: { id: string; logDate: string }[] };
  }>(SEED_DOCUMENTS.days, {
    objects: Array.from({ length: 35 }, (_, index) => ({
      logDate: dateBefore(today, index),
      nutritionPlanId: insertNutritionPlan.id,
    })),
  });
  await backend.query(SEED_DOCUMENTS.entries, {
    objects: insertNutritionDays.returning.flatMap((day) => [
      {
        nutritionDayId: day.id,
        foodId: oats,
        grams: 60,
        position: 0,
        slotTime: "07:15",
        source: "food",
      },
      {
        nutritionDayId: day.id,
        foodId: yogurt,
        grams: 170,
        position: 1,
        slotTime: "07:15",
        source: "food",
      },
      ...(day.logDate === today
        ? []
        : [
            {
              nutritionDayId: day.id,
              foodId: chicken,
              grams: 180,
              position: 2,
              slotTime: "12:30",
              source: "food",
            },
            {
              nutritionDayId: day.id,
              foodId: rice,
              grams: 240,
              position: 3,
              slotTime: "12:30",
              source: "food",
            },
          ]),
    ]),
  });
  const current = insertNutritionDays.returning.find((day) => day.logDate === today);
  if (!current) {
    throw new Error("Gallery nutrition fixture missing");
  }
  return current.id;
}

export async function seedFixtures(backend: CaptureBackend, today: string): Promise<FixtureIDs> {
  // Every insert uses the new account's real bearer and user permissions. No admin
  // secret, SQL, public writes, upserts, or shared-data resets are used.
  const training = await seedTraining(backend, today);
  const day = await seedNutrition(backend, today);
  await backend.query(SEED_DOCUMENTS.measurements, {
    objects: Array.from({ length: 36 }, (_, index) => ({
      measuredOn: dateBefore(today, index),
      weightKg: 81.2 + index * 0.025 + Math.sin(index) * 0.3,
      bodyFatPct: 19.5 + index * 0.015,
      notes: index % 3 === 0 ? "Imported from Apple Health" : "Morning measurement",
    })),
  });
  await backend.query(SEED_DOCUMENTS.energy, {
    objects: Array.from({ length: 35 }, (_, index) => ({
      energyOn: dateBefore(today, index),
      activeKcal: index === 0 ? 240 : 450 + (index % 5) * 85,
      restingKcal: index === 0 ? 780 : 1750 + (index % 3) * 25,
      notes: "Imported from Apple Health",
    })),
  });
  await backend.query(SEED_DOCUMENTS.journal, {
    objects: [
      {
        entryDate: today,
        title: "A steady start",
        body: "## Training\nControlled repetitions and a comfortable pace.\n\n- Prepare breakfast\n- Take a short walk",
        journalEntryLabels: { data: [{ label: { data: { name: "Training" } } }] },
      },
      {
        entryDate: dateBefore(today, 2),
        title: "Recovery day",
        body: "A light walk and an early night. Ready for the next session.",
      },
    ],
  });
  return { ...training, today, day };
}
