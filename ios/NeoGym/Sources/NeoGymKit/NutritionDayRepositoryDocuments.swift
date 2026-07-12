import Foundation

public extension NutritionFoodMealRepository {
    static let nutritionDaysIndexQuery = """
    query NutritionDaysIndex {
      nutritionDays(order_by: [{ logDate: desc }], limit: 14) {
        id
        logDate
        nutritionPlanId
        nutritionPlan {
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
          nutritionPlanFoods(order_by: [{ slotTime: asc }, { position: asc }, { id: asc }]) {
            id
            slotTime
            label
            position
            foodId
            grams
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
        nutritionLogMeals {
          id
          nutritionDayId
          mealId
          nutritionPlanMealId
          name
          slotTime
          position
          nutritionLogEntries {
            id
            nutritionPlanFoodId
            source
            grams
            position
            snapshotFoodName
            snapshotKcalPer100g
            snapshotFatPer100g
            snapshotCarbsPer100g
            snapshotProteinPer100g
            snapshotFiberPer100g
            snapshotSugarPer100g
          }
        }
        nutritionLogEntries(where: { nutritionLogMealId: { _is_null: true } }) {
          id
          nutritionPlanFoodId
          source
          grams
          position
          slotTime
          snapshotFoodName
          snapshotKcalPer100g
          snapshotFatPer100g
          snapshotCarbsPer100g
          snapshotProteinPer100g
          snapshotFiberPer100g
          snapshotSugarPer100g
        }
      }
      dailyEnergyEntries(order_by: { energyOn: desc }, limit: 14) {
        id
        energyOn
        activeKcal
        restingKcal
      }
    }
    """

    static let dailyIntakeLogQuery = """
    query DailyIntakeLog($date: date!) {
      nutritionDays(where: { logDate: { _eq: $date } }, limit: 1) {
        id
        logDate
        nutritionPlanId
        nutritionLogMeals(order_by: [{ slotTime: asc }, { position: asc }, { createdAt: asc }]) {
          id
          mealId
          nutritionPlanMealId
          name
          slotTime
          position
          nutritionLogEntries(order_by: [{ position: asc }, { createdAt: asc }]) {
            id
            nutritionDayId
            nutritionLogMealId
            nutritionPlanFoodId
            foodId
            source
            grams
            position
            slotTime
            snapshotFoodName
            snapshotKcalPer100g
            snapshotFatPer100g
            snapshotCarbsPer100g
            snapshotProteinPer100g
            snapshotFiberPer100g
            snapshotSugarPer100g
          }
        }
        nutritionLogEntries(
          where: { nutritionLogMealId: { _is_null: true } }
          order_by: [{ slotTime: asc }, { position: asc }, { createdAt: asc }]
        ) {
          id
          nutritionDayId
          nutritionLogMealId
          nutritionPlanFoodId
          foodId
          source
          grams
          position
          slotTime
          snapshotFoodName
          snapshotKcalPer100g
          snapshotFatPer100g
          snapshotCarbsPer100g
          snapshotProteinPer100g
          snapshotFiberPer100g
          snapshotSugarPer100g
        }
      }
      dailyEnergyEntries(where: { energyOn: { _eq: $date } }, limit: 1) {
        id
        energyOn
        activeKcal
        restingKcal
      }
      nutritionPlans(order_by: [{ name: asc }]) {
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
              grams
              position
              foodId
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
        nutritionPlanFoods(order_by: [{ slotTime: asc }, { position: asc }, { id: asc }]) {
          id
          slotTime
          label
          position
          foodId
          grams
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
      meals(order_by: [{ name: asc }]) {
        id
        name
        description
        mealIngredients(order_by: [{ position: asc }, { id: asc }]) {
          id
          grams
          position
          foodId
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
      foods(order_by: [{ isPublic: asc }, { name: asc }]) {
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
    """

    static let createNutritionDayMutation = """
    mutation CreateNutritionDay($object: nutritionDays_insert_input!) {
      insertNutritionDay(object: $object) {
        id
      }
    }
    """

