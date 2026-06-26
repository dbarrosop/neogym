import Foundation

public extension NutritionFoodMealRepository {
    static let foodsIndexQuery = """
    query FoodsIndex {
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

    static let foodDetailQuery = """
    query FoodDetail($id: uuid!) {
      food(id: $id) {
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
        createdAt
        updatedAt
      }
    }
    """

    static let editFoodQuery = """
    query EditFood($id: uuid!) {
      food(id: $id) {
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

    static let createFoodMutation = """
    mutation CreateFood($object: foods_insert_input!) {
      insertFood(object: $object) {
        id
      }
    }
    """

    static let saveFoodMutation = """
    mutation SaveFood($id: uuid!, $set: foods_set_input!) {
      updateFood(pk_columns: { id: $id }, _set: $set) {
        id
      }
    }
    """

    static let deleteFoodMutation = """
    mutation DeleteFood($id: uuid!) {
      deleteFood(id: $id) {
        id
      }
    }
    """

    static let mealsIndexQuery = """
    query MealsIndex {
      meals(order_by: [{ updatedAt: desc }, { name: asc }]) {
        id
        name
        description
        updatedAt
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
    """

    static let mealDetailQuery = """
    query MealDetail($id: uuid!) {
      meal(id: $id) {
        id
        name
        description
        createdAt
        updatedAt
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

    static let editMealQuery = """
    query EditMeal($id: uuid!) {
      meal(id: $id) {
        id
        name
        description
        mealIngredients(order_by: [{ position: asc }, { id: asc }]) {
          id
          foodId
          grams
          position
        }
      }
    }
    """

    static let mealFormFoodsQuery = """
    query MealFormFoods {
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

    static let createMealMutation = """
    mutation CreateMeal($object: meals_insert_input!) {
      insertMeal(object: $object) {
        id
      }
    }
    """

    static let saveMealMutation = """
    mutation SaveMeal(
      $id: uuid!
      $set: meals_set_input!
      $deleteIngredientIds: [uuid!]!
      $hasDeleteIngredients: Boolean!
      $insertIngredients: [mealIngredients_insert_input!]!
      $hasInsertIngredients: Boolean!
      $ingredientUpdates: [mealIngredients_updates!]!
      $hasIngredientUpdates: Boolean!
    ) {
      updateMeal(pk_columns: { id: $id }, _set: $set) {
        id
      }
      deleteMealIngredients(where: { id: { _in: $deleteIngredientIds } })
        @include(if: $hasDeleteIngredients) {
        affected_rows
      }
      insertMealIngredients(objects: $insertIngredients) @include(if: $hasInsertIngredients) {
        affected_rows
      }
      update_mealIngredients_many(updates: $ingredientUpdates) @include(if: $hasIngredientUpdates) {
        affected_rows
      }
    }
    """

    static let deleteMealMutation = """
    mutation DeleteMeal($id: uuid!) {
      deleteMeal(id: $id) {
        id
      }
    }
    """

    static func foodObject(_ values: FoodFormValues) -> JSONValue {
        .object([
            "name": .string(values.name),
            "kcalPer100g": .string(values.kcalPer100g),
            "fatPer100g": .string(values.fatPer100g),
            "carbsPer100g": .string(values.carbsPer100g),
            "proteinPer100g": .string(values.proteinPer100g),
            "fiberPer100g": .string(values.fiberPer100g),
            "sugarPer100g": .string(values.sugarPer100g)
        ])
    }

    static func mealObject(_ values: MealFormValues) -> JSONValue {
        .object([
            "name": .string(values.name),
            "description": values.description.isEmpty ? .null : .string(values.description),
            "mealIngredients": .object([
                "data": .array(values.ingredients.map { ingredient in
                    .object([
                        "foodId": GraphQLScalars.uuid(ingredient.foodId),
                        "grams": .string(ingredient.grams),
                        "position": .number(Double(ingredient.position))
                    ])
                })
            ])
        ])
    }

    static func saveMealVariables(
        id: String,
        initialValues: MealFormValues,
        values: MealFormValues
    ) -> [String: JSONValue] {
        let existingById = Dictionary(uniqueKeysWithValues: initialValues.ingredients.compactMap { ingredient in
            ingredient.id.map { ($0, ingredient) }
        })
        var preservedIds = Set<String>()
        var insertIngredients: [JSONValue] = []
        var ingredientUpdates: [JSONValue] = []

        for ingredient in values.ingredients {
            if let ingredientId = ingredient.id,
               let existing = existingById[ingredientId],
               existing.foodId == ingredient.foodId {
                preservedIds.insert(ingredientId)
                ingredientUpdates.append(.object([
                    "where": .object(["id": .object(["_eq": GraphQLScalars.uuid(ingredientId)])]),
                    "_set": .object([
                        "grams": .string(ingredient.grams),
                        "position": .number(Double(ingredient.position))
                    ])
                ]))
            } else {
                insertIngredients.append(.object([
                    "mealId": GraphQLScalars.uuid(id),
                    "foodId": GraphQLScalars.uuid(ingredient.foodId),
                    "grams": .string(ingredient.grams),
                    "position": .number(Double(ingredient.position))
                ]))
            }
        }

        let deleteIngredientIds = existingById.keys.filter { !preservedIds.contains($0) }.sorted()
        return [
            "id": GraphQLScalars.uuid(id),
            "set": .object([
                "name": .string(values.name),
                "description": values.description.isEmpty ? .null : .string(values.description)
            ]),
            "deleteIngredientIds": .array(deleteIngredientIds.map(GraphQLScalars.uuid)),
            "hasDeleteIngredients": .bool(!deleteIngredientIds.isEmpty),
            "insertIngredients": .array(insertIngredients),
            "hasInsertIngredients": .bool(!insertIngredients.isEmpty),
            "ingredientUpdates": .array(ingredientUpdates),
            "hasIngredientUpdates": .bool(!ingredientUpdates.isEmpty)
        ]
    }
}

public enum NutritionFoodMealErrorMapper {
    public static func foodMessage(for error: Error) -> String {
        let domainError = GraphQLDomainError.map(error)
        if isFoodInUse(domainError) {
            return "This food is used by a meal template. Remove it from meals before deleting it."
        }
        return domainError.localizedDescription
    }

    public static func mealMessage(for error: Error) -> String {
        let domainError = GraphQLDomainError.map(error)
        if isMealInUseByPlan(domainError) {
            return "This meal is used by a nutrition plan. Remove it from plan slots before deleting it. Logged days do not block deletion."
        }
        return domainError.localizedDescription
    }

    private static func isFoodInUse(_ error: GraphQLDomainError) -> Bool {
        if NutritionMath.isFoodInUseError(error.localizedDescription) { return true }
        guard case let .graphQLErrors(details) = error else { return false }
        return details.contains { detail in
            let constraint = detail.constraintName?.lowercased() ?? ""
            return constraint.contains("meal_ingredients")
                || constraint.contains("nutrition_log_entries")
                || NutritionMath.isFoodInUseError(detail.message)
        }
    }

    private static func isMealInUseByPlan(_ error: GraphQLDomainError) -> Bool {
        if NutritionMath.isMealInUseByPlanError(error.localizedDescription) { return true }
        guard case let .graphQLErrors(details) = error else { return false }
        return details.contains { detail in
            let constraint = detail.constraintName?.lowercased() ?? ""
            return constraint.contains("nutrition_plan_meals")
                || NutritionMath.isMealInUseByPlanError(detail.message)
        }
    }
}
