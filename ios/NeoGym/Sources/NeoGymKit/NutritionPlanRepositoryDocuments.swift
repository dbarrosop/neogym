import Foundation

public extension NutritionFoodMealRepository {
    static let plansIndexQuery = """
    query PlansIndex {
      nutritionPlans(order_by: [{ updatedAt: desc }, { name: asc }]) {
        id
        name
        description
        nutritionPlanMeals(order_by: [{ slotTime: asc }, { position: asc }, { id: asc }]) {
          id
          slotTime
          label
          position
          mealId
          meal {
            id
            name
            description
            mealIngredients(order_by: [{ position: asc }, { id: asc }]) {
              id
              foodId
              grams
              position
              food {
                id
                name
                userId
                isPublic
                kcalPer100g
                fatPer100g
                carbsPer100g
                proteinPer100g
                fiberPer100g
                sugarPer100g
              }
            }
          }
        }
      }
    }
    """

    static let nutritionPlanDetailQuery = """
    query NutritionPlanDetail($id: uuid!) {
      nutritionPlan(id: $id) {
        id
        name
        description
        createdAt
        updatedAt
        nutritionPlanMeals(order_by: [{ slotTime: asc }, { position: asc }, { id: asc }]) {
          id
          slotTime
          label
          position
          mealId
          meal {
            id
            name
            description
            mealIngredients(order_by: [{ position: asc }, { id: asc }]) {
              id
              foodId
              grams
              position
              food {
                id
                name
                userId
                isPublic
                kcalPer100g
                fatPer100g
                carbsPer100g
                proteinPer100g
                fiberPer100g
                sugarPer100g
              }
            }
          }
        }
      }
    }
    """

    static let editNutritionPlanQuery = """
    query EditNutritionPlan($id: uuid!) {
      nutritionPlan(id: $id) {
        id
        name
        description
        nutritionPlanMeals(order_by: [{ slotTime: asc }, { position: asc }, { id: asc }]) {
          id
          mealId
          slotTime
          label
          position
        }
      }
    }
    """

    static let nutritionPlanFormMealsQuery = """
    query NutritionPlanFormMeals {
      meals(order_by: [{ name: asc }]) {
        id
        name
        description
        mealIngredients(order_by: [{ position: asc }, { id: asc }]) {
          id
          foodId
          grams
          position
          food {
            id
            name
            userId
            isPublic
            kcalPer100g
            fatPer100g
            carbsPer100g
            proteinPer100g
            fiberPer100g
            sugarPer100g
          }
        }
      }
    }
    """

    static let createNutritionPlanMutation = """
    mutation CreateNutritionPlan($object: nutritionPlans_insert_input!) {
      insertNutritionPlan(object: $object) {
        id
      }
    }
    """

    static let saveNutritionPlanMutation = """
    mutation SaveNutritionPlan(
      $id: uuid!
      $set: nutritionPlans_set_input!
      $deleteSlotIds: [uuid!]!
      $hasDeleteSlots: Boolean!
      $insertSlots: [nutritionPlanMeals_insert_input!]!
      $hasInsertSlots: Boolean!
      $slotUpdates: [nutritionPlanMeals_updates!]!
      $hasSlotUpdates: Boolean!
    ) {
      updateNutritionPlan(pk_columns: { id: $id }, _set: $set) {
        id
      }
      deleteNutritionPlanMeals(where: { id: { _in: $deleteSlotIds } })
        @include(if: $hasDeleteSlots) {
        affected_rows
      }
      insertNutritionPlanMeals(objects: $insertSlots) @include(if: $hasInsertSlots) {
        affected_rows
      }
      update_nutritionPlanMeals_many(updates: $slotUpdates) @include(if: $hasSlotUpdates) {
        affected_rows
      }
    }
    """

    static let deleteNutritionPlanMutation = """
    mutation DeleteNutritionPlan($id: uuid!) {
      deleteNutritionPlan(id: $id) {
        id
      }
    }
    """

    static func nutritionPlanObject(_ values: NutritionPlanFormValues) -> JSONValue {
        .object([
            "name": .string(values.name),
            "description": values.description.isEmpty ? .null : .string(values.description),
            "nutritionPlanMeals": .object([
                "data": .array(values.slots.map { slot in
                    .object([
                        "mealId": GraphQLScalars.uuid(slot.mealId),
                        "slotTime": GraphQLScalars.time(slot.slotTime),
                        "label": slot.label.isEmpty ? .null : .string(slot.label),
                        "position": .number(Double(slot.position))
                    ])
                })
            ])
        ])
    }

    static func saveNutritionPlanVariables(
        id: String,
        initialValues: NutritionPlanFormValues,
        values: NutritionPlanFormValues
    ) -> [String: JSONValue] {
        let existingById = Dictionary(uniqueKeysWithValues: initialValues.slots.compactMap { slot in
            slot.id.map { ($0, slot) }
        })
        var preservedIds = Set<String>()
        var insertSlots: [JSONValue] = []
        var slotUpdates: [JSONValue] = []

        for slot in values.slots {
            let label: JSONValue = slot.label.isEmpty ? .null : .string(slot.label)
            if let slotId = slot.id,
               let existing = existingById[slotId],
               existing.mealId == slot.mealId {
                preservedIds.insert(slotId)
                slotUpdates.append(.object([
                    "where": .object(["id": .object(["_eq": GraphQLScalars.uuid(slotId)])]),
                    "_set": .object([
                        "slotTime": GraphQLScalars.time(slot.slotTime),
                        "label": label,
                        "position": .number(Double(slot.position))
                    ])
                ]))
            } else {
                insertSlots.append(.object([
                    "nutritionPlanId": GraphQLScalars.uuid(id),
                    "mealId": GraphQLScalars.uuid(slot.mealId),
                    "slotTime": GraphQLScalars.time(slot.slotTime),
                    "label": label,
                    "position": .number(Double(slot.position))
                ]))
            }
        }

        let deleteSlotIds = existingById.keys.filter { !preservedIds.contains($0) }.sorted()
        return [
            "id": GraphQLScalars.uuid(id),
            "set": .object([
                "name": .string(values.name),
                "description": values.description.isEmpty ? .null : .string(values.description)
            ]),
            "deleteSlotIds": .array(deleteSlotIds.map(GraphQLScalars.uuid)),
            "hasDeleteSlots": .bool(!deleteSlotIds.isEmpty),
            "insertSlots": .array(insertSlots),
            "hasInsertSlots": .bool(!insertSlots.isEmpty),
            "slotUpdates": .array(slotUpdates),
            "hasSlotUpdates": .bool(!slotUpdates.isEmpty)
        ]
    }
}