    static let updateNutritionDayPlanMutation = """
    mutation UpdateNutritionDayPlan($id: uuid!, $nutritionPlanId: uuid) {
      updateNutritionDay(pk_columns: { id: $id }, _set: { nutritionPlanId: $nutritionPlanId }) {
        id
        nutritionPlanId
      }
    }
    """

    static let logFoodMutation = """
    mutation LogFood($object: nutritionLogEntries_insert_input!) {
      insertNutritionLogEntry(object: $object) {
        id
      }
    }
    """

    static let logMealMutation = """
    mutation LogMeal($object: nutritionLogMeals_insert_input!) {
      insertNutritionLogMeal(object: $object) {
        id
      }
    }
    """

    static let logSelectedPlanMutation = """
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
    """

    static let updateNutritionLogEntryMutation = """
    mutation UpdateNutritionLogEntry($id: uuid!, $set: nutritionLogEntries_set_input!) {
      updateNutritionLogEntry(pk_columns: { id: $id }, _set: $set) {
        id
      }
    }
    """

    static let updateNutritionLogMealMutation = """
    mutation UpdateNutritionLogMeal($id: uuid!, $set: nutritionLogMeals_set_input!) {
      updateNutritionLogMeal(pk_columns: { id: $id }, _set: $set) {
        id
      }
    }
    """

    static let deleteNutritionLogEntryMutation = """
    mutation DeleteNutritionLogEntry($id: uuid!) {
      deleteNutritionLogEntry(id: $id) {
        id
      }
    }
    """

    static let deleteNutritionLogMealMutation = """
    mutation DeleteNutritionLogMeal($id: uuid!) {
      deleteNutritionLogMeal(id: $id) {
        id
      }
    }
    """

    static let deleteNutritionDayMutation = """
    mutation DeleteNutritionDay($id: uuid!) {
      deleteNutritionDay(id: $id) {
        id
      }
    }
    """

    static func nutritionDayObject(date: String, nutritionPlanId: String? = nil) -> JSONValue {
        .object([
            "logDate": GraphQLScalars.date(date),
            "nutritionPlanId": nutritionPlanId.map(GraphQLScalars.uuid) ?? .null
        ])
    }

    static func logFoodObject(_ values: LogFoodValues) -> JSONValue {
        .object([
            "nutritionDayId": GraphQLScalars.uuid(values.dayId),
            "foodId": GraphQLScalars.uuid(values.foodId),
            "nutritionPlanFoodId": values.nutritionPlanFoodId.map(GraphQLScalars.uuid) ?? .null,
            "grams": .string(values.grams),
            "position": .number(Double(values.position)),
            "slotTime": GraphQLScalars.time(values.slotTime)
        ])
    }

    static func logAdHocFoodObject(_ values: LogAdHocFoodValues) -> JSONValue {
        .object([
            "nutritionDayId": GraphQLScalars.uuid(values.dayId),
            "source": .string(NutritionLogEntrySource.adHoc.rawValue),
            "snapshotFoodName": .string(values.draft.name),
            "snapshotKcalPer100g": .string(values.draft.macros.kcalPer100g),
            "snapshotFatPer100g": .string(values.draft.macros.grams.fatPer100g),
            "snapshotCarbsPer100g": .string(values.draft.macros.grams.carbsPer100g),
            "snapshotProteinPer100g": .string(values.draft.macros.grams.proteinPer100g),
            "snapshotFiberPer100g": .string(values.draft.macros.grams.fiberPer100g),
            "snapshotSugarPer100g": .string(values.draft.macros.grams.sugarPer100g),
            "grams": .string(values.draft.grams),
            "position": .number(Double(values.position)),
            "slotTime": GraphQLScalars.time(values.draft.slotTime)
        ])
    }

