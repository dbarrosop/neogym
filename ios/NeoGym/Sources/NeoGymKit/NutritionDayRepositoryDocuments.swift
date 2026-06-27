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
        }
        nutritionLogMeals {
          id
          nutritionLogEntries {
            id
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
            foodId
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
          foodId
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
            "grams": .string(values.grams),
            "position": .number(Double(values.position)),
            "slotTime": GraphQLScalars.time(values.slotTime)
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

    static func logEntryUpdateSet(_ values: LogEntryUpdateValues) -> JSONValue {
        var set: [String: JSONValue] = [:]
        if let grams = values.grams { set["grams"] = .string(grams) }
        if let position = values.position { set["position"] = .number(Double(position)) }
        if let slotTime = values.slotTime { set["slotTime"] = GraphQLScalars.time(slotTime) }
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