    static func logMealObject(_ values: LogMealValues) -> JSONValue {
        .object([
            "nutritionDayId": GraphQLScalars.uuid(values.dayId),
            "mealId": GraphQLScalars.uuid(values.meal.id),
            "nutritionPlanMealId": values.planSlot.map { GraphQLScalars.uuid($0.id) } ?? .null,
            "name": .string(values.name),
            "slotTime": GraphQLScalars.time(values.slotTime),
            "position": .number(Double(values.position)),
            "nutritionLogEntries": .object([
                "data": .array(values.meal.mealIngredients.enumerated().map { index, ingredient in
                    .object([
                        "nutritionDayId": GraphQLScalars.uuid(values.dayId),
                        "foodId": GraphQLScalars.uuid(ingredient.foodId),
                        "grams": ingredient.grams,
                        "position": .number(Double(index)),
                        "slotTime": GraphQLScalars.time(values.slotTime)
                    ])
                })
            ])
        ])
    }

    static func planLogMealObjects(_ values: [PlanLogMealInsertValues]) -> JSONValue {
        .array(values.map(planLogMealObject))
    }

    static func planLogEntryObjects(_ values: [PlanLogEntryInsertValues]) -> JSONValue {
        .array(values.map(planLogEntryObject))
    }

    static func planLogMealObject(_ values: PlanLogMealInsertValues) -> JSONValue {
        .object([
            "nutritionDayId": GraphQLScalars.uuid(values.dayId),
            "mealId": GraphQLScalars.uuid(values.mealId),
            "nutritionPlanMealId": GraphQLScalars.uuid(values.nutritionPlanMealId),
            "name": .string(values.name),
            "slotTime": GraphQLScalars.time(values.slotTime),
            "position": .number(Double(values.position)),
            "nutritionLogEntries": .object([
                "data": planLogEntryObjects(values.entries)
            ])
        ])
    }

    static func planLogEntryObject(_ values: PlanLogEntryInsertValues) -> JSONValue {
        var object: [String: JSONValue] = [
            "nutritionDayId": GraphQLScalars.uuid(values.dayId),
            "foodId": GraphQLScalars.uuid(values.foodId),
            "grams": values.grams,
            "position": .number(Double(values.position)),
            "slotTime": GraphQLScalars.time(values.slotTime)
        ]
        if let nutritionPlanFoodId = values.nutritionPlanFoodId {
            object["nutritionPlanFoodId"] = GraphQLScalars.uuid(nutritionPlanFoodId)
        }
        return .object(object)
    }

    static func logEntryUpdateSet(_ values: LogEntryUpdateValues) -> JSONValue {
        var set: [String: JSONValue] = [:]
        if let grams = values.grams { set["grams"] = .string(grams) }
        if let position = values.position { set["position"] = .number(Double(position)) }
        if let slotTime = values.slotTime { set["slotTime"] = GraphQLScalars.time(slotTime) }
        if let adHocDraft = values.adHocDraft {
            set["snapshotFoodName"] = .string(adHocDraft.name)
            set["snapshotKcalPer100g"] = .string(adHocDraft.macros.kcalPer100g)
            set["snapshotFatPer100g"] = .string(adHocDraft.macros.grams.fatPer100g)
            set["snapshotCarbsPer100g"] = .string(adHocDraft.macros.grams.carbsPer100g)
            set["snapshotProteinPer100g"] = .string(adHocDraft.macros.grams.proteinPer100g)
            set["snapshotFiberPer100g"] = .string(adHocDraft.macros.grams.fiberPer100g)
            set["snapshotSugarPer100g"] = .string(adHocDraft.macros.grams.sugarPer100g)
        }
        return .object(set)
    }

    static func logMealUpdateSet(_ values: LogMealUpdateValues) -> JSONValue {
        var set: [String: JSONValue] = [:]
        if let name = values.name { set["name"] = .string(name) }
        if let position = values.position { set["position"] = .number(Double(position)) }
        if let slotTime = values.slotTime { set["slotTime"] = GraphQLScalars.time(slotTime) }
        return .object(set)
    }
}
