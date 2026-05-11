/* eslint-disable */
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  date: { input: any; output: any; }
  jsonb: { input: any; output: any; }
  numeric: { input: any; output: any; }
  timestamptz: { input: any; output: any; }
  uuid: { input: any; output: any; }
};

/** Boolean expression to compare columns of type "Boolean". All fields are combined with logical 'AND'. */
export type Boolean_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['Boolean']['input']>;
  _gt?: InputMaybe<Scalars['Boolean']['input']>;
  _gte?: InputMaybe<Scalars['Boolean']['input']>;
  _in?: InputMaybe<Array<Scalars['Boolean']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['Boolean']['input']>;
  _lte?: InputMaybe<Scalars['Boolean']['input']>;
  _neq?: InputMaybe<Scalars['Boolean']['input']>;
  _nin?: InputMaybe<Array<Scalars['Boolean']['input']>>;
};

/** Boolean expression to compare columns of type "Int". All fields are combined with logical 'AND'. */
export type Int_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['Int']['input']>;
  _gt?: InputMaybe<Scalars['Int']['input']>;
  _gte?: InputMaybe<Scalars['Int']['input']>;
  _in?: InputMaybe<Array<Scalars['Int']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['Int']['input']>;
  _lte?: InputMaybe<Scalars['Int']['input']>;
  _neq?: InputMaybe<Scalars['Int']['input']>;
  _nin?: InputMaybe<Array<Scalars['Int']['input']>>;
};

/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
export type String_Array_Comparison_Exp = {
  /** is the array contained in the given array value */
  _contained_in?: InputMaybe<Array<Scalars['String']['input']>>;
  /** does the array contain the given value */
  _contains?: InputMaybe<Array<Scalars['String']['input']>>;
  _eq?: InputMaybe<Array<Scalars['String']['input']>>;
  _gt?: InputMaybe<Array<Scalars['String']['input']>>;
  _gte?: InputMaybe<Array<Scalars['String']['input']>>;
  _in?: InputMaybe<Array<Array<Scalars['String']['input']>>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Array<Scalars['String']['input']>>;
  _lte?: InputMaybe<Array<Scalars['String']['input']>>;
  _neq?: InputMaybe<Array<Scalars['String']['input']>>;
  _nin?: InputMaybe<Array<Array<Scalars['String']['input']>>>;
};

/** Boolean expression to compare columns of type "String". All fields are combined with logical 'AND'. */
export type String_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['String']['input']>;
  _gt?: InputMaybe<Scalars['String']['input']>;
  _gte?: InputMaybe<Scalars['String']['input']>;
  /** does the column match the given case-insensitive pattern */
  _ilike?: InputMaybe<Scalars['String']['input']>;
  _in?: InputMaybe<Array<Scalars['String']['input']>>;
  /** does the column match the given POSIX regular expression, case insensitive */
  _iregex?: InputMaybe<Scalars['String']['input']>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  /** does the column match the given pattern */
  _like?: InputMaybe<Scalars['String']['input']>;
  _lt?: InputMaybe<Scalars['String']['input']>;
  _lte?: InputMaybe<Scalars['String']['input']>;
  _neq?: InputMaybe<Scalars['String']['input']>;
  /** does the column NOT match the given case-insensitive pattern */
  _nilike?: InputMaybe<Scalars['String']['input']>;
  _nin?: InputMaybe<Array<Scalars['String']['input']>>;
  /** does the column NOT match the given POSIX regular expression, case insensitive */
  _niregex?: InputMaybe<Scalars['String']['input']>;
  /** does the column NOT match the given pattern */
  _nlike?: InputMaybe<Scalars['String']['input']>;
  /** does the column NOT match the given POSIX regular expression, case sensitive */
  _nregex?: InputMaybe<Scalars['String']['input']>;
  /** does the column NOT match the given SQL regular expression */
  _nsimilar?: InputMaybe<Scalars['String']['input']>;
  /** does the column match the given POSIX regular expression, case sensitive */
  _regex?: InputMaybe<Scalars['String']['input']>;
  /** does the column match the given SQL regular expression */
  _similar?: InputMaybe<Scalars['String']['input']>;
};

/** columns and relationships of "body_measurements" */
export type BodyMeasurements = {
  __typename?: 'bodyMeasurements';
  bodyFatPct?: Maybe<Scalars['numeric']['output']>;
  createdAt: Scalars['timestamptz']['output'];
  id: Scalars['uuid']['output'];
  measuredOn: Scalars['date']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['timestamptz']['output'];
  userId: Scalars['uuid']['output'];
  weightKg?: Maybe<Scalars['numeric']['output']>;
};

/** aggregated selection of "body_measurements" */
export type BodyMeasurements_Aggregate = {
  __typename?: 'bodyMeasurements_aggregate';
  aggregate?: Maybe<BodyMeasurements_Aggregate_Fields>;
  nodes: Array<BodyMeasurements>;
};

/** aggregate fields of "body_measurements" */
export type BodyMeasurements_Aggregate_Fields = {
  __typename?: 'bodyMeasurements_aggregate_fields';
  avg?: Maybe<BodyMeasurements_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<BodyMeasurements_Max_Fields>;
  min?: Maybe<BodyMeasurements_Min_Fields>;
  stddev?: Maybe<BodyMeasurements_Stddev_Fields>;
  stddev_pop?: Maybe<BodyMeasurements_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<BodyMeasurements_Stddev_Samp_Fields>;
  sum?: Maybe<BodyMeasurements_Sum_Fields>;
  var_pop?: Maybe<BodyMeasurements_Var_Pop_Fields>;
  var_samp?: Maybe<BodyMeasurements_Var_Samp_Fields>;
  variance?: Maybe<BodyMeasurements_Variance_Fields>;
};


/** aggregate fields of "body_measurements" */
export type BodyMeasurements_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<BodyMeasurements_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate avg on columns */
export type BodyMeasurements_Avg_Fields = {
  __typename?: 'bodyMeasurements_avg_fields';
  bodyFatPct?: Maybe<Scalars['Float']['output']>;
  weightKg?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "body_measurements". All fields are combined with a logical 'AND'. */
export type BodyMeasurements_Bool_Exp = {
  _and?: InputMaybe<Array<BodyMeasurements_Bool_Exp>>;
  _not?: InputMaybe<BodyMeasurements_Bool_Exp>;
  _or?: InputMaybe<Array<BodyMeasurements_Bool_Exp>>;
  bodyFatPct?: InputMaybe<Numeric_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  measuredOn?: InputMaybe<Date_Comparison_Exp>;
  notes?: InputMaybe<String_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  userId?: InputMaybe<Uuid_Comparison_Exp>;
  weightKg?: InputMaybe<Numeric_Comparison_Exp>;
};

/** unique or primary key constraints on table "body_measurements" */
export enum BodyMeasurements_Constraint {
  /** unique or primary key constraint on columns "id" */
  BodyMeasurementsPkey = 'body_measurements_pkey',
  /** unique or primary key constraint on columns "measured_on", "user_id" */
  BodyMeasurementsUserDateKey = 'body_measurements_user_date_key'
}

/** input type for incrementing numeric columns in table "body_measurements" */
export type BodyMeasurements_Inc_Input = {
  bodyFatPct?: InputMaybe<Scalars['numeric']['input']>;
  weightKg?: InputMaybe<Scalars['numeric']['input']>;
};

/** input type for inserting data into table "body_measurements" */
export type BodyMeasurements_Insert_Input = {
  bodyFatPct?: InputMaybe<Scalars['numeric']['input']>;
  measuredOn?: InputMaybe<Scalars['date']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  weightKg?: InputMaybe<Scalars['numeric']['input']>;
};

/** aggregate max on columns */
export type BodyMeasurements_Max_Fields = {
  __typename?: 'bodyMeasurements_max_fields';
  bodyFatPct?: Maybe<Scalars['numeric']['output']>;
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  measuredOn?: Maybe<Scalars['date']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
  weightKg?: Maybe<Scalars['numeric']['output']>;
};

/** aggregate min on columns */
export type BodyMeasurements_Min_Fields = {
  __typename?: 'bodyMeasurements_min_fields';
  bodyFatPct?: Maybe<Scalars['numeric']['output']>;
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  measuredOn?: Maybe<Scalars['date']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
  weightKg?: Maybe<Scalars['numeric']['output']>;
};

/** response of any mutation on the table "body_measurements" */
export type BodyMeasurements_Mutation_Response = {
  __typename?: 'bodyMeasurements_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<BodyMeasurements>;
};

/** on_conflict condition type for table "body_measurements" */
export type BodyMeasurements_On_Conflict = {
  constraint: BodyMeasurements_Constraint;
  update_columns?: Array<BodyMeasurements_Update_Column>;
  where?: InputMaybe<BodyMeasurements_Bool_Exp>;
};

/** Ordering options when selecting data from "body_measurements". */
export type BodyMeasurements_Order_By = {
  bodyFatPct?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  measuredOn?: InputMaybe<Order_By>;
  notes?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
  weightKg?: InputMaybe<Order_By>;
};

/** primary key columns input for table: body_measurements */
export type BodyMeasurements_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "body_measurements" */
export enum BodyMeasurements_Select_Column {
  /** column name */
  BodyFatPct = 'bodyFatPct',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  MeasuredOn = 'measuredOn',
  /** column name */
  Notes = 'notes',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UserId = 'userId',
  /** column name */
  WeightKg = 'weightKg'
}

/** input type for updating data in table "body_measurements" */
export type BodyMeasurements_Set_Input = {
  bodyFatPct?: InputMaybe<Scalars['numeric']['input']>;
  measuredOn?: InputMaybe<Scalars['date']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  weightKg?: InputMaybe<Scalars['numeric']['input']>;
};

/** aggregate stddev on columns */
export type BodyMeasurements_Stddev_Fields = {
  __typename?: 'bodyMeasurements_stddev_fields';
  bodyFatPct?: Maybe<Scalars['Float']['output']>;
  weightKg?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type BodyMeasurements_Stddev_Pop_Fields = {
  __typename?: 'bodyMeasurements_stddev_pop_fields';
  bodyFatPct?: Maybe<Scalars['Float']['output']>;
  weightKg?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type BodyMeasurements_Stddev_Samp_Fields = {
  __typename?: 'bodyMeasurements_stddev_samp_fields';
  bodyFatPct?: Maybe<Scalars['Float']['output']>;
  weightKg?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "bodyMeasurements" */
export type BodyMeasurements_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: BodyMeasurements_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type BodyMeasurements_Stream_Cursor_Value_Input = {
  bodyFatPct?: InputMaybe<Scalars['numeric']['input']>;
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  measuredOn?: InputMaybe<Scalars['date']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
  userId?: InputMaybe<Scalars['uuid']['input']>;
  weightKg?: InputMaybe<Scalars['numeric']['input']>;
};

/** aggregate sum on columns */
export type BodyMeasurements_Sum_Fields = {
  __typename?: 'bodyMeasurements_sum_fields';
  bodyFatPct?: Maybe<Scalars['numeric']['output']>;
  weightKg?: Maybe<Scalars['numeric']['output']>;
};

/** update columns of table "body_measurements" */
export enum BodyMeasurements_Update_Column {
  /** column name */
  BodyFatPct = 'bodyFatPct',
  /** column name */
  MeasuredOn = 'measuredOn',
  /** column name */
  Notes = 'notes',
  /** column name */
  WeightKg = 'weightKg'
}

export type BodyMeasurements_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<BodyMeasurements_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<BodyMeasurements_Set_Input>;
  /** filter the rows which have to be updated */
  where: BodyMeasurements_Bool_Exp;
};

/** aggregate var_pop on columns */
export type BodyMeasurements_Var_Pop_Fields = {
  __typename?: 'bodyMeasurements_var_pop_fields';
  bodyFatPct?: Maybe<Scalars['Float']['output']>;
  weightKg?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type BodyMeasurements_Var_Samp_Fields = {
  __typename?: 'bodyMeasurements_var_samp_fields';
  bodyFatPct?: Maybe<Scalars['Float']['output']>;
  weightKg?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type BodyMeasurements_Variance_Fields = {
  __typename?: 'bodyMeasurements_variance_fields';
  bodyFatPct?: Maybe<Scalars['Float']['output']>;
  weightKg?: Maybe<Scalars['Float']['output']>;
};

/** ordering argument of a cursor */
export enum Cursor_Ordering {
  /** ascending ordering of the cursor */
  Asc = 'ASC',
  /** descending ordering of the cursor */
  Desc = 'DESC'
}

/** Boolean expression to compare columns of type "date". All fields are combined with logical 'AND'. */
export type Date_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['date']['input']>;
  _gt?: InputMaybe<Scalars['date']['input']>;
  _gte?: InputMaybe<Scalars['date']['input']>;
  _in?: InputMaybe<Array<Scalars['date']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['date']['input']>;
  _lte?: InputMaybe<Scalars['date']['input']>;
  _neq?: InputMaybe<Scalars['date']['input']>;
  _nin?: InputMaybe<Array<Scalars['date']['input']>>;
};

/** columns and relationships of "exercise_categories" */
export type ExerciseCategories = {
  __typename?: 'exerciseCategories';
  comment?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  exercises: Array<Exercises>;
  /** An aggregate relationship */
  exercises_aggregate: Exercises_Aggregate;
  value: Scalars['String']['output'];
};


/** columns and relationships of "exercise_categories" */
export type ExerciseCategoriesExercisesArgs = {
  distinct_on?: InputMaybe<Array<Exercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Exercises_Order_By>>;
  where?: InputMaybe<Exercises_Bool_Exp>;
};


/** columns and relationships of "exercise_categories" */
export type ExerciseCategoriesExercises_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Exercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Exercises_Order_By>>;
  where?: InputMaybe<Exercises_Bool_Exp>;
};

/** aggregated selection of "exercise_categories" */
export type ExerciseCategories_Aggregate = {
  __typename?: 'exerciseCategories_aggregate';
  aggregate?: Maybe<ExerciseCategories_Aggregate_Fields>;
  nodes: Array<ExerciseCategories>;
};

/** aggregate fields of "exercise_categories" */
export type ExerciseCategories_Aggregate_Fields = {
  __typename?: 'exerciseCategories_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<ExerciseCategories_Max_Fields>;
  min?: Maybe<ExerciseCategories_Min_Fields>;
};


/** aggregate fields of "exercise_categories" */
export type ExerciseCategories_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<ExerciseCategories_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "exercise_categories". All fields are combined with a logical 'AND'. */
export type ExerciseCategories_Bool_Exp = {
  _and?: InputMaybe<Array<ExerciseCategories_Bool_Exp>>;
  _not?: InputMaybe<ExerciseCategories_Bool_Exp>;
  _or?: InputMaybe<Array<ExerciseCategories_Bool_Exp>>;
  comment?: InputMaybe<String_Comparison_Exp>;
  exercises?: InputMaybe<Exercises_Bool_Exp>;
  exercises_aggregate?: InputMaybe<Exercises_Aggregate_Bool_Exp>;
  value?: InputMaybe<String_Comparison_Exp>;
};

export enum ExerciseCategories_Enum {
  Cardio = 'cardio',
  OlympicWeightlifting = 'olympic_weightlifting',
  Plyometrics = 'plyometrics',
  Powerlifting = 'powerlifting',
  Strength = 'strength',
  Stretching = 'stretching',
  Strongman = 'strongman'
}

/** Boolean expression to compare columns of type "exerciseCategories_enum". All fields are combined with logical 'AND'. */
export type ExerciseCategories_Enum_Comparison_Exp = {
  _eq?: InputMaybe<ExerciseCategories_Enum>;
  _in?: InputMaybe<Array<ExerciseCategories_Enum>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _neq?: InputMaybe<ExerciseCategories_Enum>;
  _nin?: InputMaybe<Array<ExerciseCategories_Enum>>;
};

/** aggregate max on columns */
export type ExerciseCategories_Max_Fields = {
  __typename?: 'exerciseCategories_max_fields';
  comment?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type ExerciseCategories_Min_Fields = {
  __typename?: 'exerciseCategories_min_fields';
  comment?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

/** Ordering options when selecting data from "exercise_categories". */
export type ExerciseCategories_Order_By = {
  comment?: InputMaybe<Order_By>;
  exercises_aggregate?: InputMaybe<Exercises_Aggregate_Order_By>;
  value?: InputMaybe<Order_By>;
};

/** select columns of table "exercise_categories" */
export enum ExerciseCategories_Select_Column {
  /** column name */
  Comment = 'comment',
  /** column name */
  Value = 'value'
}

/** Streaming cursor of the table "exerciseCategories" */
export type ExerciseCategories_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: ExerciseCategories_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type ExerciseCategories_Stream_Cursor_Value_Input = {
  comment?: InputMaybe<Scalars['String']['input']>;
  value?: InputMaybe<Scalars['String']['input']>;
};

/** columns and relationships of "exercise_equipments" */
export type ExerciseEquipments = {
  __typename?: 'exerciseEquipments';
  comment?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  exercises: Array<Exercises>;
  /** An aggregate relationship */
  exercises_aggregate: Exercises_Aggregate;
  value: Scalars['String']['output'];
};


/** columns and relationships of "exercise_equipments" */
export type ExerciseEquipmentsExercisesArgs = {
  distinct_on?: InputMaybe<Array<Exercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Exercises_Order_By>>;
  where?: InputMaybe<Exercises_Bool_Exp>;
};


/** columns and relationships of "exercise_equipments" */
export type ExerciseEquipmentsExercises_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Exercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Exercises_Order_By>>;
  where?: InputMaybe<Exercises_Bool_Exp>;
};

/** aggregated selection of "exercise_equipments" */
export type ExerciseEquipments_Aggregate = {
  __typename?: 'exerciseEquipments_aggregate';
  aggregate?: Maybe<ExerciseEquipments_Aggregate_Fields>;
  nodes: Array<ExerciseEquipments>;
};

/** aggregate fields of "exercise_equipments" */
export type ExerciseEquipments_Aggregate_Fields = {
  __typename?: 'exerciseEquipments_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<ExerciseEquipments_Max_Fields>;
  min?: Maybe<ExerciseEquipments_Min_Fields>;
};


/** aggregate fields of "exercise_equipments" */
export type ExerciseEquipments_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<ExerciseEquipments_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "exercise_equipments". All fields are combined with a logical 'AND'. */
export type ExerciseEquipments_Bool_Exp = {
  _and?: InputMaybe<Array<ExerciseEquipments_Bool_Exp>>;
  _not?: InputMaybe<ExerciseEquipments_Bool_Exp>;
  _or?: InputMaybe<Array<ExerciseEquipments_Bool_Exp>>;
  comment?: InputMaybe<String_Comparison_Exp>;
  exercises?: InputMaybe<Exercises_Bool_Exp>;
  exercises_aggregate?: InputMaybe<Exercises_Aggregate_Bool_Exp>;
  value?: InputMaybe<String_Comparison_Exp>;
};

export enum ExerciseEquipments_Enum {
  Bands = 'bands',
  Barbell = 'barbell',
  BodyOnly = 'body_only',
  Cable = 'cable',
  Dumbbell = 'dumbbell',
  ExerciseBall = 'exercise_ball',
  EzCurlBar = 'ez_curl_bar',
  FoamRoll = 'foam_roll',
  Kettlebells = 'kettlebells',
  Machine = 'machine',
  MedicineBall = 'medicine_ball',
  Other = 'other'
}

/** Boolean expression to compare columns of type "exerciseEquipments_enum". All fields are combined with logical 'AND'. */
export type ExerciseEquipments_Enum_Comparison_Exp = {
  _eq?: InputMaybe<ExerciseEquipments_Enum>;
  _in?: InputMaybe<Array<ExerciseEquipments_Enum>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _neq?: InputMaybe<ExerciseEquipments_Enum>;
  _nin?: InputMaybe<Array<ExerciseEquipments_Enum>>;
};

/** aggregate max on columns */
export type ExerciseEquipments_Max_Fields = {
  __typename?: 'exerciseEquipments_max_fields';
  comment?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type ExerciseEquipments_Min_Fields = {
  __typename?: 'exerciseEquipments_min_fields';
  comment?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

/** Ordering options when selecting data from "exercise_equipments". */
export type ExerciseEquipments_Order_By = {
  comment?: InputMaybe<Order_By>;
  exercises_aggregate?: InputMaybe<Exercises_Aggregate_Order_By>;
  value?: InputMaybe<Order_By>;
};

/** select columns of table "exercise_equipments" */
export enum ExerciseEquipments_Select_Column {
  /** column name */
  Comment = 'comment',
  /** column name */
  Value = 'value'
}

/** Streaming cursor of the table "exerciseEquipments" */
export type ExerciseEquipments_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: ExerciseEquipments_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type ExerciseEquipments_Stream_Cursor_Value_Input = {
  comment?: InputMaybe<Scalars['String']['input']>;
  value?: InputMaybe<Scalars['String']['input']>;
};

/** columns and relationships of "exercise_forces" */
export type ExerciseForces = {
  __typename?: 'exerciseForces';
  comment?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  exercises: Array<Exercises>;
  /** An aggregate relationship */
  exercises_aggregate: Exercises_Aggregate;
  value: Scalars['String']['output'];
};


/** columns and relationships of "exercise_forces" */
export type ExerciseForcesExercisesArgs = {
  distinct_on?: InputMaybe<Array<Exercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Exercises_Order_By>>;
  where?: InputMaybe<Exercises_Bool_Exp>;
};


/** columns and relationships of "exercise_forces" */
export type ExerciseForcesExercises_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Exercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Exercises_Order_By>>;
  where?: InputMaybe<Exercises_Bool_Exp>;
};

/** aggregated selection of "exercise_forces" */
export type ExerciseForces_Aggregate = {
  __typename?: 'exerciseForces_aggregate';
  aggregate?: Maybe<ExerciseForces_Aggregate_Fields>;
  nodes: Array<ExerciseForces>;
};

/** aggregate fields of "exercise_forces" */
export type ExerciseForces_Aggregate_Fields = {
  __typename?: 'exerciseForces_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<ExerciseForces_Max_Fields>;
  min?: Maybe<ExerciseForces_Min_Fields>;
};


/** aggregate fields of "exercise_forces" */
export type ExerciseForces_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<ExerciseForces_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "exercise_forces". All fields are combined with a logical 'AND'. */
export type ExerciseForces_Bool_Exp = {
  _and?: InputMaybe<Array<ExerciseForces_Bool_Exp>>;
  _not?: InputMaybe<ExerciseForces_Bool_Exp>;
  _or?: InputMaybe<Array<ExerciseForces_Bool_Exp>>;
  comment?: InputMaybe<String_Comparison_Exp>;
  exercises?: InputMaybe<Exercises_Bool_Exp>;
  exercises_aggregate?: InputMaybe<Exercises_Aggregate_Bool_Exp>;
  value?: InputMaybe<String_Comparison_Exp>;
};

export enum ExerciseForces_Enum {
  Pull = 'pull',
  Push = 'push',
  Static = 'static'
}

/** Boolean expression to compare columns of type "exerciseForces_enum". All fields are combined with logical 'AND'. */
export type ExerciseForces_Enum_Comparison_Exp = {
  _eq?: InputMaybe<ExerciseForces_Enum>;
  _in?: InputMaybe<Array<ExerciseForces_Enum>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _neq?: InputMaybe<ExerciseForces_Enum>;
  _nin?: InputMaybe<Array<ExerciseForces_Enum>>;
};

/** aggregate max on columns */
export type ExerciseForces_Max_Fields = {
  __typename?: 'exerciseForces_max_fields';
  comment?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type ExerciseForces_Min_Fields = {
  __typename?: 'exerciseForces_min_fields';
  comment?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

/** Ordering options when selecting data from "exercise_forces". */
export type ExerciseForces_Order_By = {
  comment?: InputMaybe<Order_By>;
  exercises_aggregate?: InputMaybe<Exercises_Aggregate_Order_By>;
  value?: InputMaybe<Order_By>;
};

/** select columns of table "exercise_forces" */
export enum ExerciseForces_Select_Column {
  /** column name */
  Comment = 'comment',
  /** column name */
  Value = 'value'
}

/** Streaming cursor of the table "exerciseForces" */
export type ExerciseForces_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: ExerciseForces_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type ExerciseForces_Stream_Cursor_Value_Input = {
  comment?: InputMaybe<Scalars['String']['input']>;
  value?: InputMaybe<Scalars['String']['input']>;
};

/** columns and relationships of "exercise_levels" */
export type ExerciseLevels = {
  __typename?: 'exerciseLevels';
  comment?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  exercises: Array<Exercises>;
  /** An aggregate relationship */
  exercises_aggregate: Exercises_Aggregate;
  value: Scalars['String']['output'];
};


/** columns and relationships of "exercise_levels" */
export type ExerciseLevelsExercisesArgs = {
  distinct_on?: InputMaybe<Array<Exercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Exercises_Order_By>>;
  where?: InputMaybe<Exercises_Bool_Exp>;
};


/** columns and relationships of "exercise_levels" */
export type ExerciseLevelsExercises_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Exercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Exercises_Order_By>>;
  where?: InputMaybe<Exercises_Bool_Exp>;
};

/** aggregated selection of "exercise_levels" */
export type ExerciseLevels_Aggregate = {
  __typename?: 'exerciseLevels_aggregate';
  aggregate?: Maybe<ExerciseLevels_Aggregate_Fields>;
  nodes: Array<ExerciseLevels>;
};

/** aggregate fields of "exercise_levels" */
export type ExerciseLevels_Aggregate_Fields = {
  __typename?: 'exerciseLevels_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<ExerciseLevels_Max_Fields>;
  min?: Maybe<ExerciseLevels_Min_Fields>;
};


/** aggregate fields of "exercise_levels" */
export type ExerciseLevels_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<ExerciseLevels_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "exercise_levels". All fields are combined with a logical 'AND'. */
export type ExerciseLevels_Bool_Exp = {
  _and?: InputMaybe<Array<ExerciseLevels_Bool_Exp>>;
  _not?: InputMaybe<ExerciseLevels_Bool_Exp>;
  _or?: InputMaybe<Array<ExerciseLevels_Bool_Exp>>;
  comment?: InputMaybe<String_Comparison_Exp>;
  exercises?: InputMaybe<Exercises_Bool_Exp>;
  exercises_aggregate?: InputMaybe<Exercises_Aggregate_Bool_Exp>;
  value?: InputMaybe<String_Comparison_Exp>;
};

export enum ExerciseLevels_Enum {
  Beginner = 'beginner',
  Expert = 'expert',
  Intermediate = 'intermediate'
}

/** Boolean expression to compare columns of type "exerciseLevels_enum". All fields are combined with logical 'AND'. */
export type ExerciseLevels_Enum_Comparison_Exp = {
  _eq?: InputMaybe<ExerciseLevels_Enum>;
  _in?: InputMaybe<Array<ExerciseLevels_Enum>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _neq?: InputMaybe<ExerciseLevels_Enum>;
  _nin?: InputMaybe<Array<ExerciseLevels_Enum>>;
};

/** aggregate max on columns */
export type ExerciseLevels_Max_Fields = {
  __typename?: 'exerciseLevels_max_fields';
  comment?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type ExerciseLevels_Min_Fields = {
  __typename?: 'exerciseLevels_min_fields';
  comment?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

/** Ordering options when selecting data from "exercise_levels". */
export type ExerciseLevels_Order_By = {
  comment?: InputMaybe<Order_By>;
  exercises_aggregate?: InputMaybe<Exercises_Aggregate_Order_By>;
  value?: InputMaybe<Order_By>;
};

/** select columns of table "exercise_levels" */
export enum ExerciseLevels_Select_Column {
  /** column name */
  Comment = 'comment',
  /** column name */
  Value = 'value'
}

/** Streaming cursor of the table "exerciseLevels" */
export type ExerciseLevels_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: ExerciseLevels_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type ExerciseLevels_Stream_Cursor_Value_Input = {
  comment?: InputMaybe<Scalars['String']['input']>;
  value?: InputMaybe<Scalars['String']['input']>;
};

/** columns and relationships of "exercise_mechanics" */
export type ExerciseMechanics = {
  __typename?: 'exerciseMechanics';
  comment?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  exercises: Array<Exercises>;
  /** An aggregate relationship */
  exercises_aggregate: Exercises_Aggregate;
  value: Scalars['String']['output'];
};


/** columns and relationships of "exercise_mechanics" */
export type ExerciseMechanicsExercisesArgs = {
  distinct_on?: InputMaybe<Array<Exercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Exercises_Order_By>>;
  where?: InputMaybe<Exercises_Bool_Exp>;
};


/** columns and relationships of "exercise_mechanics" */
export type ExerciseMechanicsExercises_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Exercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Exercises_Order_By>>;
  where?: InputMaybe<Exercises_Bool_Exp>;
};

/** aggregated selection of "exercise_mechanics" */
export type ExerciseMechanics_Aggregate = {
  __typename?: 'exerciseMechanics_aggregate';
  aggregate?: Maybe<ExerciseMechanics_Aggregate_Fields>;
  nodes: Array<ExerciseMechanics>;
};

/** aggregate fields of "exercise_mechanics" */
export type ExerciseMechanics_Aggregate_Fields = {
  __typename?: 'exerciseMechanics_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<ExerciseMechanics_Max_Fields>;
  min?: Maybe<ExerciseMechanics_Min_Fields>;
};


/** aggregate fields of "exercise_mechanics" */
export type ExerciseMechanics_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<ExerciseMechanics_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "exercise_mechanics". All fields are combined with a logical 'AND'. */
export type ExerciseMechanics_Bool_Exp = {
  _and?: InputMaybe<Array<ExerciseMechanics_Bool_Exp>>;
  _not?: InputMaybe<ExerciseMechanics_Bool_Exp>;
  _or?: InputMaybe<Array<ExerciseMechanics_Bool_Exp>>;
  comment?: InputMaybe<String_Comparison_Exp>;
  exercises?: InputMaybe<Exercises_Bool_Exp>;
  exercises_aggregate?: InputMaybe<Exercises_Aggregate_Bool_Exp>;
  value?: InputMaybe<String_Comparison_Exp>;
};

export enum ExerciseMechanics_Enum {
  Compound = 'compound',
  Isolation = 'isolation'
}

/** Boolean expression to compare columns of type "exerciseMechanics_enum". All fields are combined with logical 'AND'. */
export type ExerciseMechanics_Enum_Comparison_Exp = {
  _eq?: InputMaybe<ExerciseMechanics_Enum>;
  _in?: InputMaybe<Array<ExerciseMechanics_Enum>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _neq?: InputMaybe<ExerciseMechanics_Enum>;
  _nin?: InputMaybe<Array<ExerciseMechanics_Enum>>;
};

/** aggregate max on columns */
export type ExerciseMechanics_Max_Fields = {
  __typename?: 'exerciseMechanics_max_fields';
  comment?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type ExerciseMechanics_Min_Fields = {
  __typename?: 'exerciseMechanics_min_fields';
  comment?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

/** Ordering options when selecting data from "exercise_mechanics". */
export type ExerciseMechanics_Order_By = {
  comment?: InputMaybe<Order_By>;
  exercises_aggregate?: InputMaybe<Exercises_Aggregate_Order_By>;
  value?: InputMaybe<Order_By>;
};

/** select columns of table "exercise_mechanics" */
export enum ExerciseMechanics_Select_Column {
  /** column name */
  Comment = 'comment',
  /** column name */
  Value = 'value'
}

/** Streaming cursor of the table "exerciseMechanics" */
export type ExerciseMechanics_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: ExerciseMechanics_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type ExerciseMechanics_Stream_Cursor_Value_Input = {
  comment?: InputMaybe<Scalars['String']['input']>;
  value?: InputMaybe<Scalars['String']['input']>;
};

/** columns and relationships of "exercise_secondary_muscle_groups" */
export type ExerciseSecondaryMuscleGroups = {
  __typename?: 'exerciseSecondaryMuscleGroups';
  /** An object relationship */
  exercise: Exercises;
  exerciseId: Scalars['uuid']['output'];
  muscleGroup: MuscleGroups_Enum;
};

/** aggregated selection of "exercise_secondary_muscle_groups" */
export type ExerciseSecondaryMuscleGroups_Aggregate = {
  __typename?: 'exerciseSecondaryMuscleGroups_aggregate';
  aggregate?: Maybe<ExerciseSecondaryMuscleGroups_Aggregate_Fields>;
  nodes: Array<ExerciseSecondaryMuscleGroups>;
};

export type ExerciseSecondaryMuscleGroups_Aggregate_Bool_Exp = {
  count?: InputMaybe<ExerciseSecondaryMuscleGroups_Aggregate_Bool_Exp_Count>;
};

export type ExerciseSecondaryMuscleGroups_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<ExerciseSecondaryMuscleGroups_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<ExerciseSecondaryMuscleGroups_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "exercise_secondary_muscle_groups" */
export type ExerciseSecondaryMuscleGroups_Aggregate_Fields = {
  __typename?: 'exerciseSecondaryMuscleGroups_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<ExerciseSecondaryMuscleGroups_Max_Fields>;
  min?: Maybe<ExerciseSecondaryMuscleGroups_Min_Fields>;
};


/** aggregate fields of "exercise_secondary_muscle_groups" */
export type ExerciseSecondaryMuscleGroups_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<ExerciseSecondaryMuscleGroups_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "exercise_secondary_muscle_groups" */
export type ExerciseSecondaryMuscleGroups_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<ExerciseSecondaryMuscleGroups_Max_Order_By>;
  min?: InputMaybe<ExerciseSecondaryMuscleGroups_Min_Order_By>;
};

/** Boolean expression to filter rows from the table "exercise_secondary_muscle_groups". All fields are combined with a logical 'AND'. */
export type ExerciseSecondaryMuscleGroups_Bool_Exp = {
  _and?: InputMaybe<Array<ExerciseSecondaryMuscleGroups_Bool_Exp>>;
  _not?: InputMaybe<ExerciseSecondaryMuscleGroups_Bool_Exp>;
  _or?: InputMaybe<Array<ExerciseSecondaryMuscleGroups_Bool_Exp>>;
  exercise?: InputMaybe<Exercises_Bool_Exp>;
  exerciseId?: InputMaybe<Uuid_Comparison_Exp>;
  muscleGroup?: InputMaybe<MuscleGroups_Enum_Comparison_Exp>;
};

/** aggregate max on columns */
export type ExerciseSecondaryMuscleGroups_Max_Fields = {
  __typename?: 'exerciseSecondaryMuscleGroups_max_fields';
  exerciseId?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "exercise_secondary_muscle_groups" */
export type ExerciseSecondaryMuscleGroups_Max_Order_By = {
  exerciseId?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type ExerciseSecondaryMuscleGroups_Min_Fields = {
  __typename?: 'exerciseSecondaryMuscleGroups_min_fields';
  exerciseId?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "exercise_secondary_muscle_groups" */
export type ExerciseSecondaryMuscleGroups_Min_Order_By = {
  exerciseId?: InputMaybe<Order_By>;
};

/** Ordering options when selecting data from "exercise_secondary_muscle_groups". */
export type ExerciseSecondaryMuscleGroups_Order_By = {
  exercise?: InputMaybe<Exercises_Order_By>;
  exerciseId?: InputMaybe<Order_By>;
  muscleGroup?: InputMaybe<Order_By>;
};

/** select columns of table "exercise_secondary_muscle_groups" */
export enum ExerciseSecondaryMuscleGroups_Select_Column {
  /** column name */
  ExerciseId = 'exerciseId',
  /** column name */
  MuscleGroup = 'muscleGroup'
}

/** Streaming cursor of the table "exerciseSecondaryMuscleGroups" */
export type ExerciseSecondaryMuscleGroups_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: ExerciseSecondaryMuscleGroups_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type ExerciseSecondaryMuscleGroups_Stream_Cursor_Value_Input = {
  exerciseId?: InputMaybe<Scalars['uuid']['input']>;
  muscleGroup?: InputMaybe<MuscleGroups_Enum>;
};

/** columns and relationships of "exercises" */
export type Exercises = {
  __typename?: 'exercises';
  category?: Maybe<ExerciseCategories_Enum>;
  createdAt: Scalars['timestamptz']['output'];
  doubleWeight: Scalars['Boolean']['output'];
  equipment?: Maybe<ExerciseEquipments_Enum>;
  force?: Maybe<ExerciseForces_Enum>;
  id: Scalars['uuid']['output'];
  /** An object relationship */
  image1?: Maybe<Files>;
  image1FileId?: Maybe<Scalars['uuid']['output']>;
  /** An object relationship */
  image2?: Maybe<Files>;
  image2FileId?: Maybe<Scalars['uuid']['output']>;
  instructions: Array<Scalars['String']['output']>;
  isPublic: Scalars['Boolean']['output'];
  level?: Maybe<ExerciseLevels_Enum>;
  mechanic?: Maybe<ExerciseMechanics_Enum>;
  /** JSON Schema describing the per-entry metrics shape for cardio exercises. NULL for non-cardio. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  metricsSchema?: Maybe<Scalars['jsonb']['output']>;
  name: Scalars['String']['output'];
  primaryMuscleGroup: MuscleGroups_Enum;
  /** An array relationship */
  secondaryMuscleGroups: Array<ExerciseSecondaryMuscleGroups>;
  /** An aggregate relationship */
  secondaryMuscleGroups_aggregate: ExerciseSecondaryMuscleGroups_Aggregate;
  slug?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['timestamptz']['output'];
  userId?: Maybe<Scalars['uuid']['output']>;
  /** An array relationship */
  workoutExercises: Array<WorkoutExercises>;
  /** An aggregate relationship */
  workoutExercises_aggregate: WorkoutExercises_Aggregate;
  /** An array relationship */
  workoutSessionExercises: Array<WorkoutSessionExercises>;
  /** An aggregate relationship */
  workoutSessionExercises_aggregate: WorkoutSessionExercises_Aggregate;
};


/** columns and relationships of "exercises" */
export type ExercisesMetricsSchemaArgs = {
  path?: InputMaybe<Scalars['String']['input']>;
};


/** columns and relationships of "exercises" */
export type ExercisesSecondaryMuscleGroupsArgs = {
  distinct_on?: InputMaybe<Array<ExerciseSecondaryMuscleGroups_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseSecondaryMuscleGroups_Order_By>>;
  where?: InputMaybe<ExerciseSecondaryMuscleGroups_Bool_Exp>;
};


/** columns and relationships of "exercises" */
export type ExercisesSecondaryMuscleGroups_AggregateArgs = {
  distinct_on?: InputMaybe<Array<ExerciseSecondaryMuscleGroups_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseSecondaryMuscleGroups_Order_By>>;
  where?: InputMaybe<ExerciseSecondaryMuscleGroups_Bool_Exp>;
};


/** columns and relationships of "exercises" */
export type ExercisesWorkoutExercisesArgs = {
  distinct_on?: InputMaybe<Array<WorkoutExercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutExercises_Order_By>>;
  where?: InputMaybe<WorkoutExercises_Bool_Exp>;
};


/** columns and relationships of "exercises" */
export type ExercisesWorkoutExercises_AggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutExercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutExercises_Order_By>>;
  where?: InputMaybe<WorkoutExercises_Bool_Exp>;
};


/** columns and relationships of "exercises" */
export type ExercisesWorkoutSessionExercisesArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionExercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionExercises_Order_By>>;
  where?: InputMaybe<WorkoutSessionExercises_Bool_Exp>;
};


/** columns and relationships of "exercises" */
export type ExercisesWorkoutSessionExercises_AggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionExercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionExercises_Order_By>>;
  where?: InputMaybe<WorkoutSessionExercises_Bool_Exp>;
};

/** aggregated selection of "exercises" */
export type Exercises_Aggregate = {
  __typename?: 'exercises_aggregate';
  aggregate?: Maybe<Exercises_Aggregate_Fields>;
  nodes: Array<Exercises>;
};

export type Exercises_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<Exercises_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<Exercises_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<Exercises_Aggregate_Bool_Exp_Count>;
};

export type Exercises_Aggregate_Bool_Exp_Bool_And = {
  arguments: Exercises_Select_Column_Exercises_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Exercises_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Exercises_Aggregate_Bool_Exp_Bool_Or = {
  arguments: Exercises_Select_Column_Exercises_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Exercises_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type Exercises_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<Exercises_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<Exercises_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "exercises" */
export type Exercises_Aggregate_Fields = {
  __typename?: 'exercises_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Exercises_Max_Fields>;
  min?: Maybe<Exercises_Min_Fields>;
};


/** aggregate fields of "exercises" */
export type Exercises_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Exercises_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "exercises" */
export type Exercises_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<Exercises_Max_Order_By>;
  min?: InputMaybe<Exercises_Min_Order_By>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type Exercises_Append_Input = {
  /** JSON Schema describing the per-entry metrics shape for cardio exercises. NULL for non-cardio. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  metricsSchema?: InputMaybe<Scalars['jsonb']['input']>;
};

/** Boolean expression to filter rows from the table "exercises". All fields are combined with a logical 'AND'. */
export type Exercises_Bool_Exp = {
  _and?: InputMaybe<Array<Exercises_Bool_Exp>>;
  _not?: InputMaybe<Exercises_Bool_Exp>;
  _or?: InputMaybe<Array<Exercises_Bool_Exp>>;
  category?: InputMaybe<ExerciseCategories_Enum_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  doubleWeight?: InputMaybe<Boolean_Comparison_Exp>;
  equipment?: InputMaybe<ExerciseEquipments_Enum_Comparison_Exp>;
  force?: InputMaybe<ExerciseForces_Enum_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  image1?: InputMaybe<Files_Bool_Exp>;
  image1FileId?: InputMaybe<Uuid_Comparison_Exp>;
  image2?: InputMaybe<Files_Bool_Exp>;
  image2FileId?: InputMaybe<Uuid_Comparison_Exp>;
  instructions?: InputMaybe<String_Array_Comparison_Exp>;
  isPublic?: InputMaybe<Boolean_Comparison_Exp>;
  level?: InputMaybe<ExerciseLevels_Enum_Comparison_Exp>;
  mechanic?: InputMaybe<ExerciseMechanics_Enum_Comparison_Exp>;
  metricsSchema?: InputMaybe<Jsonb_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  primaryMuscleGroup?: InputMaybe<MuscleGroups_Enum_Comparison_Exp>;
  secondaryMuscleGroups?: InputMaybe<ExerciseSecondaryMuscleGroups_Bool_Exp>;
  secondaryMuscleGroups_aggregate?: InputMaybe<ExerciseSecondaryMuscleGroups_Aggregate_Bool_Exp>;
  slug?: InputMaybe<String_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  userId?: InputMaybe<Uuid_Comparison_Exp>;
  workoutExercises?: InputMaybe<WorkoutExercises_Bool_Exp>;
  workoutExercises_aggregate?: InputMaybe<WorkoutExercises_Aggregate_Bool_Exp>;
  workoutSessionExercises?: InputMaybe<WorkoutSessionExercises_Bool_Exp>;
  workoutSessionExercises_aggregate?: InputMaybe<WorkoutSessionExercises_Aggregate_Bool_Exp>;
};

/** unique or primary key constraints on table "exercises" */
export enum Exercises_Constraint {
  /** unique or primary key constraint on columns "id" */
  ExercisesPkey = 'exercises_pkey',
  /** unique or primary key constraint on columns "slug" */
  ExercisesSlugKey = 'exercises_slug_key',
  /** unique or primary key constraint on columns "user_id", "name" */
  ExercisesUserNameUq = 'exercises_user_name_uq'
}

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type Exercises_Delete_At_Path_Input = {
  /** JSON Schema describing the per-entry metrics shape for cardio exercises. NULL for non-cardio. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  metricsSchema?: InputMaybe<Array<Scalars['String']['input']>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type Exercises_Delete_Elem_Input = {
  /** JSON Schema describing the per-entry metrics shape for cardio exercises. NULL for non-cardio. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  metricsSchema?: InputMaybe<Scalars['Int']['input']>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type Exercises_Delete_Key_Input = {
  /** JSON Schema describing the per-entry metrics shape for cardio exercises. NULL for non-cardio. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  metricsSchema?: InputMaybe<Scalars['String']['input']>;
};

/** input type for inserting data into table "exercises" */
export type Exercises_Insert_Input = {
  category?: InputMaybe<ExerciseCategories_Enum>;
  doubleWeight?: InputMaybe<Scalars['Boolean']['input']>;
  equipment?: InputMaybe<ExerciseEquipments_Enum>;
  force?: InputMaybe<ExerciseForces_Enum>;
  image1FileId?: InputMaybe<Scalars['uuid']['input']>;
  image2FileId?: InputMaybe<Scalars['uuid']['input']>;
  instructions?: InputMaybe<Array<Scalars['String']['input']>>;
  level?: InputMaybe<ExerciseLevels_Enum>;
  mechanic?: InputMaybe<ExerciseMechanics_Enum>;
  /** JSON Schema describing the per-entry metrics shape for cardio exercises. NULL for non-cardio. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  metricsSchema?: InputMaybe<Scalars['jsonb']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  primaryMuscleGroup?: InputMaybe<MuscleGroups_Enum>;
  workoutExercises?: InputMaybe<WorkoutExercises_Arr_Rel_Insert_Input>;
  workoutSessionExercises?: InputMaybe<WorkoutSessionExercises_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type Exercises_Max_Fields = {
  __typename?: 'exercises_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  image1FileId?: Maybe<Scalars['uuid']['output']>;
  image2FileId?: Maybe<Scalars['uuid']['output']>;
  instructions?: Maybe<Array<Scalars['String']['output']>>;
  name?: Maybe<Scalars['String']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "exercises" */
export type Exercises_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  image1FileId?: InputMaybe<Order_By>;
  image2FileId?: InputMaybe<Order_By>;
  instructions?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  slug?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type Exercises_Min_Fields = {
  __typename?: 'exercises_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  image1FileId?: Maybe<Scalars['uuid']['output']>;
  image2FileId?: Maybe<Scalars['uuid']['output']>;
  instructions?: Maybe<Array<Scalars['String']['output']>>;
  name?: Maybe<Scalars['String']['output']>;
  slug?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "exercises" */
export type Exercises_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  image1FileId?: InputMaybe<Order_By>;
  image2FileId?: InputMaybe<Order_By>;
  instructions?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  slug?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "exercises" */
export type Exercises_Mutation_Response = {
  __typename?: 'exercises_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Exercises>;
};

/** input type for inserting object relation for remote table "exercises" */
export type Exercises_Obj_Rel_Insert_Input = {
  data: Exercises_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Exercises_On_Conflict>;
};

/** on_conflict condition type for table "exercises" */
export type Exercises_On_Conflict = {
  constraint: Exercises_Constraint;
  update_columns?: Array<Exercises_Update_Column>;
  where?: InputMaybe<Exercises_Bool_Exp>;
};

/** Ordering options when selecting data from "exercises". */
export type Exercises_Order_By = {
  category?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  doubleWeight?: InputMaybe<Order_By>;
  equipment?: InputMaybe<Order_By>;
  force?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  image1?: InputMaybe<Files_Order_By>;
  image1FileId?: InputMaybe<Order_By>;
  image2?: InputMaybe<Files_Order_By>;
  image2FileId?: InputMaybe<Order_By>;
  instructions?: InputMaybe<Order_By>;
  isPublic?: InputMaybe<Order_By>;
  level?: InputMaybe<Order_By>;
  mechanic?: InputMaybe<Order_By>;
  metricsSchema?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  primaryMuscleGroup?: InputMaybe<Order_By>;
  secondaryMuscleGroups_aggregate?: InputMaybe<ExerciseSecondaryMuscleGroups_Aggregate_Order_By>;
  slug?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
  workoutExercises_aggregate?: InputMaybe<WorkoutExercises_Aggregate_Order_By>;
  workoutSessionExercises_aggregate?: InputMaybe<WorkoutSessionExercises_Aggregate_Order_By>;
};

/** primary key columns input for table: exercises */
export type Exercises_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type Exercises_Prepend_Input = {
  /** JSON Schema describing the per-entry metrics shape for cardio exercises. NULL for non-cardio. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  metricsSchema?: InputMaybe<Scalars['jsonb']['input']>;
};

/** select columns of table "exercises" */
export enum Exercises_Select_Column {
  /** column name */
  Category = 'category',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  DoubleWeight = 'doubleWeight',
  /** column name */
  Equipment = 'equipment',
  /** column name */
  Force = 'force',
  /** column name */
  Id = 'id',
  /** column name */
  Image1FileId = 'image1FileId',
  /** column name */
  Image2FileId = 'image2FileId',
  /** column name */
  Instructions = 'instructions',
  /** column name */
  IsPublic = 'isPublic',
  /** column name */
  Level = 'level',
  /** column name */
  Mechanic = 'mechanic',
  /** column name */
  MetricsSchema = 'metricsSchema',
  /** column name */
  Name = 'name',
  /** column name */
  PrimaryMuscleGroup = 'primaryMuscleGroup',
  /** column name */
  Slug = 'slug',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UserId = 'userId'
}

/** select "exercises_aggregate_bool_exp_bool_and_arguments_columns" columns of table "exercises" */
export enum Exercises_Select_Column_Exercises_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  DoubleWeight = 'doubleWeight',
  /** column name */
  IsPublic = 'isPublic'
}

/** select "exercises_aggregate_bool_exp_bool_or_arguments_columns" columns of table "exercises" */
export enum Exercises_Select_Column_Exercises_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  DoubleWeight = 'doubleWeight',
  /** column name */
  IsPublic = 'isPublic'
}

/** input type for updating data in table "exercises" */
export type Exercises_Set_Input = {
  category?: InputMaybe<ExerciseCategories_Enum>;
  doubleWeight?: InputMaybe<Scalars['Boolean']['input']>;
  equipment?: InputMaybe<ExerciseEquipments_Enum>;
  force?: InputMaybe<ExerciseForces_Enum>;
  image1FileId?: InputMaybe<Scalars['uuid']['input']>;
  image2FileId?: InputMaybe<Scalars['uuid']['input']>;
  instructions?: InputMaybe<Array<Scalars['String']['input']>>;
  level?: InputMaybe<ExerciseLevels_Enum>;
  mechanic?: InputMaybe<ExerciseMechanics_Enum>;
  /** JSON Schema describing the per-entry metrics shape for cardio exercises. NULL for non-cardio. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  metricsSchema?: InputMaybe<Scalars['jsonb']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  primaryMuscleGroup?: InputMaybe<MuscleGroups_Enum>;
};

/** Streaming cursor of the table "exercises" */
export type Exercises_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Exercises_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Exercises_Stream_Cursor_Value_Input = {
  category?: InputMaybe<ExerciseCategories_Enum>;
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  doubleWeight?: InputMaybe<Scalars['Boolean']['input']>;
  equipment?: InputMaybe<ExerciseEquipments_Enum>;
  force?: InputMaybe<ExerciseForces_Enum>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  image1FileId?: InputMaybe<Scalars['uuid']['input']>;
  image2FileId?: InputMaybe<Scalars['uuid']['input']>;
  instructions?: InputMaybe<Array<Scalars['String']['input']>>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  level?: InputMaybe<ExerciseLevels_Enum>;
  mechanic?: InputMaybe<ExerciseMechanics_Enum>;
  /** JSON Schema describing the per-entry metrics shape for cardio exercises. NULL for non-cardio. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  metricsSchema?: InputMaybe<Scalars['jsonb']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  primaryMuscleGroup?: InputMaybe<MuscleGroups_Enum>;
  slug?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
  userId?: InputMaybe<Scalars['uuid']['input']>;
};

/** update columns of table "exercises" */
export enum Exercises_Update_Column {
  /** column name */
  Category = 'category',
  /** column name */
  DoubleWeight = 'doubleWeight',
  /** column name */
  Equipment = 'equipment',
  /** column name */
  Force = 'force',
  /** column name */
  Image1FileId = 'image1FileId',
  /** column name */
  Image2FileId = 'image2FileId',
  /** column name */
  Instructions = 'instructions',
  /** column name */
  Level = 'level',
  /** column name */
  Mechanic = 'mechanic',
  /** column name */
  MetricsSchema = 'metricsSchema',
  /** column name */
  Name = 'name',
  /** column name */
  PrimaryMuscleGroup = 'primaryMuscleGroup'
}

export type Exercises_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<Exercises_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<Exercises_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<Exercises_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<Exercises_Delete_Key_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<Exercises_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Exercises_Set_Input>;
  /** filter the rows which have to be updated */
  where: Exercises_Bool_Exp;
};

/** columns and relationships of "storage.files" */
export type Files = {
  __typename?: 'files';
  bucketId: Scalars['String']['output'];
  createdAt: Scalars['timestamptz']['output'];
  etag?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  exercisesAsImage1: Array<Exercises>;
  /** An aggregate relationship */
  exercisesAsImage1_aggregate: Exercises_Aggregate;
  /** An array relationship */
  exercisesAsImage2: Array<Exercises>;
  /** An aggregate relationship */
  exercisesAsImage2_aggregate: Exercises_Aggregate;
  id: Scalars['uuid']['output'];
  isUploaded?: Maybe<Scalars['Boolean']['output']>;
  metadata?: Maybe<Scalars['jsonb']['output']>;
  mimeType?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  size?: Maybe<Scalars['Int']['output']>;
  updatedAt: Scalars['timestamptz']['output'];
  uploadedByUserId?: Maybe<Scalars['uuid']['output']>;
};


/** columns and relationships of "storage.files" */
export type FilesExercisesAsImage1Args = {
  distinct_on?: InputMaybe<Array<Exercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Exercises_Order_By>>;
  where?: InputMaybe<Exercises_Bool_Exp>;
};


/** columns and relationships of "storage.files" */
export type FilesExercisesAsImage1_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Exercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Exercises_Order_By>>;
  where?: InputMaybe<Exercises_Bool_Exp>;
};


/** columns and relationships of "storage.files" */
export type FilesExercisesAsImage2Args = {
  distinct_on?: InputMaybe<Array<Exercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Exercises_Order_By>>;
  where?: InputMaybe<Exercises_Bool_Exp>;
};


/** columns and relationships of "storage.files" */
export type FilesExercisesAsImage2_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Exercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Exercises_Order_By>>;
  where?: InputMaybe<Exercises_Bool_Exp>;
};


/** columns and relationships of "storage.files" */
export type FilesMetadataArgs = {
  path?: InputMaybe<Scalars['String']['input']>;
};

/** Boolean expression to filter rows from the table "storage.files". All fields are combined with a logical 'AND'. */
export type Files_Bool_Exp = {
  _and?: InputMaybe<Array<Files_Bool_Exp>>;
  _not?: InputMaybe<Files_Bool_Exp>;
  _or?: InputMaybe<Array<Files_Bool_Exp>>;
  bucketId?: InputMaybe<String_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  etag?: InputMaybe<String_Comparison_Exp>;
  exercisesAsImage1?: InputMaybe<Exercises_Bool_Exp>;
  exercisesAsImage1_aggregate?: InputMaybe<Exercises_Aggregate_Bool_Exp>;
  exercisesAsImage2?: InputMaybe<Exercises_Bool_Exp>;
  exercisesAsImage2_aggregate?: InputMaybe<Exercises_Aggregate_Bool_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  isUploaded?: InputMaybe<Boolean_Comparison_Exp>;
  metadata?: InputMaybe<Jsonb_Comparison_Exp>;
  mimeType?: InputMaybe<String_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  size?: InputMaybe<Int_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  uploadedByUserId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** Ordering options when selecting data from "storage.files". */
export type Files_Order_By = {
  bucketId?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  etag?: InputMaybe<Order_By>;
  exercisesAsImage1_aggregate?: InputMaybe<Exercises_Aggregate_Order_By>;
  exercisesAsImage2_aggregate?: InputMaybe<Exercises_Aggregate_Order_By>;
  id?: InputMaybe<Order_By>;
  isUploaded?: InputMaybe<Order_By>;
  metadata?: InputMaybe<Order_By>;
  mimeType?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  size?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  uploadedByUserId?: InputMaybe<Order_By>;
};

/** select columns of table "storage.files" */
export enum Files_Select_Column {
  /** column name */
  BucketId = 'bucketId',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Etag = 'etag',
  /** column name */
  Id = 'id',
  /** column name */
  IsUploaded = 'isUploaded',
  /** column name */
  Metadata = 'metadata',
  /** column name */
  MimeType = 'mimeType',
  /** column name */
  Name = 'name',
  /** column name */
  Size = 'size',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UploadedByUserId = 'uploadedByUserId'
}

/** Streaming cursor of the table "files" */
export type Files_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Files_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Files_Stream_Cursor_Value_Input = {
  bucketId?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  etag?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  isUploaded?: InputMaybe<Scalars['Boolean']['input']>;
  metadata?: InputMaybe<Scalars['jsonb']['input']>;
  mimeType?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  size?: InputMaybe<Scalars['Int']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
  uploadedByUserId?: InputMaybe<Scalars['uuid']['input']>;
};

/** columns and relationships of "journal_entries" */
export type JournalEntries = {
  __typename?: 'journalEntries';
  body: Scalars['String']['output'];
  createdAt: Scalars['timestamptz']['output'];
  entryDate: Scalars['date']['output'];
  id: Scalars['uuid']['output'];
  /** An array relationship */
  journalEntryLabels: Array<JournalEntryLabels>;
  /** An aggregate relationship */
  journalEntryLabels_aggregate: JournalEntryLabels_Aggregate;
  title?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['timestamptz']['output'];
  userId: Scalars['uuid']['output'];
};


/** columns and relationships of "journal_entries" */
export type JournalEntriesJournalEntryLabelsArgs = {
  distinct_on?: InputMaybe<Array<JournalEntryLabels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<JournalEntryLabels_Order_By>>;
  where?: InputMaybe<JournalEntryLabels_Bool_Exp>;
};


/** columns and relationships of "journal_entries" */
export type JournalEntriesJournalEntryLabels_AggregateArgs = {
  distinct_on?: InputMaybe<Array<JournalEntryLabels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<JournalEntryLabels_Order_By>>;
  where?: InputMaybe<JournalEntryLabels_Bool_Exp>;
};

/** aggregated selection of "journal_entries" */
export type JournalEntries_Aggregate = {
  __typename?: 'journalEntries_aggregate';
  aggregate?: Maybe<JournalEntries_Aggregate_Fields>;
  nodes: Array<JournalEntries>;
};

/** aggregate fields of "journal_entries" */
export type JournalEntries_Aggregate_Fields = {
  __typename?: 'journalEntries_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<JournalEntries_Max_Fields>;
  min?: Maybe<JournalEntries_Min_Fields>;
};


/** aggregate fields of "journal_entries" */
export type JournalEntries_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<JournalEntries_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "journal_entries". All fields are combined with a logical 'AND'. */
export type JournalEntries_Bool_Exp = {
  _and?: InputMaybe<Array<JournalEntries_Bool_Exp>>;
  _not?: InputMaybe<JournalEntries_Bool_Exp>;
  _or?: InputMaybe<Array<JournalEntries_Bool_Exp>>;
  body?: InputMaybe<String_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  entryDate?: InputMaybe<Date_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  journalEntryLabels?: InputMaybe<JournalEntryLabels_Bool_Exp>;
  journalEntryLabels_aggregate?: InputMaybe<JournalEntryLabels_Aggregate_Bool_Exp>;
  title?: InputMaybe<String_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  userId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "journal_entries" */
export enum JournalEntries_Constraint {
  /** unique or primary key constraint on columns "id" */
  JournalEntriesPkey = 'journal_entries_pkey'
}

/** input type for inserting data into table "journal_entries" */
export type JournalEntries_Insert_Input = {
  body?: InputMaybe<Scalars['String']['input']>;
  entryDate?: InputMaybe<Scalars['date']['input']>;
  journalEntryLabels?: InputMaybe<JournalEntryLabels_Arr_Rel_Insert_Input>;
  title?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type JournalEntries_Max_Fields = {
  __typename?: 'journalEntries_max_fields';
  body?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  entryDate?: Maybe<Scalars['date']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
};

/** aggregate min on columns */
export type JournalEntries_Min_Fields = {
  __typename?: 'journalEntries_min_fields';
  body?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  entryDate?: Maybe<Scalars['date']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  title?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
};

/** response of any mutation on the table "journal_entries" */
export type JournalEntries_Mutation_Response = {
  __typename?: 'journalEntries_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<JournalEntries>;
};

/** input type for inserting object relation for remote table "journal_entries" */
export type JournalEntries_Obj_Rel_Insert_Input = {
  data: JournalEntries_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<JournalEntries_On_Conflict>;
};

/** on_conflict condition type for table "journal_entries" */
export type JournalEntries_On_Conflict = {
  constraint: JournalEntries_Constraint;
  update_columns?: Array<JournalEntries_Update_Column>;
  where?: InputMaybe<JournalEntries_Bool_Exp>;
};

/** Ordering options when selecting data from "journal_entries". */
export type JournalEntries_Order_By = {
  body?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  entryDate?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  journalEntryLabels_aggregate?: InputMaybe<JournalEntryLabels_Aggregate_Order_By>;
  title?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: journal_entries */
export type JournalEntries_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "journal_entries" */
export enum JournalEntries_Select_Column {
  /** column name */
  Body = 'body',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  EntryDate = 'entryDate',
  /** column name */
  Id = 'id',
  /** column name */
  Title = 'title',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UserId = 'userId'
}

/** input type for updating data in table "journal_entries" */
export type JournalEntries_Set_Input = {
  body?: InputMaybe<Scalars['String']['input']>;
  entryDate?: InputMaybe<Scalars['date']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

/** Streaming cursor of the table "journalEntries" */
export type JournalEntries_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: JournalEntries_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type JournalEntries_Stream_Cursor_Value_Input = {
  body?: InputMaybe<Scalars['String']['input']>;
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  entryDate?: InputMaybe<Scalars['date']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
  userId?: InputMaybe<Scalars['uuid']['input']>;
};

/** update columns of table "journal_entries" */
export enum JournalEntries_Update_Column {
  /** column name */
  Body = 'body',
  /** column name */
  EntryDate = 'entryDate',
  /** column name */
  Title = 'title'
}

export type JournalEntries_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<JournalEntries_Set_Input>;
  /** filter the rows which have to be updated */
  where: JournalEntries_Bool_Exp;
};

/** columns and relationships of "journal_entry_labels" */
export type JournalEntryLabels = {
  __typename?: 'journalEntryLabels';
  createdAt: Scalars['timestamptz']['output'];
  /** An object relationship */
  journalEntry: JournalEntries;
  journalEntryId: Scalars['uuid']['output'];
  /** An object relationship */
  label: JournalLabels;
  labelId: Scalars['uuid']['output'];
};

/** aggregated selection of "journal_entry_labels" */
export type JournalEntryLabels_Aggregate = {
  __typename?: 'journalEntryLabels_aggregate';
  aggregate?: Maybe<JournalEntryLabels_Aggregate_Fields>;
  nodes: Array<JournalEntryLabels>;
};

export type JournalEntryLabels_Aggregate_Bool_Exp = {
  count?: InputMaybe<JournalEntryLabels_Aggregate_Bool_Exp_Count>;
};

export type JournalEntryLabels_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<JournalEntryLabels_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<JournalEntryLabels_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "journal_entry_labels" */
export type JournalEntryLabels_Aggregate_Fields = {
  __typename?: 'journalEntryLabels_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<JournalEntryLabels_Max_Fields>;
  min?: Maybe<JournalEntryLabels_Min_Fields>;
};


/** aggregate fields of "journal_entry_labels" */
export type JournalEntryLabels_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<JournalEntryLabels_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "journal_entry_labels" */
export type JournalEntryLabels_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<JournalEntryLabels_Max_Order_By>;
  min?: InputMaybe<JournalEntryLabels_Min_Order_By>;
};

/** input type for inserting array relation for remote table "journal_entry_labels" */
export type JournalEntryLabels_Arr_Rel_Insert_Input = {
  data: Array<JournalEntryLabels_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<JournalEntryLabels_On_Conflict>;
};

/** Boolean expression to filter rows from the table "journal_entry_labels". All fields are combined with a logical 'AND'. */
export type JournalEntryLabels_Bool_Exp = {
  _and?: InputMaybe<Array<JournalEntryLabels_Bool_Exp>>;
  _not?: InputMaybe<JournalEntryLabels_Bool_Exp>;
  _or?: InputMaybe<Array<JournalEntryLabels_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  journalEntry?: InputMaybe<JournalEntries_Bool_Exp>;
  journalEntryId?: InputMaybe<Uuid_Comparison_Exp>;
  label?: InputMaybe<JournalLabels_Bool_Exp>;
  labelId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "journal_entry_labels" */
export enum JournalEntryLabels_Constraint {
  /** unique or primary key constraint on columns "label_id", "journal_entry_id" */
  JournalEntryLabelsPkey = 'journal_entry_labels_pkey'
}

/** input type for inserting data into table "journal_entry_labels" */
export type JournalEntryLabels_Insert_Input = {
  journalEntry?: InputMaybe<JournalEntries_Obj_Rel_Insert_Input>;
  journalEntryId?: InputMaybe<Scalars['uuid']['input']>;
  label?: InputMaybe<JournalLabels_Obj_Rel_Insert_Input>;
  labelId?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate max on columns */
export type JournalEntryLabels_Max_Fields = {
  __typename?: 'journalEntryLabels_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  journalEntryId?: Maybe<Scalars['uuid']['output']>;
  labelId?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "journal_entry_labels" */
export type JournalEntryLabels_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  journalEntryId?: InputMaybe<Order_By>;
  labelId?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type JournalEntryLabels_Min_Fields = {
  __typename?: 'journalEntryLabels_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  journalEntryId?: Maybe<Scalars['uuid']['output']>;
  labelId?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "journal_entry_labels" */
export type JournalEntryLabels_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  journalEntryId?: InputMaybe<Order_By>;
  labelId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "journal_entry_labels" */
export type JournalEntryLabels_Mutation_Response = {
  __typename?: 'journalEntryLabels_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<JournalEntryLabels>;
};

/** on_conflict condition type for table "journal_entry_labels" */
export type JournalEntryLabels_On_Conflict = {
  constraint: JournalEntryLabels_Constraint;
  update_columns?: Array<JournalEntryLabels_Update_Column>;
  where?: InputMaybe<JournalEntryLabels_Bool_Exp>;
};

/** Ordering options when selecting data from "journal_entry_labels". */
export type JournalEntryLabels_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  journalEntry?: InputMaybe<JournalEntries_Order_By>;
  journalEntryId?: InputMaybe<Order_By>;
  label?: InputMaybe<JournalLabels_Order_By>;
  labelId?: InputMaybe<Order_By>;
};

/** select columns of table "journal_entry_labels" */
export enum JournalEntryLabels_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  JournalEntryId = 'journalEntryId',
  /** column name */
  LabelId = 'labelId'
}

/** Streaming cursor of the table "journalEntryLabels" */
export type JournalEntryLabels_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: JournalEntryLabels_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type JournalEntryLabels_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  journalEntryId?: InputMaybe<Scalars['uuid']['input']>;
  labelId?: InputMaybe<Scalars['uuid']['input']>;
};

/** placeholder for update columns of table "journal_entry_labels" (current role has no relevant permissions) */
export enum JournalEntryLabels_Update_Column {
  /** placeholder (do not use) */
  Placeholder = '_PLACEHOLDER'
}

/** columns and relationships of "journal_labels" */
export type JournalLabels = {
  __typename?: 'journalLabels';
  createdAt: Scalars['timestamptz']['output'];
  id: Scalars['uuid']['output'];
  /** An array relationship */
  journalEntryLabels: Array<JournalEntryLabels>;
  /** An aggregate relationship */
  journalEntryLabels_aggregate: JournalEntryLabels_Aggregate;
  name: Scalars['String']['output'];
  updatedAt: Scalars['timestamptz']['output'];
  userId: Scalars['uuid']['output'];
};


/** columns and relationships of "journal_labels" */
export type JournalLabelsJournalEntryLabelsArgs = {
  distinct_on?: InputMaybe<Array<JournalEntryLabels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<JournalEntryLabels_Order_By>>;
  where?: InputMaybe<JournalEntryLabels_Bool_Exp>;
};


/** columns and relationships of "journal_labels" */
export type JournalLabelsJournalEntryLabels_AggregateArgs = {
  distinct_on?: InputMaybe<Array<JournalEntryLabels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<JournalEntryLabels_Order_By>>;
  where?: InputMaybe<JournalEntryLabels_Bool_Exp>;
};

/** aggregated selection of "journal_labels" */
export type JournalLabels_Aggregate = {
  __typename?: 'journalLabels_aggregate';
  aggregate?: Maybe<JournalLabels_Aggregate_Fields>;
  nodes: Array<JournalLabels>;
};

/** aggregate fields of "journal_labels" */
export type JournalLabels_Aggregate_Fields = {
  __typename?: 'journalLabels_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<JournalLabels_Max_Fields>;
  min?: Maybe<JournalLabels_Min_Fields>;
};


/** aggregate fields of "journal_labels" */
export type JournalLabels_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<JournalLabels_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "journal_labels". All fields are combined with a logical 'AND'. */
export type JournalLabels_Bool_Exp = {
  _and?: InputMaybe<Array<JournalLabels_Bool_Exp>>;
  _not?: InputMaybe<JournalLabels_Bool_Exp>;
  _or?: InputMaybe<Array<JournalLabels_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  journalEntryLabels?: InputMaybe<JournalEntryLabels_Bool_Exp>;
  journalEntryLabels_aggregate?: InputMaybe<JournalEntryLabels_Aggregate_Bool_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  userId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "journal_labels" */
export enum JournalLabels_Constraint {
  /** unique or primary key constraint on columns "id" */
  JournalLabelsPkey = 'journal_labels_pkey',
  /** unique or primary key constraint on columns "user_id", "name" */
  JournalLabelsUserNameKey = 'journal_labels_user_name_key'
}

/** input type for inserting data into table "journal_labels" */
export type JournalLabels_Insert_Input = {
  journalEntryLabels?: InputMaybe<JournalEntryLabels_Arr_Rel_Insert_Input>;
  name?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type JournalLabels_Max_Fields = {
  __typename?: 'journalLabels_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
};

/** aggregate min on columns */
export type JournalLabels_Min_Fields = {
  __typename?: 'journalLabels_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
};

/** response of any mutation on the table "journal_labels" */
export type JournalLabels_Mutation_Response = {
  __typename?: 'journalLabels_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<JournalLabels>;
};

/** input type for inserting object relation for remote table "journal_labels" */
export type JournalLabels_Obj_Rel_Insert_Input = {
  data: JournalLabels_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<JournalLabels_On_Conflict>;
};

/** on_conflict condition type for table "journal_labels" */
export type JournalLabels_On_Conflict = {
  constraint: JournalLabels_Constraint;
  update_columns?: Array<JournalLabels_Update_Column>;
  where?: InputMaybe<JournalLabels_Bool_Exp>;
};

/** Ordering options when selecting data from "journal_labels". */
export type JournalLabels_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  journalEntryLabels_aggregate?: InputMaybe<JournalEntryLabels_Aggregate_Order_By>;
  name?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: journal_labels */
export type JournalLabels_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "journal_labels" */
export enum JournalLabels_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UserId = 'userId'
}

/** input type for updating data in table "journal_labels" */
export type JournalLabels_Set_Input = {
  name?: InputMaybe<Scalars['String']['input']>;
};

/** Streaming cursor of the table "journalLabels" */
export type JournalLabels_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: JournalLabels_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type JournalLabels_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
  userId?: InputMaybe<Scalars['uuid']['input']>;
};

/** update columns of table "journal_labels" */
export enum JournalLabels_Update_Column {
  /** column name */
  Name = 'name'
}

export type JournalLabels_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<JournalLabels_Set_Input>;
  /** filter the rows which have to be updated */
  where: JournalLabels_Bool_Exp;
};

export type Jsonb_Cast_Exp = {
  String?: InputMaybe<String_Comparison_Exp>;
};

/** Boolean expression to compare columns of type "jsonb". All fields are combined with logical 'AND'. */
export type Jsonb_Comparison_Exp = {
  _cast?: InputMaybe<Jsonb_Cast_Exp>;
  /** is the column contained in the given json value */
  _contained_in?: InputMaybe<Scalars['jsonb']['input']>;
  /** does the column contain the given json value at the top level */
  _contains?: InputMaybe<Scalars['jsonb']['input']>;
  _eq?: InputMaybe<Scalars['jsonb']['input']>;
  _gt?: InputMaybe<Scalars['jsonb']['input']>;
  _gte?: InputMaybe<Scalars['jsonb']['input']>;
  /** does the string exist as a top-level key in the column */
  _has_key?: InputMaybe<Scalars['String']['input']>;
  /** do all of these strings exist as top-level keys in the column */
  _has_keys_all?: InputMaybe<Array<Scalars['String']['input']>>;
  /** do any of these strings exist as top-level keys in the column */
  _has_keys_any?: InputMaybe<Array<Scalars['String']['input']>>;
  _in?: InputMaybe<Array<Scalars['jsonb']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['jsonb']['input']>;
  _lte?: InputMaybe<Scalars['jsonb']['input']>;
  _neq?: InputMaybe<Scalars['jsonb']['input']>;
  _nin?: InputMaybe<Array<Scalars['jsonb']['input']>>;
};

/** columns and relationships of "labels" */
export type Labels = {
  __typename?: 'labels';
  createdAt: Scalars['timestamptz']['output'];
  id: Scalars['uuid']['output'];
  isPublic: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  updatedAt: Scalars['timestamptz']['output'];
  userId?: Maybe<Scalars['uuid']['output']>;
  /** An array relationship */
  workoutLabels: Array<WorkoutLabels>;
  /** An aggregate relationship */
  workoutLabels_aggregate: WorkoutLabels_Aggregate;
};


/** columns and relationships of "labels" */
export type LabelsWorkoutLabelsArgs = {
  distinct_on?: InputMaybe<Array<WorkoutLabels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutLabels_Order_By>>;
  where?: InputMaybe<WorkoutLabels_Bool_Exp>;
};


/** columns and relationships of "labels" */
export type LabelsWorkoutLabels_AggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutLabels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutLabels_Order_By>>;
  where?: InputMaybe<WorkoutLabels_Bool_Exp>;
};

/** aggregated selection of "labels" */
export type Labels_Aggregate = {
  __typename?: 'labels_aggregate';
  aggregate?: Maybe<Labels_Aggregate_Fields>;
  nodes: Array<Labels>;
};

/** aggregate fields of "labels" */
export type Labels_Aggregate_Fields = {
  __typename?: 'labels_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Labels_Max_Fields>;
  min?: Maybe<Labels_Min_Fields>;
};


/** aggregate fields of "labels" */
export type Labels_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Labels_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "labels". All fields are combined with a logical 'AND'. */
export type Labels_Bool_Exp = {
  _and?: InputMaybe<Array<Labels_Bool_Exp>>;
  _not?: InputMaybe<Labels_Bool_Exp>;
  _or?: InputMaybe<Array<Labels_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  isPublic?: InputMaybe<Boolean_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  userId?: InputMaybe<Uuid_Comparison_Exp>;
  workoutLabels?: InputMaybe<WorkoutLabels_Bool_Exp>;
  workoutLabels_aggregate?: InputMaybe<WorkoutLabels_Aggregate_Bool_Exp>;
};

/** unique or primary key constraints on table "labels" */
export enum Labels_Constraint {
  /** unique or primary key constraint on columns "id" */
  LabelsPkey = 'labels_pkey',
  /** unique or primary key constraint on columns "user_id", "name" */
  LabelsUserNameKey = 'labels_user_name_key'
}

/** input type for inserting data into table "labels" */
export type Labels_Insert_Input = {
  name?: InputMaybe<Scalars['String']['input']>;
  workoutLabels?: InputMaybe<WorkoutLabels_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type Labels_Max_Fields = {
  __typename?: 'labels_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
};

/** aggregate min on columns */
export type Labels_Min_Fields = {
  __typename?: 'labels_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
};

/** response of any mutation on the table "labels" */
export type Labels_Mutation_Response = {
  __typename?: 'labels_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Labels>;
};

/** input type for inserting object relation for remote table "labels" */
export type Labels_Obj_Rel_Insert_Input = {
  data: Labels_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Labels_On_Conflict>;
};

/** on_conflict condition type for table "labels" */
export type Labels_On_Conflict = {
  constraint: Labels_Constraint;
  update_columns?: Array<Labels_Update_Column>;
  where?: InputMaybe<Labels_Bool_Exp>;
};

/** Ordering options when selecting data from "labels". */
export type Labels_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  isPublic?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
  workoutLabels_aggregate?: InputMaybe<WorkoutLabels_Aggregate_Order_By>;
};

/** primary key columns input for table: labels */
export type Labels_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "labels" */
export enum Labels_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  IsPublic = 'isPublic',
  /** column name */
  Name = 'name',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UserId = 'userId'
}

/** input type for updating data in table "labels" */
export type Labels_Set_Input = {
  name?: InputMaybe<Scalars['String']['input']>;
};

/** Streaming cursor of the table "labels" */
export type Labels_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Labels_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Labels_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
  userId?: InputMaybe<Scalars['uuid']['input']>;
};

/** update columns of table "labels" */
export enum Labels_Update_Column {
  /** column name */
  Name = 'name'
}

export type Labels_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Labels_Set_Input>;
  /** filter the rows which have to be updated */
  where: Labels_Bool_Exp;
};

/** columns and relationships of "muscle_groups" */
export type MuscleGroups = {
  __typename?: 'muscleGroups';
  comment?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  exerciseSecondaryMuscleGroups: Array<ExerciseSecondaryMuscleGroups>;
  /** An aggregate relationship */
  exerciseSecondaryMuscleGroups_aggregate: ExerciseSecondaryMuscleGroups_Aggregate;
  /** An array relationship */
  exercises: Array<Exercises>;
  /** An aggregate relationship */
  exercises_aggregate: Exercises_Aggregate;
  value: Scalars['String']['output'];
};


/** columns and relationships of "muscle_groups" */
export type MuscleGroupsExerciseSecondaryMuscleGroupsArgs = {
  distinct_on?: InputMaybe<Array<ExerciseSecondaryMuscleGroups_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseSecondaryMuscleGroups_Order_By>>;
  where?: InputMaybe<ExerciseSecondaryMuscleGroups_Bool_Exp>;
};


/** columns and relationships of "muscle_groups" */
export type MuscleGroupsExerciseSecondaryMuscleGroups_AggregateArgs = {
  distinct_on?: InputMaybe<Array<ExerciseSecondaryMuscleGroups_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseSecondaryMuscleGroups_Order_By>>;
  where?: InputMaybe<ExerciseSecondaryMuscleGroups_Bool_Exp>;
};


/** columns and relationships of "muscle_groups" */
export type MuscleGroupsExercisesArgs = {
  distinct_on?: InputMaybe<Array<Exercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Exercises_Order_By>>;
  where?: InputMaybe<Exercises_Bool_Exp>;
};


/** columns and relationships of "muscle_groups" */
export type MuscleGroupsExercises_AggregateArgs = {
  distinct_on?: InputMaybe<Array<Exercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Exercises_Order_By>>;
  where?: InputMaybe<Exercises_Bool_Exp>;
};

/** aggregated selection of "muscle_groups" */
export type MuscleGroups_Aggregate = {
  __typename?: 'muscleGroups_aggregate';
  aggregate?: Maybe<MuscleGroups_Aggregate_Fields>;
  nodes: Array<MuscleGroups>;
};

/** aggregate fields of "muscle_groups" */
export type MuscleGroups_Aggregate_Fields = {
  __typename?: 'muscleGroups_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<MuscleGroups_Max_Fields>;
  min?: Maybe<MuscleGroups_Min_Fields>;
};


/** aggregate fields of "muscle_groups" */
export type MuscleGroups_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<MuscleGroups_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "muscle_groups". All fields are combined with a logical 'AND'. */
export type MuscleGroups_Bool_Exp = {
  _and?: InputMaybe<Array<MuscleGroups_Bool_Exp>>;
  _not?: InputMaybe<MuscleGroups_Bool_Exp>;
  _or?: InputMaybe<Array<MuscleGroups_Bool_Exp>>;
  comment?: InputMaybe<String_Comparison_Exp>;
  exerciseSecondaryMuscleGroups?: InputMaybe<ExerciseSecondaryMuscleGroups_Bool_Exp>;
  exerciseSecondaryMuscleGroups_aggregate?: InputMaybe<ExerciseSecondaryMuscleGroups_Aggregate_Bool_Exp>;
  exercises?: InputMaybe<Exercises_Bool_Exp>;
  exercises_aggregate?: InputMaybe<Exercises_Aggregate_Bool_Exp>;
  value?: InputMaybe<String_Comparison_Exp>;
};

export enum MuscleGroups_Enum {
  Abdominals = 'abdominals',
  Abductors = 'abductors',
  Adductors = 'adductors',
  Biceps = 'biceps',
  Calves = 'calves',
  Chest = 'chest',
  Forearms = 'forearms',
  Glutes = 'glutes',
  Hamstrings = 'hamstrings',
  Lats = 'lats',
  LowerBack = 'lower_back',
  MiddleBack = 'middle_back',
  Neck = 'neck',
  Quadriceps = 'quadriceps',
  Shoulders = 'shoulders',
  Traps = 'traps',
  Triceps = 'triceps'
}

/** Boolean expression to compare columns of type "muscleGroups_enum". All fields are combined with logical 'AND'. */
export type MuscleGroups_Enum_Comparison_Exp = {
  _eq?: InputMaybe<MuscleGroups_Enum>;
  _in?: InputMaybe<Array<MuscleGroups_Enum>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _neq?: InputMaybe<MuscleGroups_Enum>;
  _nin?: InputMaybe<Array<MuscleGroups_Enum>>;
};

/** aggregate max on columns */
export type MuscleGroups_Max_Fields = {
  __typename?: 'muscleGroups_max_fields';
  comment?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

/** aggregate min on columns */
export type MuscleGroups_Min_Fields = {
  __typename?: 'muscleGroups_min_fields';
  comment?: Maybe<Scalars['String']['output']>;
  value?: Maybe<Scalars['String']['output']>;
};

/** Ordering options when selecting data from "muscle_groups". */
export type MuscleGroups_Order_By = {
  comment?: InputMaybe<Order_By>;
  exerciseSecondaryMuscleGroups_aggregate?: InputMaybe<ExerciseSecondaryMuscleGroups_Aggregate_Order_By>;
  exercises_aggregate?: InputMaybe<Exercises_Aggregate_Order_By>;
  value?: InputMaybe<Order_By>;
};

/** select columns of table "muscle_groups" */
export enum MuscleGroups_Select_Column {
  /** column name */
  Comment = 'comment',
  /** column name */
  Value = 'value'
}

/** Streaming cursor of the table "muscleGroups" */
export type MuscleGroups_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: MuscleGroups_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type MuscleGroups_Stream_Cursor_Value_Input = {
  comment?: InputMaybe<Scalars['String']['input']>;
  value?: InputMaybe<Scalars['String']['input']>;
};

/** mutation root */
export type Mutation_Root = {
  __typename?: 'mutation_root';
  /** delete single row from the table: "body_measurements" */
  deleteBodyMeasurement?: Maybe<BodyMeasurements>;
  /** delete data from the table: "body_measurements" */
  deleteBodyMeasurements?: Maybe<BodyMeasurements_Mutation_Response>;
  /** delete single row from the table: "exercises" */
  deleteExercise?: Maybe<Exercises>;
  /** delete data from the table: "exercises" */
  deleteExercises?: Maybe<Exercises_Mutation_Response>;
  /** delete data from the table: "journal_entries" */
  deleteJournalEntries?: Maybe<JournalEntries_Mutation_Response>;
  /** delete single row from the table: "journal_entries" */
  deleteJournalEntry?: Maybe<JournalEntries>;
  /** delete single row from the table: "journal_entry_labels" */
  deleteJournalEntryLabel?: Maybe<JournalEntryLabels>;
  /** delete data from the table: "journal_entry_labels" */
  deleteJournalEntryLabels?: Maybe<JournalEntryLabels_Mutation_Response>;
  /** delete single row from the table: "journal_labels" */
  deleteJournalLabel?: Maybe<JournalLabels>;
  /** delete data from the table: "journal_labels" */
  deleteJournalLabels?: Maybe<JournalLabels_Mutation_Response>;
  /** delete single row from the table: "labels" */
  deleteLabel?: Maybe<Labels>;
  /** delete data from the table: "labels" */
  deleteLabels?: Maybe<Labels_Mutation_Response>;
  /** delete single row from the table: "workouts" */
  deleteWorkout?: Maybe<Workouts>;
  /** delete single row from the table: "workout_exercises" */
  deleteWorkoutExercise?: Maybe<WorkoutExercises>;
  /** delete data from the table: "workout_exercises" */
  deleteWorkoutExercises?: Maybe<WorkoutExercises_Mutation_Response>;
  /** delete single row from the table: "workout_labels" */
  deleteWorkoutLabel?: Maybe<WorkoutLabels>;
  /** delete data from the table: "workout_labels" */
  deleteWorkoutLabels?: Maybe<WorkoutLabels_Mutation_Response>;
  /** delete single row from the table: "workout_sessions" */
  deleteWorkoutSession?: Maybe<WorkoutSessions>;
  /** delete data from the table: "workout_session_cardio_entries" */
  deleteWorkoutSessionCardioEntries?: Maybe<WorkoutSessionCardioEntries_Mutation_Response>;
  /** delete single row from the table: "workout_session_cardio_entries" */
  deleteWorkoutSessionCardioEntry?: Maybe<WorkoutSessionCardioEntries>;
  /** delete single row from the table: "workout_session_exercises" */
  deleteWorkoutSessionExercise?: Maybe<WorkoutSessionExercises>;
  /** delete data from the table: "workout_session_exercises" */
  deleteWorkoutSessionExercises?: Maybe<WorkoutSessionExercises_Mutation_Response>;
  /** delete single row from the table: "workout_session_sets" */
  deleteWorkoutSessionSet?: Maybe<WorkoutSessionSets>;
  /** delete data from the table: "workout_session_sets" */
  deleteWorkoutSessionSets?: Maybe<WorkoutSessionSets_Mutation_Response>;
  /** delete data from the table: "workout_sessions" */
  deleteWorkoutSessions?: Maybe<WorkoutSessions_Mutation_Response>;
  /** delete data from the table: "workouts" */
  deleteWorkouts?: Maybe<Workouts_Mutation_Response>;
  /** insert a single row into the table: "body_measurements" */
  insertBodyMeasurement?: Maybe<BodyMeasurements>;
  /** insert data into the table: "body_measurements" */
  insertBodyMeasurements?: Maybe<BodyMeasurements_Mutation_Response>;
  /** insert a single row into the table: "exercises" */
  insertExercise?: Maybe<Exercises>;
  /** insert data into the table: "exercises" */
  insertExercises?: Maybe<Exercises_Mutation_Response>;
  /** insert data into the table: "journal_entries" */
  insertJournalEntries?: Maybe<JournalEntries_Mutation_Response>;
  /** insert a single row into the table: "journal_entries" */
  insertJournalEntry?: Maybe<JournalEntries>;
  /** insert a single row into the table: "journal_entry_labels" */
  insertJournalEntryLabel?: Maybe<JournalEntryLabels>;
  /** insert data into the table: "journal_entry_labels" */
  insertJournalEntryLabels?: Maybe<JournalEntryLabels_Mutation_Response>;
  /** insert a single row into the table: "journal_labels" */
  insertJournalLabel?: Maybe<JournalLabels>;
  /** insert data into the table: "journal_labels" */
  insertJournalLabels?: Maybe<JournalLabels_Mutation_Response>;
  /** insert a single row into the table: "labels" */
  insertLabel?: Maybe<Labels>;
  /** insert data into the table: "labels" */
  insertLabels?: Maybe<Labels_Mutation_Response>;
  /** insert a single row into the table: "workouts" */
  insertWorkout?: Maybe<Workouts>;
  /** insert a single row into the table: "workout_exercises" */
  insertWorkoutExercise?: Maybe<WorkoutExercises>;
  /** insert data into the table: "workout_exercises" */
  insertWorkoutExercises?: Maybe<WorkoutExercises_Mutation_Response>;
  /** insert a single row into the table: "workout_labels" */
  insertWorkoutLabel?: Maybe<WorkoutLabels>;
  /** insert data into the table: "workout_labels" */
  insertWorkoutLabels?: Maybe<WorkoutLabels_Mutation_Response>;
  /** insert a single row into the table: "workout_sessions" */
  insertWorkoutSession?: Maybe<WorkoutSessions>;
  /** insert data into the table: "workout_session_cardio_entries" */
  insertWorkoutSessionCardioEntries?: Maybe<WorkoutSessionCardioEntries_Mutation_Response>;
  /** insert a single row into the table: "workout_session_cardio_entries" */
  insertWorkoutSessionCardioEntry?: Maybe<WorkoutSessionCardioEntries>;
  /** insert a single row into the table: "workout_session_exercises" */
  insertWorkoutSessionExercise?: Maybe<WorkoutSessionExercises>;
  /** insert data into the table: "workout_session_exercises" */
  insertWorkoutSessionExercises?: Maybe<WorkoutSessionExercises_Mutation_Response>;
  /** insert a single row into the table: "workout_session_sets" */
  insertWorkoutSessionSet?: Maybe<WorkoutSessionSets>;
  /** insert data into the table: "workout_session_sets" */
  insertWorkoutSessionSets?: Maybe<WorkoutSessionSets_Mutation_Response>;
  /** insert data into the table: "workout_sessions" */
  insertWorkoutSessions?: Maybe<WorkoutSessions_Mutation_Response>;
  /** insert data into the table: "workouts" */
  insertWorkouts?: Maybe<Workouts_Mutation_Response>;
  /** update single row of the table: "body_measurements" */
  updateBodyMeasurement?: Maybe<BodyMeasurements>;
  /** update data of the table: "body_measurements" */
  updateBodyMeasurements?: Maybe<BodyMeasurements_Mutation_Response>;
  /** update single row of the table: "exercises" */
  updateExercise?: Maybe<Exercises>;
  /** update data of the table: "exercises" */
  updateExercises?: Maybe<Exercises_Mutation_Response>;
  /** update data of the table: "journal_entries" */
  updateJournalEntries?: Maybe<JournalEntries_Mutation_Response>;
  /** update single row of the table: "journal_entries" */
  updateJournalEntry?: Maybe<JournalEntries>;
  /** update single row of the table: "journal_labels" */
  updateJournalLabel?: Maybe<JournalLabels>;
  /** update data of the table: "journal_labels" */
  updateJournalLabels?: Maybe<JournalLabels_Mutation_Response>;
  /** update single row of the table: "labels" */
  updateLabel?: Maybe<Labels>;
  /** update data of the table: "labels" */
  updateLabels?: Maybe<Labels_Mutation_Response>;
  /** update single row of the table: "workouts" */
  updateWorkout?: Maybe<Workouts>;
  /** update single row of the table: "workout_exercises" */
  updateWorkoutExercise?: Maybe<WorkoutExercises>;
  /** update data of the table: "workout_exercises" */
  updateWorkoutExercises?: Maybe<WorkoutExercises_Mutation_Response>;
  /** update single row of the table: "workout_sessions" */
  updateWorkoutSession?: Maybe<WorkoutSessions>;
  /** update data of the table: "workout_session_cardio_entries" */
  updateWorkoutSessionCardioEntries?: Maybe<WorkoutSessionCardioEntries_Mutation_Response>;
  /** update single row of the table: "workout_session_cardio_entries" */
  updateWorkoutSessionCardioEntry?: Maybe<WorkoutSessionCardioEntries>;
  /** update single row of the table: "workout_session_exercises" */
  updateWorkoutSessionExercise?: Maybe<WorkoutSessionExercises>;
  /** update data of the table: "workout_session_exercises" */
  updateWorkoutSessionExercises?: Maybe<WorkoutSessionExercises_Mutation_Response>;
  /** update single row of the table: "workout_session_sets" */
  updateWorkoutSessionSet?: Maybe<WorkoutSessionSets>;
  /** update data of the table: "workout_session_sets" */
  updateWorkoutSessionSets?: Maybe<WorkoutSessionSets_Mutation_Response>;
  /** update data of the table: "workout_sessions" */
  updateWorkoutSessions?: Maybe<WorkoutSessions_Mutation_Response>;
  /** update data of the table: "workouts" */
  updateWorkouts?: Maybe<Workouts_Mutation_Response>;
  /** update multiples rows of table: "body_measurements" */
  update_bodyMeasurements_many?: Maybe<Array<Maybe<BodyMeasurements_Mutation_Response>>>;
  /** update multiples rows of table: "exercises" */
  update_exercises_many?: Maybe<Array<Maybe<Exercises_Mutation_Response>>>;
  /** update multiples rows of table: "journal_entries" */
  update_journalEntries_many?: Maybe<Array<Maybe<JournalEntries_Mutation_Response>>>;
  /** update multiples rows of table: "journal_labels" */
  update_journalLabels_many?: Maybe<Array<Maybe<JournalLabels_Mutation_Response>>>;
  /** update multiples rows of table: "labels" */
  update_labels_many?: Maybe<Array<Maybe<Labels_Mutation_Response>>>;
  /** update multiples rows of table: "workout_exercises" */
  update_workoutExercises_many?: Maybe<Array<Maybe<WorkoutExercises_Mutation_Response>>>;
  /** update multiples rows of table: "workout_session_cardio_entries" */
  update_workoutSessionCardioEntries_many?: Maybe<Array<Maybe<WorkoutSessionCardioEntries_Mutation_Response>>>;
  /** update multiples rows of table: "workout_session_exercises" */
  update_workoutSessionExercises_many?: Maybe<Array<Maybe<WorkoutSessionExercises_Mutation_Response>>>;
  /** update multiples rows of table: "workout_session_sets" */
  update_workoutSessionSets_many?: Maybe<Array<Maybe<WorkoutSessionSets_Mutation_Response>>>;
  /** update multiples rows of table: "workout_sessions" */
  update_workoutSessions_many?: Maybe<Array<Maybe<WorkoutSessions_Mutation_Response>>>;
  /** update multiples rows of table: "workouts" */
  update_workouts_many?: Maybe<Array<Maybe<Workouts_Mutation_Response>>>;
};


/** mutation root */
export type Mutation_RootDeleteBodyMeasurementArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteBodyMeasurementsArgs = {
  where: BodyMeasurements_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteExerciseArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteExercisesArgs = {
  where: Exercises_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteJournalEntriesArgs = {
  where: JournalEntries_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteJournalEntryArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteJournalEntryLabelArgs = {
  journalEntryId: Scalars['uuid']['input'];
  labelId: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteJournalEntryLabelsArgs = {
  where: JournalEntryLabels_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteJournalLabelArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteJournalLabelsArgs = {
  where: JournalLabels_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteLabelArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteLabelsArgs = {
  where: Labels_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteWorkoutArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteWorkoutExerciseArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteWorkoutExercisesArgs = {
  where: WorkoutExercises_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteWorkoutLabelArgs = {
  labelId: Scalars['uuid']['input'];
  workoutId: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteWorkoutLabelsArgs = {
  where: WorkoutLabels_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteWorkoutSessionArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteWorkoutSessionCardioEntriesArgs = {
  where: WorkoutSessionCardioEntries_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteWorkoutSessionCardioEntryArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteWorkoutSessionExerciseArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteWorkoutSessionExercisesArgs = {
  where: WorkoutSessionExercises_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteWorkoutSessionSetArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteWorkoutSessionSetsArgs = {
  where: WorkoutSessionSets_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteWorkoutSessionsArgs = {
  where: WorkoutSessions_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteWorkoutsArgs = {
  where: Workouts_Bool_Exp;
};


/** mutation root */
export type Mutation_RootInsertBodyMeasurementArgs = {
  object: BodyMeasurements_Insert_Input;
  on_conflict?: InputMaybe<BodyMeasurements_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertBodyMeasurementsArgs = {
  objects: Array<BodyMeasurements_Insert_Input>;
  on_conflict?: InputMaybe<BodyMeasurements_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertExerciseArgs = {
  object: Exercises_Insert_Input;
  on_conflict?: InputMaybe<Exercises_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertExercisesArgs = {
  objects: Array<Exercises_Insert_Input>;
  on_conflict?: InputMaybe<Exercises_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertJournalEntriesArgs = {
  objects: Array<JournalEntries_Insert_Input>;
  on_conflict?: InputMaybe<JournalEntries_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertJournalEntryArgs = {
  object: JournalEntries_Insert_Input;
  on_conflict?: InputMaybe<JournalEntries_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertJournalEntryLabelArgs = {
  object: JournalEntryLabels_Insert_Input;
  on_conflict?: InputMaybe<JournalEntryLabels_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertJournalEntryLabelsArgs = {
  objects: Array<JournalEntryLabels_Insert_Input>;
  on_conflict?: InputMaybe<JournalEntryLabels_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertJournalLabelArgs = {
  object: JournalLabels_Insert_Input;
  on_conflict?: InputMaybe<JournalLabels_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertJournalLabelsArgs = {
  objects: Array<JournalLabels_Insert_Input>;
  on_conflict?: InputMaybe<JournalLabels_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertLabelArgs = {
  object: Labels_Insert_Input;
  on_conflict?: InputMaybe<Labels_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertLabelsArgs = {
  objects: Array<Labels_Insert_Input>;
  on_conflict?: InputMaybe<Labels_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkoutArgs = {
  object: Workouts_Insert_Input;
  on_conflict?: InputMaybe<Workouts_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkoutExerciseArgs = {
  object: WorkoutExercises_Insert_Input;
  on_conflict?: InputMaybe<WorkoutExercises_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkoutExercisesArgs = {
  objects: Array<WorkoutExercises_Insert_Input>;
  on_conflict?: InputMaybe<WorkoutExercises_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkoutLabelArgs = {
  object: WorkoutLabels_Insert_Input;
  on_conflict?: InputMaybe<WorkoutLabels_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkoutLabelsArgs = {
  objects: Array<WorkoutLabels_Insert_Input>;
  on_conflict?: InputMaybe<WorkoutLabels_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkoutSessionArgs = {
  object: WorkoutSessions_Insert_Input;
  on_conflict?: InputMaybe<WorkoutSessions_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkoutSessionCardioEntriesArgs = {
  objects: Array<WorkoutSessionCardioEntries_Insert_Input>;
  on_conflict?: InputMaybe<WorkoutSessionCardioEntries_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkoutSessionCardioEntryArgs = {
  object: WorkoutSessionCardioEntries_Insert_Input;
  on_conflict?: InputMaybe<WorkoutSessionCardioEntries_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkoutSessionExerciseArgs = {
  object: WorkoutSessionExercises_Insert_Input;
  on_conflict?: InputMaybe<WorkoutSessionExercises_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkoutSessionExercisesArgs = {
  objects: Array<WorkoutSessionExercises_Insert_Input>;
  on_conflict?: InputMaybe<WorkoutSessionExercises_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkoutSessionSetArgs = {
  object: WorkoutSessionSets_Insert_Input;
  on_conflict?: InputMaybe<WorkoutSessionSets_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkoutSessionSetsArgs = {
  objects: Array<WorkoutSessionSets_Insert_Input>;
  on_conflict?: InputMaybe<WorkoutSessionSets_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkoutSessionsArgs = {
  objects: Array<WorkoutSessions_Insert_Input>;
  on_conflict?: InputMaybe<WorkoutSessions_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkoutsArgs = {
  objects: Array<Workouts_Insert_Input>;
  on_conflict?: InputMaybe<Workouts_On_Conflict>;
};


/** mutation root */
export type Mutation_RootUpdateBodyMeasurementArgs = {
  _inc?: InputMaybe<BodyMeasurements_Inc_Input>;
  _set?: InputMaybe<BodyMeasurements_Set_Input>;
  pk_columns: BodyMeasurements_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateBodyMeasurementsArgs = {
  _inc?: InputMaybe<BodyMeasurements_Inc_Input>;
  _set?: InputMaybe<BodyMeasurements_Set_Input>;
  where: BodyMeasurements_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateExerciseArgs = {
  _append?: InputMaybe<Exercises_Append_Input>;
  _delete_at_path?: InputMaybe<Exercises_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Exercises_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Exercises_Delete_Key_Input>;
  _prepend?: InputMaybe<Exercises_Prepend_Input>;
  _set?: InputMaybe<Exercises_Set_Input>;
  pk_columns: Exercises_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateExercisesArgs = {
  _append?: InputMaybe<Exercises_Append_Input>;
  _delete_at_path?: InputMaybe<Exercises_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<Exercises_Delete_Elem_Input>;
  _delete_key?: InputMaybe<Exercises_Delete_Key_Input>;
  _prepend?: InputMaybe<Exercises_Prepend_Input>;
  _set?: InputMaybe<Exercises_Set_Input>;
  where: Exercises_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateJournalEntriesArgs = {
  _set?: InputMaybe<JournalEntries_Set_Input>;
  where: JournalEntries_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateJournalEntryArgs = {
  _set?: InputMaybe<JournalEntries_Set_Input>;
  pk_columns: JournalEntries_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateJournalLabelArgs = {
  _set?: InputMaybe<JournalLabels_Set_Input>;
  pk_columns: JournalLabels_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateJournalLabelsArgs = {
  _set?: InputMaybe<JournalLabels_Set_Input>;
  where: JournalLabels_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateLabelArgs = {
  _set?: InputMaybe<Labels_Set_Input>;
  pk_columns: Labels_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateLabelsArgs = {
  _set?: InputMaybe<Labels_Set_Input>;
  where: Labels_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateWorkoutArgs = {
  _set?: InputMaybe<Workouts_Set_Input>;
  pk_columns: Workouts_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateWorkoutExerciseArgs = {
  _inc?: InputMaybe<WorkoutExercises_Inc_Input>;
  _set?: InputMaybe<WorkoutExercises_Set_Input>;
  pk_columns: WorkoutExercises_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateWorkoutExercisesArgs = {
  _inc?: InputMaybe<WorkoutExercises_Inc_Input>;
  _set?: InputMaybe<WorkoutExercises_Set_Input>;
  where: WorkoutExercises_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateWorkoutSessionArgs = {
  _set?: InputMaybe<WorkoutSessions_Set_Input>;
  pk_columns: WorkoutSessions_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateWorkoutSessionCardioEntriesArgs = {
  _append?: InputMaybe<WorkoutSessionCardioEntries_Append_Input>;
  _delete_at_path?: InputMaybe<WorkoutSessionCardioEntries_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<WorkoutSessionCardioEntries_Delete_Elem_Input>;
  _delete_key?: InputMaybe<WorkoutSessionCardioEntries_Delete_Key_Input>;
  _inc?: InputMaybe<WorkoutSessionCardioEntries_Inc_Input>;
  _prepend?: InputMaybe<WorkoutSessionCardioEntries_Prepend_Input>;
  _set?: InputMaybe<WorkoutSessionCardioEntries_Set_Input>;
  where: WorkoutSessionCardioEntries_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateWorkoutSessionCardioEntryArgs = {
  _append?: InputMaybe<WorkoutSessionCardioEntries_Append_Input>;
  _delete_at_path?: InputMaybe<WorkoutSessionCardioEntries_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<WorkoutSessionCardioEntries_Delete_Elem_Input>;
  _delete_key?: InputMaybe<WorkoutSessionCardioEntries_Delete_Key_Input>;
  _inc?: InputMaybe<WorkoutSessionCardioEntries_Inc_Input>;
  _prepend?: InputMaybe<WorkoutSessionCardioEntries_Prepend_Input>;
  _set?: InputMaybe<WorkoutSessionCardioEntries_Set_Input>;
  pk_columns: WorkoutSessionCardioEntries_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateWorkoutSessionExerciseArgs = {
  _inc?: InputMaybe<WorkoutSessionExercises_Inc_Input>;
  _set?: InputMaybe<WorkoutSessionExercises_Set_Input>;
  pk_columns: WorkoutSessionExercises_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateWorkoutSessionExercisesArgs = {
  _inc?: InputMaybe<WorkoutSessionExercises_Inc_Input>;
  _set?: InputMaybe<WorkoutSessionExercises_Set_Input>;
  where: WorkoutSessionExercises_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateWorkoutSessionSetArgs = {
  _inc?: InputMaybe<WorkoutSessionSets_Inc_Input>;
  _set?: InputMaybe<WorkoutSessionSets_Set_Input>;
  pk_columns: WorkoutSessionSets_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateWorkoutSessionSetsArgs = {
  _inc?: InputMaybe<WorkoutSessionSets_Inc_Input>;
  _set?: InputMaybe<WorkoutSessionSets_Set_Input>;
  where: WorkoutSessionSets_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateWorkoutSessionsArgs = {
  _set?: InputMaybe<WorkoutSessions_Set_Input>;
  where: WorkoutSessions_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateWorkoutsArgs = {
  _set?: InputMaybe<Workouts_Set_Input>;
  where: Workouts_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdate_BodyMeasurements_ManyArgs = {
  updates: Array<BodyMeasurements_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Exercises_ManyArgs = {
  updates: Array<Exercises_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_JournalEntries_ManyArgs = {
  updates: Array<JournalEntries_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_JournalLabels_ManyArgs = {
  updates: Array<JournalLabels_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Labels_ManyArgs = {
  updates: Array<Labels_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_WorkoutExercises_ManyArgs = {
  updates: Array<WorkoutExercises_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_WorkoutSessionCardioEntries_ManyArgs = {
  updates: Array<WorkoutSessionCardioEntries_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_WorkoutSessionExercises_ManyArgs = {
  updates: Array<WorkoutSessionExercises_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_WorkoutSessionSets_ManyArgs = {
  updates: Array<WorkoutSessionSets_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_WorkoutSessions_ManyArgs = {
  updates: Array<WorkoutSessions_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Workouts_ManyArgs = {
  updates: Array<Workouts_Updates>;
};

/** Boolean expression to compare columns of type "numeric". All fields are combined with logical 'AND'. */
export type Numeric_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['numeric']['input']>;
  _gt?: InputMaybe<Scalars['numeric']['input']>;
  _gte?: InputMaybe<Scalars['numeric']['input']>;
  _in?: InputMaybe<Array<Scalars['numeric']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['numeric']['input']>;
  _lte?: InputMaybe<Scalars['numeric']['input']>;
  _neq?: InputMaybe<Scalars['numeric']['input']>;
  _nin?: InputMaybe<Array<Scalars['numeric']['input']>>;
};

/** column ordering options */
export enum Order_By {
  /** in ascending order, nulls last */
  Asc = 'asc',
  /** in ascending order, nulls first */
  AscNullsFirst = 'asc_nulls_first',
  /** in ascending order, nulls last */
  AscNullsLast = 'asc_nulls_last',
  /** in descending order, nulls first */
  Desc = 'desc',
  /** in descending order, nulls first */
  DescNullsFirst = 'desc_nulls_first',
  /** in descending order, nulls last */
  DescNullsLast = 'desc_nulls_last'
}

export type Query_Root = {
  __typename?: 'query_root';
  /** fetch data from the table: "body_measurements" using primary key columns */
  bodyMeasurement?: Maybe<BodyMeasurements>;
  /** fetch data from the table: "body_measurements" */
  bodyMeasurements: Array<BodyMeasurements>;
  /** fetch aggregated fields from the table: "body_measurements" */
  bodyMeasurementsAggregate: BodyMeasurements_Aggregate;
  /** fetch data from the table: "exercises" using primary key columns */
  exercise?: Maybe<Exercises>;
  /** fetch data from the table: "exercise_categories" */
  exerciseCategories: Array<ExerciseCategories>;
  /** fetch aggregated fields from the table: "exercise_categories" */
  exerciseCategoriesAggregate: ExerciseCategories_Aggregate;
  /** fetch data from the table: "exercise_categories" using primary key columns */
  exerciseCategory?: Maybe<ExerciseCategories>;
  /** fetch data from the table: "exercise_equipments" using primary key columns */
  exerciseEquipment?: Maybe<ExerciseEquipments>;
  /** fetch data from the table: "exercise_equipments" */
  exerciseEquipments: Array<ExerciseEquipments>;
  /** fetch aggregated fields from the table: "exercise_equipments" */
  exerciseEquipmentsAggregate: ExerciseEquipments_Aggregate;
  /** fetch data from the table: "exercise_forces" using primary key columns */
  exerciseForce?: Maybe<ExerciseForces>;
  /** fetch data from the table: "exercise_forces" */
  exerciseForces: Array<ExerciseForces>;
  /** fetch aggregated fields from the table: "exercise_forces" */
  exerciseForcesAggregate: ExerciseForces_Aggregate;
  /** fetch data from the table: "exercise_levels" using primary key columns */
  exerciseLevel?: Maybe<ExerciseLevels>;
  /** fetch data from the table: "exercise_levels" */
  exerciseLevels: Array<ExerciseLevels>;
  /** fetch aggregated fields from the table: "exercise_levels" */
  exerciseLevelsAggregate: ExerciseLevels_Aggregate;
  /** fetch data from the table: "exercise_mechanics" using primary key columns */
  exerciseMechanic?: Maybe<ExerciseMechanics>;
  /** fetch data from the table: "exercise_mechanics" */
  exerciseMechanics: Array<ExerciseMechanics>;
  /** fetch aggregated fields from the table: "exercise_mechanics" */
  exerciseMechanicsAggregate: ExerciseMechanics_Aggregate;
  /** fetch data from the table: "exercise_secondary_muscle_groups" using primary key columns */
  exerciseSecondaryMuscleGroup?: Maybe<ExerciseSecondaryMuscleGroups>;
  /** An array relationship */
  exerciseSecondaryMuscleGroups: Array<ExerciseSecondaryMuscleGroups>;
  /** fetch aggregated fields from the table: "exercise_secondary_muscle_groups" */
  exerciseSecondaryMuscleGroupsAggregate: ExerciseSecondaryMuscleGroups_Aggregate;
  /** An array relationship */
  exercises: Array<Exercises>;
  /** fetch aggregated fields from the table: "exercises" */
  exercisesAggregate: Exercises_Aggregate;
  /** fetch data from the table: "storage.files" using primary key columns */
  file?: Maybe<Files>;
  /** fetch data from the table: "storage.files" */
  files: Array<Files>;
  /** fetch data from the table: "journal_entries" */
  journalEntries: Array<JournalEntries>;
  /** fetch aggregated fields from the table: "journal_entries" */
  journalEntriesAggregate: JournalEntries_Aggregate;
  /** fetch data from the table: "journal_entries" using primary key columns */
  journalEntry?: Maybe<JournalEntries>;
  /** fetch data from the table: "journal_entry_labels" using primary key columns */
  journalEntryLabel?: Maybe<JournalEntryLabels>;
  /** An array relationship */
  journalEntryLabels: Array<JournalEntryLabels>;
  /** fetch aggregated fields from the table: "journal_entry_labels" */
  journalEntryLabelsAggregate: JournalEntryLabels_Aggregate;
  /** fetch data from the table: "journal_labels" using primary key columns */
  journalLabel?: Maybe<JournalLabels>;
  /** fetch data from the table: "journal_labels" */
  journalLabels: Array<JournalLabels>;
  /** fetch aggregated fields from the table: "journal_labels" */
  journalLabelsAggregate: JournalLabels_Aggregate;
  /** fetch data from the table: "labels" using primary key columns */
  label?: Maybe<Labels>;
  /** fetch data from the table: "labels" */
  labels: Array<Labels>;
  /** fetch aggregated fields from the table: "labels" */
  labelsAggregate: Labels_Aggregate;
  /** fetch data from the table: "muscle_groups" using primary key columns */
  muscleGroup?: Maybe<MuscleGroups>;
  /** fetch data from the table: "muscle_groups" */
  muscleGroups: Array<MuscleGroups>;
  /** fetch aggregated fields from the table: "muscle_groups" */
  muscleGroupsAggregate: MuscleGroups_Aggregate;
  /** fetch data from the table: "workouts" using primary key columns */
  workout?: Maybe<Workouts>;
  /** fetch data from the table: "workout_exercises" using primary key columns */
  workoutExercise?: Maybe<WorkoutExercises>;
  /** An array relationship */
  workoutExercises: Array<WorkoutExercises>;
  /** fetch aggregated fields from the table: "workout_exercises" */
  workoutExercisesAggregate: WorkoutExercises_Aggregate;
  /** fetch data from the table: "workout_labels" using primary key columns */
  workoutLabel?: Maybe<WorkoutLabels>;
  /** An array relationship */
  workoutLabels: Array<WorkoutLabels>;
  /** fetch aggregated fields from the table: "workout_labels" */
  workoutLabelsAggregate: WorkoutLabels_Aggregate;
  /** fetch data from the table: "workout_sessions" using primary key columns */
  workoutSession?: Maybe<WorkoutSessions>;
  /** An array relationship */
  workoutSessionCardioEntries: Array<WorkoutSessionCardioEntries>;
  /** fetch aggregated fields from the table: "workout_session_cardio_entries" */
  workoutSessionCardioEntriesAggregate: WorkoutSessionCardioEntries_Aggregate;
  /** fetch data from the table: "workout_session_cardio_entries" using primary key columns */
  workoutSessionCardioEntry?: Maybe<WorkoutSessionCardioEntries>;
  /** fetch data from the table: "workout_session_exercises" using primary key columns */
  workoutSessionExercise?: Maybe<WorkoutSessionExercises>;
  /** An array relationship */
  workoutSessionExercises: Array<WorkoutSessionExercises>;
  /** fetch aggregated fields from the table: "workout_session_exercises" */
  workoutSessionExercisesAggregate: WorkoutSessionExercises_Aggregate;
  /** fetch data from the table: "workout_session_sets" using primary key columns */
  workoutSessionSet?: Maybe<WorkoutSessionSets>;
  /** An array relationship */
  workoutSessionSets: Array<WorkoutSessionSets>;
  /** fetch aggregated fields from the table: "workout_session_sets" */
  workoutSessionSetsAggregate: WorkoutSessionSets_Aggregate;
  /** An array relationship */
  workoutSessions: Array<WorkoutSessions>;
  /** fetch aggregated fields from the table: "workout_sessions" */
  workoutSessionsAggregate: WorkoutSessions_Aggregate;
  /** fetch data from the table: "workouts" */
  workouts: Array<Workouts>;
  /** fetch aggregated fields from the table: "workouts" */
  workoutsAggregate: Workouts_Aggregate;
};


export type Query_RootBodyMeasurementArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootBodyMeasurementsArgs = {
  distinct_on?: InputMaybe<Array<BodyMeasurements_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<BodyMeasurements_Order_By>>;
  where?: InputMaybe<BodyMeasurements_Bool_Exp>;
};


export type Query_RootBodyMeasurementsAggregateArgs = {
  distinct_on?: InputMaybe<Array<BodyMeasurements_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<BodyMeasurements_Order_By>>;
  where?: InputMaybe<BodyMeasurements_Bool_Exp>;
};


export type Query_RootExerciseArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootExerciseCategoriesArgs = {
  distinct_on?: InputMaybe<Array<ExerciseCategories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseCategories_Order_By>>;
  where?: InputMaybe<ExerciseCategories_Bool_Exp>;
};


export type Query_RootExerciseCategoriesAggregateArgs = {
  distinct_on?: InputMaybe<Array<ExerciseCategories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseCategories_Order_By>>;
  where?: InputMaybe<ExerciseCategories_Bool_Exp>;
};


export type Query_RootExerciseCategoryArgs = {
  value: Scalars['String']['input'];
};


export type Query_RootExerciseEquipmentArgs = {
  value: Scalars['String']['input'];
};


export type Query_RootExerciseEquipmentsArgs = {
  distinct_on?: InputMaybe<Array<ExerciseEquipments_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseEquipments_Order_By>>;
  where?: InputMaybe<ExerciseEquipments_Bool_Exp>;
};


export type Query_RootExerciseEquipmentsAggregateArgs = {
  distinct_on?: InputMaybe<Array<ExerciseEquipments_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseEquipments_Order_By>>;
  where?: InputMaybe<ExerciseEquipments_Bool_Exp>;
};


export type Query_RootExerciseForceArgs = {
  value: Scalars['String']['input'];
};


export type Query_RootExerciseForcesArgs = {
  distinct_on?: InputMaybe<Array<ExerciseForces_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseForces_Order_By>>;
  where?: InputMaybe<ExerciseForces_Bool_Exp>;
};


export type Query_RootExerciseForcesAggregateArgs = {
  distinct_on?: InputMaybe<Array<ExerciseForces_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseForces_Order_By>>;
  where?: InputMaybe<ExerciseForces_Bool_Exp>;
};


export type Query_RootExerciseLevelArgs = {
  value: Scalars['String']['input'];
};


export type Query_RootExerciseLevelsArgs = {
  distinct_on?: InputMaybe<Array<ExerciseLevels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseLevels_Order_By>>;
  where?: InputMaybe<ExerciseLevels_Bool_Exp>;
};


export type Query_RootExerciseLevelsAggregateArgs = {
  distinct_on?: InputMaybe<Array<ExerciseLevels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseLevels_Order_By>>;
  where?: InputMaybe<ExerciseLevels_Bool_Exp>;
};


export type Query_RootExerciseMechanicArgs = {
  value: Scalars['String']['input'];
};


export type Query_RootExerciseMechanicsArgs = {
  distinct_on?: InputMaybe<Array<ExerciseMechanics_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseMechanics_Order_By>>;
  where?: InputMaybe<ExerciseMechanics_Bool_Exp>;
};


export type Query_RootExerciseMechanicsAggregateArgs = {
  distinct_on?: InputMaybe<Array<ExerciseMechanics_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseMechanics_Order_By>>;
  where?: InputMaybe<ExerciseMechanics_Bool_Exp>;
};


export type Query_RootExerciseSecondaryMuscleGroupArgs = {
  exerciseId: Scalars['uuid']['input'];
  muscleGroup: MuscleGroups_Enum;
};


export type Query_RootExerciseSecondaryMuscleGroupsArgs = {
  distinct_on?: InputMaybe<Array<ExerciseSecondaryMuscleGroups_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseSecondaryMuscleGroups_Order_By>>;
  where?: InputMaybe<ExerciseSecondaryMuscleGroups_Bool_Exp>;
};


export type Query_RootExerciseSecondaryMuscleGroupsAggregateArgs = {
  distinct_on?: InputMaybe<Array<ExerciseSecondaryMuscleGroups_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseSecondaryMuscleGroups_Order_By>>;
  where?: InputMaybe<ExerciseSecondaryMuscleGroups_Bool_Exp>;
};


export type Query_RootExercisesArgs = {
  distinct_on?: InputMaybe<Array<Exercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Exercises_Order_By>>;
  where?: InputMaybe<Exercises_Bool_Exp>;
};


export type Query_RootExercisesAggregateArgs = {
  distinct_on?: InputMaybe<Array<Exercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Exercises_Order_By>>;
  where?: InputMaybe<Exercises_Bool_Exp>;
};


export type Query_RootFileArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootFilesArgs = {
  distinct_on?: InputMaybe<Array<Files_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Files_Order_By>>;
  where?: InputMaybe<Files_Bool_Exp>;
};


export type Query_RootJournalEntriesArgs = {
  distinct_on?: InputMaybe<Array<JournalEntries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<JournalEntries_Order_By>>;
  where?: InputMaybe<JournalEntries_Bool_Exp>;
};


export type Query_RootJournalEntriesAggregateArgs = {
  distinct_on?: InputMaybe<Array<JournalEntries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<JournalEntries_Order_By>>;
  where?: InputMaybe<JournalEntries_Bool_Exp>;
};


export type Query_RootJournalEntryArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootJournalEntryLabelArgs = {
  journalEntryId: Scalars['uuid']['input'];
  labelId: Scalars['uuid']['input'];
};


export type Query_RootJournalEntryLabelsArgs = {
  distinct_on?: InputMaybe<Array<JournalEntryLabels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<JournalEntryLabels_Order_By>>;
  where?: InputMaybe<JournalEntryLabels_Bool_Exp>;
};


export type Query_RootJournalEntryLabelsAggregateArgs = {
  distinct_on?: InputMaybe<Array<JournalEntryLabels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<JournalEntryLabels_Order_By>>;
  where?: InputMaybe<JournalEntryLabels_Bool_Exp>;
};


export type Query_RootJournalLabelArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootJournalLabelsArgs = {
  distinct_on?: InputMaybe<Array<JournalLabels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<JournalLabels_Order_By>>;
  where?: InputMaybe<JournalLabels_Bool_Exp>;
};


export type Query_RootJournalLabelsAggregateArgs = {
  distinct_on?: InputMaybe<Array<JournalLabels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<JournalLabels_Order_By>>;
  where?: InputMaybe<JournalLabels_Bool_Exp>;
};


export type Query_RootLabelArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootLabelsArgs = {
  distinct_on?: InputMaybe<Array<Labels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Labels_Order_By>>;
  where?: InputMaybe<Labels_Bool_Exp>;
};


export type Query_RootLabelsAggregateArgs = {
  distinct_on?: InputMaybe<Array<Labels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Labels_Order_By>>;
  where?: InputMaybe<Labels_Bool_Exp>;
};


export type Query_RootMuscleGroupArgs = {
  value: Scalars['String']['input'];
};


export type Query_RootMuscleGroupsArgs = {
  distinct_on?: InputMaybe<Array<MuscleGroups_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<MuscleGroups_Order_By>>;
  where?: InputMaybe<MuscleGroups_Bool_Exp>;
};


export type Query_RootMuscleGroupsAggregateArgs = {
  distinct_on?: InputMaybe<Array<MuscleGroups_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<MuscleGroups_Order_By>>;
  where?: InputMaybe<MuscleGroups_Bool_Exp>;
};


export type Query_RootWorkoutArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootWorkoutExerciseArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootWorkoutExercisesArgs = {
  distinct_on?: InputMaybe<Array<WorkoutExercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutExercises_Order_By>>;
  where?: InputMaybe<WorkoutExercises_Bool_Exp>;
};


export type Query_RootWorkoutExercisesAggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutExercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutExercises_Order_By>>;
  where?: InputMaybe<WorkoutExercises_Bool_Exp>;
};


export type Query_RootWorkoutLabelArgs = {
  labelId: Scalars['uuid']['input'];
  workoutId: Scalars['uuid']['input'];
};


export type Query_RootWorkoutLabelsArgs = {
  distinct_on?: InputMaybe<Array<WorkoutLabels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutLabels_Order_By>>;
  where?: InputMaybe<WorkoutLabels_Bool_Exp>;
};


export type Query_RootWorkoutLabelsAggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutLabels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutLabels_Order_By>>;
  where?: InputMaybe<WorkoutLabels_Bool_Exp>;
};


export type Query_RootWorkoutSessionArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootWorkoutSessionCardioEntriesArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionCardioEntries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionCardioEntries_Order_By>>;
  where?: InputMaybe<WorkoutSessionCardioEntries_Bool_Exp>;
};


export type Query_RootWorkoutSessionCardioEntriesAggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionCardioEntries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionCardioEntries_Order_By>>;
  where?: InputMaybe<WorkoutSessionCardioEntries_Bool_Exp>;
};


export type Query_RootWorkoutSessionCardioEntryArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootWorkoutSessionExerciseArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootWorkoutSessionExercisesArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionExercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionExercises_Order_By>>;
  where?: InputMaybe<WorkoutSessionExercises_Bool_Exp>;
};


export type Query_RootWorkoutSessionExercisesAggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionExercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionExercises_Order_By>>;
  where?: InputMaybe<WorkoutSessionExercises_Bool_Exp>;
};


export type Query_RootWorkoutSessionSetArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootWorkoutSessionSetsArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionSets_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionSets_Order_By>>;
  where?: InputMaybe<WorkoutSessionSets_Bool_Exp>;
};


export type Query_RootWorkoutSessionSetsAggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionSets_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionSets_Order_By>>;
  where?: InputMaybe<WorkoutSessionSets_Bool_Exp>;
};


export type Query_RootWorkoutSessionsArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessions_Order_By>>;
  where?: InputMaybe<WorkoutSessions_Bool_Exp>;
};


export type Query_RootWorkoutSessionsAggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessions_Order_By>>;
  where?: InputMaybe<WorkoutSessions_Bool_Exp>;
};


export type Query_RootWorkoutsArgs = {
  distinct_on?: InputMaybe<Array<Workouts_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Workouts_Order_By>>;
  where?: InputMaybe<Workouts_Bool_Exp>;
};


export type Query_RootWorkoutsAggregateArgs = {
  distinct_on?: InputMaybe<Array<Workouts_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Workouts_Order_By>>;
  where?: InputMaybe<Workouts_Bool_Exp>;
};

export type Subscription_Root = {
  __typename?: 'subscription_root';
  /** fetch data from the table: "body_measurements" using primary key columns */
  bodyMeasurement?: Maybe<BodyMeasurements>;
  /** fetch data from the table: "body_measurements" */
  bodyMeasurements: Array<BodyMeasurements>;
  /** fetch aggregated fields from the table: "body_measurements" */
  bodyMeasurementsAggregate: BodyMeasurements_Aggregate;
  /** fetch data from the table in a streaming manner: "body_measurements" */
  bodyMeasurements_stream: Array<BodyMeasurements>;
  /** fetch data from the table: "exercises" using primary key columns */
  exercise?: Maybe<Exercises>;
  /** fetch data from the table: "exercise_categories" */
  exerciseCategories: Array<ExerciseCategories>;
  /** fetch aggregated fields from the table: "exercise_categories" */
  exerciseCategoriesAggregate: ExerciseCategories_Aggregate;
  /** fetch data from the table in a streaming manner: "exercise_categories" */
  exerciseCategories_stream: Array<ExerciseCategories>;
  /** fetch data from the table: "exercise_categories" using primary key columns */
  exerciseCategory?: Maybe<ExerciseCategories>;
  /** fetch data from the table: "exercise_equipments" using primary key columns */
  exerciseEquipment?: Maybe<ExerciseEquipments>;
  /** fetch data from the table: "exercise_equipments" */
  exerciseEquipments: Array<ExerciseEquipments>;
  /** fetch aggregated fields from the table: "exercise_equipments" */
  exerciseEquipmentsAggregate: ExerciseEquipments_Aggregate;
  /** fetch data from the table in a streaming manner: "exercise_equipments" */
  exerciseEquipments_stream: Array<ExerciseEquipments>;
  /** fetch data from the table: "exercise_forces" using primary key columns */
  exerciseForce?: Maybe<ExerciseForces>;
  /** fetch data from the table: "exercise_forces" */
  exerciseForces: Array<ExerciseForces>;
  /** fetch aggregated fields from the table: "exercise_forces" */
  exerciseForcesAggregate: ExerciseForces_Aggregate;
  /** fetch data from the table in a streaming manner: "exercise_forces" */
  exerciseForces_stream: Array<ExerciseForces>;
  /** fetch data from the table: "exercise_levels" using primary key columns */
  exerciseLevel?: Maybe<ExerciseLevels>;
  /** fetch data from the table: "exercise_levels" */
  exerciseLevels: Array<ExerciseLevels>;
  /** fetch aggregated fields from the table: "exercise_levels" */
  exerciseLevelsAggregate: ExerciseLevels_Aggregate;
  /** fetch data from the table in a streaming manner: "exercise_levels" */
  exerciseLevels_stream: Array<ExerciseLevels>;
  /** fetch data from the table: "exercise_mechanics" using primary key columns */
  exerciseMechanic?: Maybe<ExerciseMechanics>;
  /** fetch data from the table: "exercise_mechanics" */
  exerciseMechanics: Array<ExerciseMechanics>;
  /** fetch aggregated fields from the table: "exercise_mechanics" */
  exerciseMechanicsAggregate: ExerciseMechanics_Aggregate;
  /** fetch data from the table in a streaming manner: "exercise_mechanics" */
  exerciseMechanics_stream: Array<ExerciseMechanics>;
  /** fetch data from the table: "exercise_secondary_muscle_groups" using primary key columns */
  exerciseSecondaryMuscleGroup?: Maybe<ExerciseSecondaryMuscleGroups>;
  /** An array relationship */
  exerciseSecondaryMuscleGroups: Array<ExerciseSecondaryMuscleGroups>;
  /** fetch aggregated fields from the table: "exercise_secondary_muscle_groups" */
  exerciseSecondaryMuscleGroupsAggregate: ExerciseSecondaryMuscleGroups_Aggregate;
  /** fetch data from the table in a streaming manner: "exercise_secondary_muscle_groups" */
  exerciseSecondaryMuscleGroups_stream: Array<ExerciseSecondaryMuscleGroups>;
  /** An array relationship */
  exercises: Array<Exercises>;
  /** fetch aggregated fields from the table: "exercises" */
  exercisesAggregate: Exercises_Aggregate;
  /** fetch data from the table in a streaming manner: "exercises" */
  exercises_stream: Array<Exercises>;
  /** fetch data from the table: "storage.files" using primary key columns */
  file?: Maybe<Files>;
  /** fetch data from the table: "storage.files" */
  files: Array<Files>;
  /** fetch data from the table in a streaming manner: "storage.files" */
  files_stream: Array<Files>;
  /** fetch data from the table: "journal_entries" */
  journalEntries: Array<JournalEntries>;
  /** fetch aggregated fields from the table: "journal_entries" */
  journalEntriesAggregate: JournalEntries_Aggregate;
  /** fetch data from the table in a streaming manner: "journal_entries" */
  journalEntries_stream: Array<JournalEntries>;
  /** fetch data from the table: "journal_entries" using primary key columns */
  journalEntry?: Maybe<JournalEntries>;
  /** fetch data from the table: "journal_entry_labels" using primary key columns */
  journalEntryLabel?: Maybe<JournalEntryLabels>;
  /** An array relationship */
  journalEntryLabels: Array<JournalEntryLabels>;
  /** fetch aggregated fields from the table: "journal_entry_labels" */
  journalEntryLabelsAggregate: JournalEntryLabels_Aggregate;
  /** fetch data from the table in a streaming manner: "journal_entry_labels" */
  journalEntryLabels_stream: Array<JournalEntryLabels>;
  /** fetch data from the table: "journal_labels" using primary key columns */
  journalLabel?: Maybe<JournalLabels>;
  /** fetch data from the table: "journal_labels" */
  journalLabels: Array<JournalLabels>;
  /** fetch aggregated fields from the table: "journal_labels" */
  journalLabelsAggregate: JournalLabels_Aggregate;
  /** fetch data from the table in a streaming manner: "journal_labels" */
  journalLabels_stream: Array<JournalLabels>;
  /** fetch data from the table: "labels" using primary key columns */
  label?: Maybe<Labels>;
  /** fetch data from the table: "labels" */
  labels: Array<Labels>;
  /** fetch aggregated fields from the table: "labels" */
  labelsAggregate: Labels_Aggregate;
  /** fetch data from the table in a streaming manner: "labels" */
  labels_stream: Array<Labels>;
  /** fetch data from the table: "muscle_groups" using primary key columns */
  muscleGroup?: Maybe<MuscleGroups>;
  /** fetch data from the table: "muscle_groups" */
  muscleGroups: Array<MuscleGroups>;
  /** fetch aggregated fields from the table: "muscle_groups" */
  muscleGroupsAggregate: MuscleGroups_Aggregate;
  /** fetch data from the table in a streaming manner: "muscle_groups" */
  muscleGroups_stream: Array<MuscleGroups>;
  /** fetch data from the table: "workouts" using primary key columns */
  workout?: Maybe<Workouts>;
  /** fetch data from the table: "workout_exercises" using primary key columns */
  workoutExercise?: Maybe<WorkoutExercises>;
  /** An array relationship */
  workoutExercises: Array<WorkoutExercises>;
  /** fetch aggregated fields from the table: "workout_exercises" */
  workoutExercisesAggregate: WorkoutExercises_Aggregate;
  /** fetch data from the table in a streaming manner: "workout_exercises" */
  workoutExercises_stream: Array<WorkoutExercises>;
  /** fetch data from the table: "workout_labels" using primary key columns */
  workoutLabel?: Maybe<WorkoutLabels>;
  /** An array relationship */
  workoutLabels: Array<WorkoutLabels>;
  /** fetch aggregated fields from the table: "workout_labels" */
  workoutLabelsAggregate: WorkoutLabels_Aggregate;
  /** fetch data from the table in a streaming manner: "workout_labels" */
  workoutLabels_stream: Array<WorkoutLabels>;
  /** fetch data from the table: "workout_sessions" using primary key columns */
  workoutSession?: Maybe<WorkoutSessions>;
  /** An array relationship */
  workoutSessionCardioEntries: Array<WorkoutSessionCardioEntries>;
  /** fetch aggregated fields from the table: "workout_session_cardio_entries" */
  workoutSessionCardioEntriesAggregate: WorkoutSessionCardioEntries_Aggregate;
  /** fetch data from the table in a streaming manner: "workout_session_cardio_entries" */
  workoutSessionCardioEntries_stream: Array<WorkoutSessionCardioEntries>;
  /** fetch data from the table: "workout_session_cardio_entries" using primary key columns */
  workoutSessionCardioEntry?: Maybe<WorkoutSessionCardioEntries>;
  /** fetch data from the table: "workout_session_exercises" using primary key columns */
  workoutSessionExercise?: Maybe<WorkoutSessionExercises>;
  /** An array relationship */
  workoutSessionExercises: Array<WorkoutSessionExercises>;
  /** fetch aggregated fields from the table: "workout_session_exercises" */
  workoutSessionExercisesAggregate: WorkoutSessionExercises_Aggregate;
  /** fetch data from the table in a streaming manner: "workout_session_exercises" */
  workoutSessionExercises_stream: Array<WorkoutSessionExercises>;
  /** fetch data from the table: "workout_session_sets" using primary key columns */
  workoutSessionSet?: Maybe<WorkoutSessionSets>;
  /** An array relationship */
  workoutSessionSets: Array<WorkoutSessionSets>;
  /** fetch aggregated fields from the table: "workout_session_sets" */
  workoutSessionSetsAggregate: WorkoutSessionSets_Aggregate;
  /** fetch data from the table in a streaming manner: "workout_session_sets" */
  workoutSessionSets_stream: Array<WorkoutSessionSets>;
  /** An array relationship */
  workoutSessions: Array<WorkoutSessions>;
  /** fetch aggregated fields from the table: "workout_sessions" */
  workoutSessionsAggregate: WorkoutSessions_Aggregate;
  /** fetch data from the table in a streaming manner: "workout_sessions" */
  workoutSessions_stream: Array<WorkoutSessions>;
  /** fetch data from the table: "workouts" */
  workouts: Array<Workouts>;
  /** fetch aggregated fields from the table: "workouts" */
  workoutsAggregate: Workouts_Aggregate;
  /** fetch data from the table in a streaming manner: "workouts" */
  workouts_stream: Array<Workouts>;
};


export type Subscription_RootBodyMeasurementArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootBodyMeasurementsArgs = {
  distinct_on?: InputMaybe<Array<BodyMeasurements_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<BodyMeasurements_Order_By>>;
  where?: InputMaybe<BodyMeasurements_Bool_Exp>;
};


export type Subscription_RootBodyMeasurementsAggregateArgs = {
  distinct_on?: InputMaybe<Array<BodyMeasurements_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<BodyMeasurements_Order_By>>;
  where?: InputMaybe<BodyMeasurements_Bool_Exp>;
};


export type Subscription_RootBodyMeasurements_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<BodyMeasurements_Stream_Cursor_Input>>;
  where?: InputMaybe<BodyMeasurements_Bool_Exp>;
};


export type Subscription_RootExerciseArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootExerciseCategoriesArgs = {
  distinct_on?: InputMaybe<Array<ExerciseCategories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseCategories_Order_By>>;
  where?: InputMaybe<ExerciseCategories_Bool_Exp>;
};


export type Subscription_RootExerciseCategoriesAggregateArgs = {
  distinct_on?: InputMaybe<Array<ExerciseCategories_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseCategories_Order_By>>;
  where?: InputMaybe<ExerciseCategories_Bool_Exp>;
};


export type Subscription_RootExerciseCategories_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<ExerciseCategories_Stream_Cursor_Input>>;
  where?: InputMaybe<ExerciseCategories_Bool_Exp>;
};


export type Subscription_RootExerciseCategoryArgs = {
  value: Scalars['String']['input'];
};


export type Subscription_RootExerciseEquipmentArgs = {
  value: Scalars['String']['input'];
};


export type Subscription_RootExerciseEquipmentsArgs = {
  distinct_on?: InputMaybe<Array<ExerciseEquipments_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseEquipments_Order_By>>;
  where?: InputMaybe<ExerciseEquipments_Bool_Exp>;
};


export type Subscription_RootExerciseEquipmentsAggregateArgs = {
  distinct_on?: InputMaybe<Array<ExerciseEquipments_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseEquipments_Order_By>>;
  where?: InputMaybe<ExerciseEquipments_Bool_Exp>;
};


export type Subscription_RootExerciseEquipments_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<ExerciseEquipments_Stream_Cursor_Input>>;
  where?: InputMaybe<ExerciseEquipments_Bool_Exp>;
};


export type Subscription_RootExerciseForceArgs = {
  value: Scalars['String']['input'];
};


export type Subscription_RootExerciseForcesArgs = {
  distinct_on?: InputMaybe<Array<ExerciseForces_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseForces_Order_By>>;
  where?: InputMaybe<ExerciseForces_Bool_Exp>;
};


export type Subscription_RootExerciseForcesAggregateArgs = {
  distinct_on?: InputMaybe<Array<ExerciseForces_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseForces_Order_By>>;
  where?: InputMaybe<ExerciseForces_Bool_Exp>;
};


export type Subscription_RootExerciseForces_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<ExerciseForces_Stream_Cursor_Input>>;
  where?: InputMaybe<ExerciseForces_Bool_Exp>;
};


export type Subscription_RootExerciseLevelArgs = {
  value: Scalars['String']['input'];
};


export type Subscription_RootExerciseLevelsArgs = {
  distinct_on?: InputMaybe<Array<ExerciseLevels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseLevels_Order_By>>;
  where?: InputMaybe<ExerciseLevels_Bool_Exp>;
};


export type Subscription_RootExerciseLevelsAggregateArgs = {
  distinct_on?: InputMaybe<Array<ExerciseLevels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseLevels_Order_By>>;
  where?: InputMaybe<ExerciseLevels_Bool_Exp>;
};


export type Subscription_RootExerciseLevels_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<ExerciseLevels_Stream_Cursor_Input>>;
  where?: InputMaybe<ExerciseLevels_Bool_Exp>;
};


export type Subscription_RootExerciseMechanicArgs = {
  value: Scalars['String']['input'];
};


export type Subscription_RootExerciseMechanicsArgs = {
  distinct_on?: InputMaybe<Array<ExerciseMechanics_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseMechanics_Order_By>>;
  where?: InputMaybe<ExerciseMechanics_Bool_Exp>;
};


export type Subscription_RootExerciseMechanicsAggregateArgs = {
  distinct_on?: InputMaybe<Array<ExerciseMechanics_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseMechanics_Order_By>>;
  where?: InputMaybe<ExerciseMechanics_Bool_Exp>;
};


export type Subscription_RootExerciseMechanics_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<ExerciseMechanics_Stream_Cursor_Input>>;
  where?: InputMaybe<ExerciseMechanics_Bool_Exp>;
};


export type Subscription_RootExerciseSecondaryMuscleGroupArgs = {
  exerciseId: Scalars['uuid']['input'];
  muscleGroup: MuscleGroups_Enum;
};


export type Subscription_RootExerciseSecondaryMuscleGroupsArgs = {
  distinct_on?: InputMaybe<Array<ExerciseSecondaryMuscleGroups_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseSecondaryMuscleGroups_Order_By>>;
  where?: InputMaybe<ExerciseSecondaryMuscleGroups_Bool_Exp>;
};


export type Subscription_RootExerciseSecondaryMuscleGroupsAggregateArgs = {
  distinct_on?: InputMaybe<Array<ExerciseSecondaryMuscleGroups_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExerciseSecondaryMuscleGroups_Order_By>>;
  where?: InputMaybe<ExerciseSecondaryMuscleGroups_Bool_Exp>;
};


export type Subscription_RootExerciseSecondaryMuscleGroups_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<ExerciseSecondaryMuscleGroups_Stream_Cursor_Input>>;
  where?: InputMaybe<ExerciseSecondaryMuscleGroups_Bool_Exp>;
};


export type Subscription_RootExercisesArgs = {
  distinct_on?: InputMaybe<Array<Exercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Exercises_Order_By>>;
  where?: InputMaybe<Exercises_Bool_Exp>;
};


export type Subscription_RootExercisesAggregateArgs = {
  distinct_on?: InputMaybe<Array<Exercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Exercises_Order_By>>;
  where?: InputMaybe<Exercises_Bool_Exp>;
};


export type Subscription_RootExercises_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Exercises_Stream_Cursor_Input>>;
  where?: InputMaybe<Exercises_Bool_Exp>;
};


export type Subscription_RootFileArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootFilesArgs = {
  distinct_on?: InputMaybe<Array<Files_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Files_Order_By>>;
  where?: InputMaybe<Files_Bool_Exp>;
};


export type Subscription_RootFiles_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Files_Stream_Cursor_Input>>;
  where?: InputMaybe<Files_Bool_Exp>;
};


export type Subscription_RootJournalEntriesArgs = {
  distinct_on?: InputMaybe<Array<JournalEntries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<JournalEntries_Order_By>>;
  where?: InputMaybe<JournalEntries_Bool_Exp>;
};


export type Subscription_RootJournalEntriesAggregateArgs = {
  distinct_on?: InputMaybe<Array<JournalEntries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<JournalEntries_Order_By>>;
  where?: InputMaybe<JournalEntries_Bool_Exp>;
};


export type Subscription_RootJournalEntries_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<JournalEntries_Stream_Cursor_Input>>;
  where?: InputMaybe<JournalEntries_Bool_Exp>;
};


export type Subscription_RootJournalEntryArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootJournalEntryLabelArgs = {
  journalEntryId: Scalars['uuid']['input'];
  labelId: Scalars['uuid']['input'];
};


export type Subscription_RootJournalEntryLabelsArgs = {
  distinct_on?: InputMaybe<Array<JournalEntryLabels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<JournalEntryLabels_Order_By>>;
  where?: InputMaybe<JournalEntryLabels_Bool_Exp>;
};


export type Subscription_RootJournalEntryLabelsAggregateArgs = {
  distinct_on?: InputMaybe<Array<JournalEntryLabels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<JournalEntryLabels_Order_By>>;
  where?: InputMaybe<JournalEntryLabels_Bool_Exp>;
};


export type Subscription_RootJournalEntryLabels_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<JournalEntryLabels_Stream_Cursor_Input>>;
  where?: InputMaybe<JournalEntryLabels_Bool_Exp>;
};


export type Subscription_RootJournalLabelArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootJournalLabelsArgs = {
  distinct_on?: InputMaybe<Array<JournalLabels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<JournalLabels_Order_By>>;
  where?: InputMaybe<JournalLabels_Bool_Exp>;
};


export type Subscription_RootJournalLabelsAggregateArgs = {
  distinct_on?: InputMaybe<Array<JournalLabels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<JournalLabels_Order_By>>;
  where?: InputMaybe<JournalLabels_Bool_Exp>;
};


export type Subscription_RootJournalLabels_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<JournalLabels_Stream_Cursor_Input>>;
  where?: InputMaybe<JournalLabels_Bool_Exp>;
};


export type Subscription_RootLabelArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootLabelsArgs = {
  distinct_on?: InputMaybe<Array<Labels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Labels_Order_By>>;
  where?: InputMaybe<Labels_Bool_Exp>;
};


export type Subscription_RootLabelsAggregateArgs = {
  distinct_on?: InputMaybe<Array<Labels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Labels_Order_By>>;
  where?: InputMaybe<Labels_Bool_Exp>;
};


export type Subscription_RootLabels_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Labels_Stream_Cursor_Input>>;
  where?: InputMaybe<Labels_Bool_Exp>;
};


export type Subscription_RootMuscleGroupArgs = {
  value: Scalars['String']['input'];
};


export type Subscription_RootMuscleGroupsArgs = {
  distinct_on?: InputMaybe<Array<MuscleGroups_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<MuscleGroups_Order_By>>;
  where?: InputMaybe<MuscleGroups_Bool_Exp>;
};


export type Subscription_RootMuscleGroupsAggregateArgs = {
  distinct_on?: InputMaybe<Array<MuscleGroups_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<MuscleGroups_Order_By>>;
  where?: InputMaybe<MuscleGroups_Bool_Exp>;
};


export type Subscription_RootMuscleGroups_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<MuscleGroups_Stream_Cursor_Input>>;
  where?: InputMaybe<MuscleGroups_Bool_Exp>;
};


export type Subscription_RootWorkoutArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootWorkoutExerciseArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootWorkoutExercisesArgs = {
  distinct_on?: InputMaybe<Array<WorkoutExercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutExercises_Order_By>>;
  where?: InputMaybe<WorkoutExercises_Bool_Exp>;
};


export type Subscription_RootWorkoutExercisesAggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutExercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutExercises_Order_By>>;
  where?: InputMaybe<WorkoutExercises_Bool_Exp>;
};


export type Subscription_RootWorkoutExercises_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<WorkoutExercises_Stream_Cursor_Input>>;
  where?: InputMaybe<WorkoutExercises_Bool_Exp>;
};


export type Subscription_RootWorkoutLabelArgs = {
  labelId: Scalars['uuid']['input'];
  workoutId: Scalars['uuid']['input'];
};


export type Subscription_RootWorkoutLabelsArgs = {
  distinct_on?: InputMaybe<Array<WorkoutLabels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutLabels_Order_By>>;
  where?: InputMaybe<WorkoutLabels_Bool_Exp>;
};


export type Subscription_RootWorkoutLabelsAggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutLabels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutLabels_Order_By>>;
  where?: InputMaybe<WorkoutLabels_Bool_Exp>;
};


export type Subscription_RootWorkoutLabels_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<WorkoutLabels_Stream_Cursor_Input>>;
  where?: InputMaybe<WorkoutLabels_Bool_Exp>;
};


export type Subscription_RootWorkoutSessionArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootWorkoutSessionCardioEntriesArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionCardioEntries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionCardioEntries_Order_By>>;
  where?: InputMaybe<WorkoutSessionCardioEntries_Bool_Exp>;
};


export type Subscription_RootWorkoutSessionCardioEntriesAggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionCardioEntries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionCardioEntries_Order_By>>;
  where?: InputMaybe<WorkoutSessionCardioEntries_Bool_Exp>;
};


export type Subscription_RootWorkoutSessionCardioEntries_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<WorkoutSessionCardioEntries_Stream_Cursor_Input>>;
  where?: InputMaybe<WorkoutSessionCardioEntries_Bool_Exp>;
};


export type Subscription_RootWorkoutSessionCardioEntryArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootWorkoutSessionExerciseArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootWorkoutSessionExercisesArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionExercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionExercises_Order_By>>;
  where?: InputMaybe<WorkoutSessionExercises_Bool_Exp>;
};


export type Subscription_RootWorkoutSessionExercisesAggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionExercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionExercises_Order_By>>;
  where?: InputMaybe<WorkoutSessionExercises_Bool_Exp>;
};


export type Subscription_RootWorkoutSessionExercises_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<WorkoutSessionExercises_Stream_Cursor_Input>>;
  where?: InputMaybe<WorkoutSessionExercises_Bool_Exp>;
};


export type Subscription_RootWorkoutSessionSetArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootWorkoutSessionSetsArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionSets_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionSets_Order_By>>;
  where?: InputMaybe<WorkoutSessionSets_Bool_Exp>;
};


export type Subscription_RootWorkoutSessionSetsAggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionSets_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionSets_Order_By>>;
  where?: InputMaybe<WorkoutSessionSets_Bool_Exp>;
};


export type Subscription_RootWorkoutSessionSets_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<WorkoutSessionSets_Stream_Cursor_Input>>;
  where?: InputMaybe<WorkoutSessionSets_Bool_Exp>;
};


export type Subscription_RootWorkoutSessionsArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessions_Order_By>>;
  where?: InputMaybe<WorkoutSessions_Bool_Exp>;
};


export type Subscription_RootWorkoutSessionsAggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessions_Order_By>>;
  where?: InputMaybe<WorkoutSessions_Bool_Exp>;
};


export type Subscription_RootWorkoutSessions_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<WorkoutSessions_Stream_Cursor_Input>>;
  where?: InputMaybe<WorkoutSessions_Bool_Exp>;
};


export type Subscription_RootWorkoutsArgs = {
  distinct_on?: InputMaybe<Array<Workouts_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Workouts_Order_By>>;
  where?: InputMaybe<Workouts_Bool_Exp>;
};


export type Subscription_RootWorkoutsAggregateArgs = {
  distinct_on?: InputMaybe<Array<Workouts_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Workouts_Order_By>>;
  where?: InputMaybe<Workouts_Bool_Exp>;
};


export type Subscription_RootWorkouts_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Workouts_Stream_Cursor_Input>>;
  where?: InputMaybe<Workouts_Bool_Exp>;
};

/** Boolean expression to compare columns of type "timestamptz". All fields are combined with logical 'AND'. */
export type Timestamptz_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['timestamptz']['input']>;
  _gt?: InputMaybe<Scalars['timestamptz']['input']>;
  _gte?: InputMaybe<Scalars['timestamptz']['input']>;
  _in?: InputMaybe<Array<Scalars['timestamptz']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['timestamptz']['input']>;
  _lte?: InputMaybe<Scalars['timestamptz']['input']>;
  _neq?: InputMaybe<Scalars['timestamptz']['input']>;
  _nin?: InputMaybe<Array<Scalars['timestamptz']['input']>>;
};

/** Boolean expression to compare columns of type "uuid". All fields are combined with logical 'AND'. */
export type Uuid_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['uuid']['input']>;
  _gt?: InputMaybe<Scalars['uuid']['input']>;
  _gte?: InputMaybe<Scalars['uuid']['input']>;
  _in?: InputMaybe<Array<Scalars['uuid']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['uuid']['input']>;
  _lte?: InputMaybe<Scalars['uuid']['input']>;
  _neq?: InputMaybe<Scalars['uuid']['input']>;
  _nin?: InputMaybe<Array<Scalars['uuid']['input']>>;
};

/** columns and relationships of "workout_exercises" */
export type WorkoutExercises = {
  __typename?: 'workoutExercises';
  createdAt: Scalars['timestamptz']['output'];
  /** An object relationship */
  exercise: Exercises;
  exerciseId: Scalars['uuid']['output'];
  id: Scalars['uuid']['output'];
  position: Scalars['Int']['output'];
  updatedAt: Scalars['timestamptz']['output'];
  /** An object relationship */
  workout: Workouts;
  workoutId: Scalars['uuid']['output'];
};

/** aggregated selection of "workout_exercises" */
export type WorkoutExercises_Aggregate = {
  __typename?: 'workoutExercises_aggregate';
  aggregate?: Maybe<WorkoutExercises_Aggregate_Fields>;
  nodes: Array<WorkoutExercises>;
};

export type WorkoutExercises_Aggregate_Bool_Exp = {
  count?: InputMaybe<WorkoutExercises_Aggregate_Bool_Exp_Count>;
};

export type WorkoutExercises_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<WorkoutExercises_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<WorkoutExercises_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "workout_exercises" */
export type WorkoutExercises_Aggregate_Fields = {
  __typename?: 'workoutExercises_aggregate_fields';
  avg?: Maybe<WorkoutExercises_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<WorkoutExercises_Max_Fields>;
  min?: Maybe<WorkoutExercises_Min_Fields>;
  stddev?: Maybe<WorkoutExercises_Stddev_Fields>;
  stddev_pop?: Maybe<WorkoutExercises_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<WorkoutExercises_Stddev_Samp_Fields>;
  sum?: Maybe<WorkoutExercises_Sum_Fields>;
  var_pop?: Maybe<WorkoutExercises_Var_Pop_Fields>;
  var_samp?: Maybe<WorkoutExercises_Var_Samp_Fields>;
  variance?: Maybe<WorkoutExercises_Variance_Fields>;
};


/** aggregate fields of "workout_exercises" */
export type WorkoutExercises_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<WorkoutExercises_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "workout_exercises" */
export type WorkoutExercises_Aggregate_Order_By = {
  avg?: InputMaybe<WorkoutExercises_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<WorkoutExercises_Max_Order_By>;
  min?: InputMaybe<WorkoutExercises_Min_Order_By>;
  stddev?: InputMaybe<WorkoutExercises_Stddev_Order_By>;
  stddev_pop?: InputMaybe<WorkoutExercises_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<WorkoutExercises_Stddev_Samp_Order_By>;
  sum?: InputMaybe<WorkoutExercises_Sum_Order_By>;
  var_pop?: InputMaybe<WorkoutExercises_Var_Pop_Order_By>;
  var_samp?: InputMaybe<WorkoutExercises_Var_Samp_Order_By>;
  variance?: InputMaybe<WorkoutExercises_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "workout_exercises" */
export type WorkoutExercises_Arr_Rel_Insert_Input = {
  data: Array<WorkoutExercises_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<WorkoutExercises_On_Conflict>;
};

/** aggregate avg on columns */
export type WorkoutExercises_Avg_Fields = {
  __typename?: 'workoutExercises_avg_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "workout_exercises" */
export type WorkoutExercises_Avg_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "workout_exercises". All fields are combined with a logical 'AND'. */
export type WorkoutExercises_Bool_Exp = {
  _and?: InputMaybe<Array<WorkoutExercises_Bool_Exp>>;
  _not?: InputMaybe<WorkoutExercises_Bool_Exp>;
  _or?: InputMaybe<Array<WorkoutExercises_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  exercise?: InputMaybe<Exercises_Bool_Exp>;
  exerciseId?: InputMaybe<Uuid_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  position?: InputMaybe<Int_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  workout?: InputMaybe<Workouts_Bool_Exp>;
  workoutId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "workout_exercises" */
export enum WorkoutExercises_Constraint {
  /** unique or primary key constraint on columns "id" */
  WorkoutExercisesPkey = 'workout_exercises_pkey',
  /** unique or primary key constraint on columns "workout_id", "position" */
  WorkoutExercisesWorkoutIdPositionKey = 'workout_exercises_workout_id_position_key'
}

/** input type for incrementing numeric columns in table "workout_exercises" */
export type WorkoutExercises_Inc_Input = {
  position?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "workout_exercises" */
export type WorkoutExercises_Insert_Input = {
  exercise?: InputMaybe<Exercises_Obj_Rel_Insert_Input>;
  exerciseId?: InputMaybe<Scalars['uuid']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  workout?: InputMaybe<Workouts_Obj_Rel_Insert_Input>;
  workoutId?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate max on columns */
export type WorkoutExercises_Max_Fields = {
  __typename?: 'workoutExercises_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  exerciseId?: Maybe<Scalars['uuid']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  workoutId?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "workout_exercises" */
export type WorkoutExercises_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  exerciseId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  workoutId?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type WorkoutExercises_Min_Fields = {
  __typename?: 'workoutExercises_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  exerciseId?: Maybe<Scalars['uuid']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  workoutId?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "workout_exercises" */
export type WorkoutExercises_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  exerciseId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  workoutId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "workout_exercises" */
export type WorkoutExercises_Mutation_Response = {
  __typename?: 'workoutExercises_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<WorkoutExercises>;
};

/** on_conflict condition type for table "workout_exercises" */
export type WorkoutExercises_On_Conflict = {
  constraint: WorkoutExercises_Constraint;
  update_columns?: Array<WorkoutExercises_Update_Column>;
  where?: InputMaybe<WorkoutExercises_Bool_Exp>;
};

/** Ordering options when selecting data from "workout_exercises". */
export type WorkoutExercises_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  exercise?: InputMaybe<Exercises_Order_By>;
  exerciseId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  workout?: InputMaybe<Workouts_Order_By>;
  workoutId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: workout_exercises */
export type WorkoutExercises_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "workout_exercises" */
export enum WorkoutExercises_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  ExerciseId = 'exerciseId',
  /** column name */
  Id = 'id',
  /** column name */
  Position = 'position',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  WorkoutId = 'workoutId'
}

/** input type for updating data in table "workout_exercises" */
export type WorkoutExercises_Set_Input = {
  position?: InputMaybe<Scalars['Int']['input']>;
};

/** aggregate stddev on columns */
export type WorkoutExercises_Stddev_Fields = {
  __typename?: 'workoutExercises_stddev_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "workout_exercises" */
export type WorkoutExercises_Stddev_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type WorkoutExercises_Stddev_Pop_Fields = {
  __typename?: 'workoutExercises_stddev_pop_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "workout_exercises" */
export type WorkoutExercises_Stddev_Pop_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type WorkoutExercises_Stddev_Samp_Fields = {
  __typename?: 'workoutExercises_stddev_samp_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "workout_exercises" */
export type WorkoutExercises_Stddev_Samp_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "workoutExercises" */
export type WorkoutExercises_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: WorkoutExercises_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type WorkoutExercises_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  exerciseId?: InputMaybe<Scalars['uuid']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
  workoutId?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate sum on columns */
export type WorkoutExercises_Sum_Fields = {
  __typename?: 'workoutExercises_sum_fields';
  position?: Maybe<Scalars['Int']['output']>;
};

/** order by sum() on columns of table "workout_exercises" */
export type WorkoutExercises_Sum_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** update columns of table "workout_exercises" */
export enum WorkoutExercises_Update_Column {
  /** column name */
  Position = 'position'
}

export type WorkoutExercises_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<WorkoutExercises_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<WorkoutExercises_Set_Input>;
  /** filter the rows which have to be updated */
  where: WorkoutExercises_Bool_Exp;
};

/** aggregate var_pop on columns */
export type WorkoutExercises_Var_Pop_Fields = {
  __typename?: 'workoutExercises_var_pop_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "workout_exercises" */
export type WorkoutExercises_Var_Pop_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type WorkoutExercises_Var_Samp_Fields = {
  __typename?: 'workoutExercises_var_samp_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "workout_exercises" */
export type WorkoutExercises_Var_Samp_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type WorkoutExercises_Variance_Fields = {
  __typename?: 'workoutExercises_variance_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "workout_exercises" */
export type WorkoutExercises_Variance_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** columns and relationships of "workout_labels" */
export type WorkoutLabels = {
  __typename?: 'workoutLabels';
  createdAt: Scalars['timestamptz']['output'];
  /** An object relationship */
  label: Labels;
  labelId: Scalars['uuid']['output'];
  /** An object relationship */
  workout: Workouts;
  workoutId: Scalars['uuid']['output'];
};

/** aggregated selection of "workout_labels" */
export type WorkoutLabels_Aggregate = {
  __typename?: 'workoutLabels_aggregate';
  aggregate?: Maybe<WorkoutLabels_Aggregate_Fields>;
  nodes: Array<WorkoutLabels>;
};

export type WorkoutLabels_Aggregate_Bool_Exp = {
  count?: InputMaybe<WorkoutLabels_Aggregate_Bool_Exp_Count>;
};

export type WorkoutLabels_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<WorkoutLabels_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<WorkoutLabels_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "workout_labels" */
export type WorkoutLabels_Aggregate_Fields = {
  __typename?: 'workoutLabels_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<WorkoutLabels_Max_Fields>;
  min?: Maybe<WorkoutLabels_Min_Fields>;
};


/** aggregate fields of "workout_labels" */
export type WorkoutLabels_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<WorkoutLabels_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "workout_labels" */
export type WorkoutLabels_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<WorkoutLabels_Max_Order_By>;
  min?: InputMaybe<WorkoutLabels_Min_Order_By>;
};

/** input type for inserting array relation for remote table "workout_labels" */
export type WorkoutLabels_Arr_Rel_Insert_Input = {
  data: Array<WorkoutLabels_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<WorkoutLabels_On_Conflict>;
};

/** Boolean expression to filter rows from the table "workout_labels". All fields are combined with a logical 'AND'. */
export type WorkoutLabels_Bool_Exp = {
  _and?: InputMaybe<Array<WorkoutLabels_Bool_Exp>>;
  _not?: InputMaybe<WorkoutLabels_Bool_Exp>;
  _or?: InputMaybe<Array<WorkoutLabels_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  label?: InputMaybe<Labels_Bool_Exp>;
  labelId?: InputMaybe<Uuid_Comparison_Exp>;
  workout?: InputMaybe<Workouts_Bool_Exp>;
  workoutId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "workout_labels" */
export enum WorkoutLabels_Constraint {
  /** unique or primary key constraint on columns "workout_id", "label_id" */
  WorkoutLabelsPkey = 'workout_labels_pkey'
}

/** input type for inserting data into table "workout_labels" */
export type WorkoutLabels_Insert_Input = {
  label?: InputMaybe<Labels_Obj_Rel_Insert_Input>;
  labelId?: InputMaybe<Scalars['uuid']['input']>;
  workout?: InputMaybe<Workouts_Obj_Rel_Insert_Input>;
  workoutId?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate max on columns */
export type WorkoutLabels_Max_Fields = {
  __typename?: 'workoutLabels_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  labelId?: Maybe<Scalars['uuid']['output']>;
  workoutId?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "workout_labels" */
export type WorkoutLabels_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  labelId?: InputMaybe<Order_By>;
  workoutId?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type WorkoutLabels_Min_Fields = {
  __typename?: 'workoutLabels_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  labelId?: Maybe<Scalars['uuid']['output']>;
  workoutId?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "workout_labels" */
export type WorkoutLabels_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  labelId?: InputMaybe<Order_By>;
  workoutId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "workout_labels" */
export type WorkoutLabels_Mutation_Response = {
  __typename?: 'workoutLabels_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<WorkoutLabels>;
};

/** on_conflict condition type for table "workout_labels" */
export type WorkoutLabels_On_Conflict = {
  constraint: WorkoutLabels_Constraint;
  update_columns?: Array<WorkoutLabels_Update_Column>;
  where?: InputMaybe<WorkoutLabels_Bool_Exp>;
};

/** Ordering options when selecting data from "workout_labels". */
export type WorkoutLabels_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  label?: InputMaybe<Labels_Order_By>;
  labelId?: InputMaybe<Order_By>;
  workout?: InputMaybe<Workouts_Order_By>;
  workoutId?: InputMaybe<Order_By>;
};

/** select columns of table "workout_labels" */
export enum WorkoutLabels_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  LabelId = 'labelId',
  /** column name */
  WorkoutId = 'workoutId'
}

/** Streaming cursor of the table "workoutLabels" */
export type WorkoutLabels_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: WorkoutLabels_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type WorkoutLabels_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  labelId?: InputMaybe<Scalars['uuid']['input']>;
  workoutId?: InputMaybe<Scalars['uuid']['input']>;
};

/** placeholder for update columns of table "workout_labels" (current role has no relevant permissions) */
export enum WorkoutLabels_Update_Column {
  /** placeholder (do not use) */
  Placeholder = '_PLACEHOLDER'
}

/** columns and relationships of "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries = {
  __typename?: 'workoutSessionCardioEntries';
  createdAt: Scalars['timestamptz']['output'];
  entryNumber: Scalars['Int']['output'];
  id: Scalars['uuid']['output'];
  metrics: Scalars['jsonb']['output'];
  updatedAt: Scalars['timestamptz']['output'];
  /** An object relationship */
  workoutSessionExercise: WorkoutSessionExercises;
  workoutSessionExerciseId: Scalars['uuid']['output'];
};


/** columns and relationships of "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntriesMetricsArgs = {
  path?: InputMaybe<Scalars['String']['input']>;
};

/** aggregated selection of "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Aggregate = {
  __typename?: 'workoutSessionCardioEntries_aggregate';
  aggregate?: Maybe<WorkoutSessionCardioEntries_Aggregate_Fields>;
  nodes: Array<WorkoutSessionCardioEntries>;
};

export type WorkoutSessionCardioEntries_Aggregate_Bool_Exp = {
  count?: InputMaybe<WorkoutSessionCardioEntries_Aggregate_Bool_Exp_Count>;
};

export type WorkoutSessionCardioEntries_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<WorkoutSessionCardioEntries_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<WorkoutSessionCardioEntries_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Aggregate_Fields = {
  __typename?: 'workoutSessionCardioEntries_aggregate_fields';
  avg?: Maybe<WorkoutSessionCardioEntries_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<WorkoutSessionCardioEntries_Max_Fields>;
  min?: Maybe<WorkoutSessionCardioEntries_Min_Fields>;
  stddev?: Maybe<WorkoutSessionCardioEntries_Stddev_Fields>;
  stddev_pop?: Maybe<WorkoutSessionCardioEntries_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<WorkoutSessionCardioEntries_Stddev_Samp_Fields>;
  sum?: Maybe<WorkoutSessionCardioEntries_Sum_Fields>;
  var_pop?: Maybe<WorkoutSessionCardioEntries_Var_Pop_Fields>;
  var_samp?: Maybe<WorkoutSessionCardioEntries_Var_Samp_Fields>;
  variance?: Maybe<WorkoutSessionCardioEntries_Variance_Fields>;
};


/** aggregate fields of "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<WorkoutSessionCardioEntries_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Aggregate_Order_By = {
  avg?: InputMaybe<WorkoutSessionCardioEntries_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<WorkoutSessionCardioEntries_Max_Order_By>;
  min?: InputMaybe<WorkoutSessionCardioEntries_Min_Order_By>;
  stddev?: InputMaybe<WorkoutSessionCardioEntries_Stddev_Order_By>;
  stddev_pop?: InputMaybe<WorkoutSessionCardioEntries_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<WorkoutSessionCardioEntries_Stddev_Samp_Order_By>;
  sum?: InputMaybe<WorkoutSessionCardioEntries_Sum_Order_By>;
  var_pop?: InputMaybe<WorkoutSessionCardioEntries_Var_Pop_Order_By>;
  var_samp?: InputMaybe<WorkoutSessionCardioEntries_Var_Samp_Order_By>;
  variance?: InputMaybe<WorkoutSessionCardioEntries_Variance_Order_By>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type WorkoutSessionCardioEntries_Append_Input = {
  metrics?: InputMaybe<Scalars['jsonb']['input']>;
};

/** input type for inserting array relation for remote table "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Arr_Rel_Insert_Input = {
  data: Array<WorkoutSessionCardioEntries_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<WorkoutSessionCardioEntries_On_Conflict>;
};

/** aggregate avg on columns */
export type WorkoutSessionCardioEntries_Avg_Fields = {
  __typename?: 'workoutSessionCardioEntries_avg_fields';
  entryNumber?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Avg_Order_By = {
  entryNumber?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "workout_session_cardio_entries". All fields are combined with a logical 'AND'. */
export type WorkoutSessionCardioEntries_Bool_Exp = {
  _and?: InputMaybe<Array<WorkoutSessionCardioEntries_Bool_Exp>>;
  _not?: InputMaybe<WorkoutSessionCardioEntries_Bool_Exp>;
  _or?: InputMaybe<Array<WorkoutSessionCardioEntries_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  entryNumber?: InputMaybe<Int_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  metrics?: InputMaybe<Jsonb_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  workoutSessionExercise?: InputMaybe<WorkoutSessionExercises_Bool_Exp>;
  workoutSessionExerciseId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "workout_session_cardio_entries" */
export enum WorkoutSessionCardioEntries_Constraint {
  /** unique or primary key constraint on columns "workout_session_exercise_id", "entry_number" */
  WorkoutSessionCardioEntrieWorkoutSessionExerciseIdEKey = 'workout_session_cardio_entrie_workout_session_exercise_id_e_key',
  /** unique or primary key constraint on columns "id" */
  WorkoutSessionCardioEntriesPkey = 'workout_session_cardio_entries_pkey'
}

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type WorkoutSessionCardioEntries_Delete_At_Path_Input = {
  metrics?: InputMaybe<Array<Scalars['String']['input']>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type WorkoutSessionCardioEntries_Delete_Elem_Input = {
  metrics?: InputMaybe<Scalars['Int']['input']>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type WorkoutSessionCardioEntries_Delete_Key_Input = {
  metrics?: InputMaybe<Scalars['String']['input']>;
};

/** input type for incrementing numeric columns in table "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Inc_Input = {
  entryNumber?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Insert_Input = {
  entryNumber?: InputMaybe<Scalars['Int']['input']>;
  metrics?: InputMaybe<Scalars['jsonb']['input']>;
  workoutSessionExercise?: InputMaybe<WorkoutSessionExercises_Obj_Rel_Insert_Input>;
  workoutSessionExerciseId?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate max on columns */
export type WorkoutSessionCardioEntries_Max_Fields = {
  __typename?: 'workoutSessionCardioEntries_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  entryNumber?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  workoutSessionExerciseId?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  entryNumber?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  workoutSessionExerciseId?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type WorkoutSessionCardioEntries_Min_Fields = {
  __typename?: 'workoutSessionCardioEntries_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  entryNumber?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  workoutSessionExerciseId?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  entryNumber?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  workoutSessionExerciseId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Mutation_Response = {
  __typename?: 'workoutSessionCardioEntries_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<WorkoutSessionCardioEntries>;
};

/** on_conflict condition type for table "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_On_Conflict = {
  constraint: WorkoutSessionCardioEntries_Constraint;
  update_columns?: Array<WorkoutSessionCardioEntries_Update_Column>;
  where?: InputMaybe<WorkoutSessionCardioEntries_Bool_Exp>;
};

/** Ordering options when selecting data from "workout_session_cardio_entries". */
export type WorkoutSessionCardioEntries_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  entryNumber?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  metrics?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  workoutSessionExercise?: InputMaybe<WorkoutSessionExercises_Order_By>;
  workoutSessionExerciseId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: workout_session_cardio_entries */
export type WorkoutSessionCardioEntries_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type WorkoutSessionCardioEntries_Prepend_Input = {
  metrics?: InputMaybe<Scalars['jsonb']['input']>;
};

/** select columns of table "workout_session_cardio_entries" */
export enum WorkoutSessionCardioEntries_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  EntryNumber = 'entryNumber',
  /** column name */
  Id = 'id',
  /** column name */
  Metrics = 'metrics',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  WorkoutSessionExerciseId = 'workoutSessionExerciseId'
}

/** input type for updating data in table "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Set_Input = {
  entryNumber?: InputMaybe<Scalars['Int']['input']>;
  metrics?: InputMaybe<Scalars['jsonb']['input']>;
};

/** aggregate stddev on columns */
export type WorkoutSessionCardioEntries_Stddev_Fields = {
  __typename?: 'workoutSessionCardioEntries_stddev_fields';
  entryNumber?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Stddev_Order_By = {
  entryNumber?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type WorkoutSessionCardioEntries_Stddev_Pop_Fields = {
  __typename?: 'workoutSessionCardioEntries_stddev_pop_fields';
  entryNumber?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Stddev_Pop_Order_By = {
  entryNumber?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type WorkoutSessionCardioEntries_Stddev_Samp_Fields = {
  __typename?: 'workoutSessionCardioEntries_stddev_samp_fields';
  entryNumber?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Stddev_Samp_Order_By = {
  entryNumber?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "workoutSessionCardioEntries" */
export type WorkoutSessionCardioEntries_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: WorkoutSessionCardioEntries_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type WorkoutSessionCardioEntries_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  entryNumber?: InputMaybe<Scalars['Int']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  metrics?: InputMaybe<Scalars['jsonb']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
  workoutSessionExerciseId?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate sum on columns */
export type WorkoutSessionCardioEntries_Sum_Fields = {
  __typename?: 'workoutSessionCardioEntries_sum_fields';
  entryNumber?: Maybe<Scalars['Int']['output']>;
};

/** order by sum() on columns of table "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Sum_Order_By = {
  entryNumber?: InputMaybe<Order_By>;
};

/** update columns of table "workout_session_cardio_entries" */
export enum WorkoutSessionCardioEntries_Update_Column {
  /** column name */
  EntryNumber = 'entryNumber',
  /** column name */
  Metrics = 'metrics'
}

export type WorkoutSessionCardioEntries_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<WorkoutSessionCardioEntries_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<WorkoutSessionCardioEntries_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<WorkoutSessionCardioEntries_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<WorkoutSessionCardioEntries_Delete_Key_Input>;
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<WorkoutSessionCardioEntries_Inc_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<WorkoutSessionCardioEntries_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<WorkoutSessionCardioEntries_Set_Input>;
  /** filter the rows which have to be updated */
  where: WorkoutSessionCardioEntries_Bool_Exp;
};

/** aggregate var_pop on columns */
export type WorkoutSessionCardioEntries_Var_Pop_Fields = {
  __typename?: 'workoutSessionCardioEntries_var_pop_fields';
  entryNumber?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Var_Pop_Order_By = {
  entryNumber?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type WorkoutSessionCardioEntries_Var_Samp_Fields = {
  __typename?: 'workoutSessionCardioEntries_var_samp_fields';
  entryNumber?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Var_Samp_Order_By = {
  entryNumber?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type WorkoutSessionCardioEntries_Variance_Fields = {
  __typename?: 'workoutSessionCardioEntries_variance_fields';
  entryNumber?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Variance_Order_By = {
  entryNumber?: InputMaybe<Order_By>;
};

/** columns and relationships of "workout_session_exercises" */
export type WorkoutSessionExercises = {
  __typename?: 'workoutSessionExercises';
  createdAt: Scalars['timestamptz']['output'];
  /** An object relationship */
  exercise: Exercises;
  exerciseId: Scalars['uuid']['output'];
  id: Scalars['uuid']['output'];
  position: Scalars['Int']['output'];
  updatedAt: Scalars['timestamptz']['output'];
  /** An object relationship */
  workoutSession: WorkoutSessions;
  /** An array relationship */
  workoutSessionCardioEntries: Array<WorkoutSessionCardioEntries>;
  /** An aggregate relationship */
  workoutSessionCardioEntries_aggregate: WorkoutSessionCardioEntries_Aggregate;
  workoutSessionId: Scalars['uuid']['output'];
  /** An array relationship */
  workoutSessionSets: Array<WorkoutSessionSets>;
  /** An aggregate relationship */
  workoutSessionSets_aggregate: WorkoutSessionSets_Aggregate;
};


/** columns and relationships of "workout_session_exercises" */
export type WorkoutSessionExercisesWorkoutSessionCardioEntriesArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionCardioEntries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionCardioEntries_Order_By>>;
  where?: InputMaybe<WorkoutSessionCardioEntries_Bool_Exp>;
};


/** columns and relationships of "workout_session_exercises" */
export type WorkoutSessionExercisesWorkoutSessionCardioEntries_AggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionCardioEntries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionCardioEntries_Order_By>>;
  where?: InputMaybe<WorkoutSessionCardioEntries_Bool_Exp>;
};


/** columns and relationships of "workout_session_exercises" */
export type WorkoutSessionExercisesWorkoutSessionSetsArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionSets_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionSets_Order_By>>;
  where?: InputMaybe<WorkoutSessionSets_Bool_Exp>;
};


/** columns and relationships of "workout_session_exercises" */
export type WorkoutSessionExercisesWorkoutSessionSets_AggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionSets_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionSets_Order_By>>;
  where?: InputMaybe<WorkoutSessionSets_Bool_Exp>;
};

/** aggregated selection of "workout_session_exercises" */
export type WorkoutSessionExercises_Aggregate = {
  __typename?: 'workoutSessionExercises_aggregate';
  aggregate?: Maybe<WorkoutSessionExercises_Aggregate_Fields>;
  nodes: Array<WorkoutSessionExercises>;
};

export type WorkoutSessionExercises_Aggregate_Bool_Exp = {
  count?: InputMaybe<WorkoutSessionExercises_Aggregate_Bool_Exp_Count>;
};

export type WorkoutSessionExercises_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<WorkoutSessionExercises_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<WorkoutSessionExercises_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "workout_session_exercises" */
export type WorkoutSessionExercises_Aggregate_Fields = {
  __typename?: 'workoutSessionExercises_aggregate_fields';
  avg?: Maybe<WorkoutSessionExercises_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<WorkoutSessionExercises_Max_Fields>;
  min?: Maybe<WorkoutSessionExercises_Min_Fields>;
  stddev?: Maybe<WorkoutSessionExercises_Stddev_Fields>;
  stddev_pop?: Maybe<WorkoutSessionExercises_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<WorkoutSessionExercises_Stddev_Samp_Fields>;
  sum?: Maybe<WorkoutSessionExercises_Sum_Fields>;
  var_pop?: Maybe<WorkoutSessionExercises_Var_Pop_Fields>;
  var_samp?: Maybe<WorkoutSessionExercises_Var_Samp_Fields>;
  variance?: Maybe<WorkoutSessionExercises_Variance_Fields>;
};


/** aggregate fields of "workout_session_exercises" */
export type WorkoutSessionExercises_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<WorkoutSessionExercises_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "workout_session_exercises" */
export type WorkoutSessionExercises_Aggregate_Order_By = {
  avg?: InputMaybe<WorkoutSessionExercises_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<WorkoutSessionExercises_Max_Order_By>;
  min?: InputMaybe<WorkoutSessionExercises_Min_Order_By>;
  stddev?: InputMaybe<WorkoutSessionExercises_Stddev_Order_By>;
  stddev_pop?: InputMaybe<WorkoutSessionExercises_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<WorkoutSessionExercises_Stddev_Samp_Order_By>;
  sum?: InputMaybe<WorkoutSessionExercises_Sum_Order_By>;
  var_pop?: InputMaybe<WorkoutSessionExercises_Var_Pop_Order_By>;
  var_samp?: InputMaybe<WorkoutSessionExercises_Var_Samp_Order_By>;
  variance?: InputMaybe<WorkoutSessionExercises_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "workout_session_exercises" */
export type WorkoutSessionExercises_Arr_Rel_Insert_Input = {
  data: Array<WorkoutSessionExercises_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<WorkoutSessionExercises_On_Conflict>;
};

/** aggregate avg on columns */
export type WorkoutSessionExercises_Avg_Fields = {
  __typename?: 'workoutSessionExercises_avg_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "workout_session_exercises" */
export type WorkoutSessionExercises_Avg_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "workout_session_exercises". All fields are combined with a logical 'AND'. */
export type WorkoutSessionExercises_Bool_Exp = {
  _and?: InputMaybe<Array<WorkoutSessionExercises_Bool_Exp>>;
  _not?: InputMaybe<WorkoutSessionExercises_Bool_Exp>;
  _or?: InputMaybe<Array<WorkoutSessionExercises_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  exercise?: InputMaybe<Exercises_Bool_Exp>;
  exerciseId?: InputMaybe<Uuid_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  position?: InputMaybe<Int_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  workoutSession?: InputMaybe<WorkoutSessions_Bool_Exp>;
  workoutSessionCardioEntries?: InputMaybe<WorkoutSessionCardioEntries_Bool_Exp>;
  workoutSessionCardioEntries_aggregate?: InputMaybe<WorkoutSessionCardioEntries_Aggregate_Bool_Exp>;
  workoutSessionId?: InputMaybe<Uuid_Comparison_Exp>;
  workoutSessionSets?: InputMaybe<WorkoutSessionSets_Bool_Exp>;
  workoutSessionSets_aggregate?: InputMaybe<WorkoutSessionSets_Aggregate_Bool_Exp>;
};

/** unique or primary key constraints on table "workout_session_exercises" */
export enum WorkoutSessionExercises_Constraint {
  /** unique or primary key constraint on columns "id" */
  WorkoutSessionExercisesPkey = 'workout_session_exercises_pkey',
  /** unique or primary key constraint on columns "workout_session_id", "position" */
  WorkoutSessionExercisesWorkoutSessionIdPositionKey = 'workout_session_exercises_workout_session_id_position_key'
}

/** input type for incrementing numeric columns in table "workout_session_exercises" */
export type WorkoutSessionExercises_Inc_Input = {
  position?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "workout_session_exercises" */
export type WorkoutSessionExercises_Insert_Input = {
  exercise?: InputMaybe<Exercises_Obj_Rel_Insert_Input>;
  exerciseId?: InputMaybe<Scalars['uuid']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  workoutSession?: InputMaybe<WorkoutSessions_Obj_Rel_Insert_Input>;
  workoutSessionCardioEntries?: InputMaybe<WorkoutSessionCardioEntries_Arr_Rel_Insert_Input>;
  workoutSessionId?: InputMaybe<Scalars['uuid']['input']>;
  workoutSessionSets?: InputMaybe<WorkoutSessionSets_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type WorkoutSessionExercises_Max_Fields = {
  __typename?: 'workoutSessionExercises_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  exerciseId?: Maybe<Scalars['uuid']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  workoutSessionId?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "workout_session_exercises" */
export type WorkoutSessionExercises_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  exerciseId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  workoutSessionId?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type WorkoutSessionExercises_Min_Fields = {
  __typename?: 'workoutSessionExercises_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  exerciseId?: Maybe<Scalars['uuid']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  workoutSessionId?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "workout_session_exercises" */
export type WorkoutSessionExercises_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  exerciseId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  workoutSessionId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "workout_session_exercises" */
export type WorkoutSessionExercises_Mutation_Response = {
  __typename?: 'workoutSessionExercises_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<WorkoutSessionExercises>;
};

/** input type for inserting object relation for remote table "workout_session_exercises" */
export type WorkoutSessionExercises_Obj_Rel_Insert_Input = {
  data: WorkoutSessionExercises_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<WorkoutSessionExercises_On_Conflict>;
};

/** on_conflict condition type for table "workout_session_exercises" */
export type WorkoutSessionExercises_On_Conflict = {
  constraint: WorkoutSessionExercises_Constraint;
  update_columns?: Array<WorkoutSessionExercises_Update_Column>;
  where?: InputMaybe<WorkoutSessionExercises_Bool_Exp>;
};

/** Ordering options when selecting data from "workout_session_exercises". */
export type WorkoutSessionExercises_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  exercise?: InputMaybe<Exercises_Order_By>;
  exerciseId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  workoutSession?: InputMaybe<WorkoutSessions_Order_By>;
  workoutSessionCardioEntries_aggregate?: InputMaybe<WorkoutSessionCardioEntries_Aggregate_Order_By>;
  workoutSessionId?: InputMaybe<Order_By>;
  workoutSessionSets_aggregate?: InputMaybe<WorkoutSessionSets_Aggregate_Order_By>;
};

/** primary key columns input for table: workout_session_exercises */
export type WorkoutSessionExercises_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "workout_session_exercises" */
export enum WorkoutSessionExercises_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  ExerciseId = 'exerciseId',
  /** column name */
  Id = 'id',
  /** column name */
  Position = 'position',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  WorkoutSessionId = 'workoutSessionId'
}

/** input type for updating data in table "workout_session_exercises" */
export type WorkoutSessionExercises_Set_Input = {
  position?: InputMaybe<Scalars['Int']['input']>;
};

/** aggregate stddev on columns */
export type WorkoutSessionExercises_Stddev_Fields = {
  __typename?: 'workoutSessionExercises_stddev_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "workout_session_exercises" */
export type WorkoutSessionExercises_Stddev_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type WorkoutSessionExercises_Stddev_Pop_Fields = {
  __typename?: 'workoutSessionExercises_stddev_pop_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "workout_session_exercises" */
export type WorkoutSessionExercises_Stddev_Pop_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type WorkoutSessionExercises_Stddev_Samp_Fields = {
  __typename?: 'workoutSessionExercises_stddev_samp_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "workout_session_exercises" */
export type WorkoutSessionExercises_Stddev_Samp_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "workoutSessionExercises" */
export type WorkoutSessionExercises_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: WorkoutSessionExercises_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type WorkoutSessionExercises_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  exerciseId?: InputMaybe<Scalars['uuid']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
  workoutSessionId?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate sum on columns */
export type WorkoutSessionExercises_Sum_Fields = {
  __typename?: 'workoutSessionExercises_sum_fields';
  position?: Maybe<Scalars['Int']['output']>;
};

/** order by sum() on columns of table "workout_session_exercises" */
export type WorkoutSessionExercises_Sum_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** update columns of table "workout_session_exercises" */
export enum WorkoutSessionExercises_Update_Column {
  /** column name */
  Position = 'position'
}

export type WorkoutSessionExercises_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<WorkoutSessionExercises_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<WorkoutSessionExercises_Set_Input>;
  /** filter the rows which have to be updated */
  where: WorkoutSessionExercises_Bool_Exp;
};

/** aggregate var_pop on columns */
export type WorkoutSessionExercises_Var_Pop_Fields = {
  __typename?: 'workoutSessionExercises_var_pop_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "workout_session_exercises" */
export type WorkoutSessionExercises_Var_Pop_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type WorkoutSessionExercises_Var_Samp_Fields = {
  __typename?: 'workoutSessionExercises_var_samp_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "workout_session_exercises" */
export type WorkoutSessionExercises_Var_Samp_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type WorkoutSessionExercises_Variance_Fields = {
  __typename?: 'workoutSessionExercises_variance_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "workout_session_exercises" */
export type WorkoutSessionExercises_Variance_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** columns and relationships of "workout_session_sets" */
export type WorkoutSessionSets = {
  __typename?: 'workoutSessionSets';
  createdAt: Scalars['timestamptz']['output'];
  id: Scalars['uuid']['output'];
  reps: Scalars['Int']['output'];
  setNumber: Scalars['Int']['output'];
  updatedAt: Scalars['timestamptz']['output'];
  weight: Scalars['numeric']['output'];
  /** An object relationship */
  workoutSessionExercise: WorkoutSessionExercises;
  workoutSessionExerciseId: Scalars['uuid']['output'];
};

/** aggregated selection of "workout_session_sets" */
export type WorkoutSessionSets_Aggregate = {
  __typename?: 'workoutSessionSets_aggregate';
  aggregate?: Maybe<WorkoutSessionSets_Aggregate_Fields>;
  nodes: Array<WorkoutSessionSets>;
};

export type WorkoutSessionSets_Aggregate_Bool_Exp = {
  count?: InputMaybe<WorkoutSessionSets_Aggregate_Bool_Exp_Count>;
};

export type WorkoutSessionSets_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<WorkoutSessionSets_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<WorkoutSessionSets_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "workout_session_sets" */
export type WorkoutSessionSets_Aggregate_Fields = {
  __typename?: 'workoutSessionSets_aggregate_fields';
  avg?: Maybe<WorkoutSessionSets_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<WorkoutSessionSets_Max_Fields>;
  min?: Maybe<WorkoutSessionSets_Min_Fields>;
  stddev?: Maybe<WorkoutSessionSets_Stddev_Fields>;
  stddev_pop?: Maybe<WorkoutSessionSets_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<WorkoutSessionSets_Stddev_Samp_Fields>;
  sum?: Maybe<WorkoutSessionSets_Sum_Fields>;
  var_pop?: Maybe<WorkoutSessionSets_Var_Pop_Fields>;
  var_samp?: Maybe<WorkoutSessionSets_Var_Samp_Fields>;
  variance?: Maybe<WorkoutSessionSets_Variance_Fields>;
};


/** aggregate fields of "workout_session_sets" */
export type WorkoutSessionSets_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<WorkoutSessionSets_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "workout_session_sets" */
export type WorkoutSessionSets_Aggregate_Order_By = {
  avg?: InputMaybe<WorkoutSessionSets_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<WorkoutSessionSets_Max_Order_By>;
  min?: InputMaybe<WorkoutSessionSets_Min_Order_By>;
  stddev?: InputMaybe<WorkoutSessionSets_Stddev_Order_By>;
  stddev_pop?: InputMaybe<WorkoutSessionSets_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<WorkoutSessionSets_Stddev_Samp_Order_By>;
  sum?: InputMaybe<WorkoutSessionSets_Sum_Order_By>;
  var_pop?: InputMaybe<WorkoutSessionSets_Var_Pop_Order_By>;
  var_samp?: InputMaybe<WorkoutSessionSets_Var_Samp_Order_By>;
  variance?: InputMaybe<WorkoutSessionSets_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "workout_session_sets" */
export type WorkoutSessionSets_Arr_Rel_Insert_Input = {
  data: Array<WorkoutSessionSets_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<WorkoutSessionSets_On_Conflict>;
};

/** aggregate avg on columns */
export type WorkoutSessionSets_Avg_Fields = {
  __typename?: 'workoutSessionSets_avg_fields';
  reps?: Maybe<Scalars['Float']['output']>;
  setNumber?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "workout_session_sets" */
export type WorkoutSessionSets_Avg_Order_By = {
  reps?: InputMaybe<Order_By>;
  setNumber?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "workout_session_sets". All fields are combined with a logical 'AND'. */
export type WorkoutSessionSets_Bool_Exp = {
  _and?: InputMaybe<Array<WorkoutSessionSets_Bool_Exp>>;
  _not?: InputMaybe<WorkoutSessionSets_Bool_Exp>;
  _or?: InputMaybe<Array<WorkoutSessionSets_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  reps?: InputMaybe<Int_Comparison_Exp>;
  setNumber?: InputMaybe<Int_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  weight?: InputMaybe<Numeric_Comparison_Exp>;
  workoutSessionExercise?: InputMaybe<WorkoutSessionExercises_Bool_Exp>;
  workoutSessionExerciseId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "workout_session_sets" */
export enum WorkoutSessionSets_Constraint {
  /** unique or primary key constraint on columns "id" */
  WorkoutSessionSetsPkey = 'workout_session_sets_pkey',
  /** unique or primary key constraint on columns "workout_session_exercise_id", "set_number" */
  WorkoutSessionSetsWorkoutSessionExerciseIdSetNumberKey = 'workout_session_sets_workout_session_exercise_id_set_number_key'
}

/** input type for incrementing numeric columns in table "workout_session_sets" */
export type WorkoutSessionSets_Inc_Input = {
  reps?: InputMaybe<Scalars['Int']['input']>;
  setNumber?: InputMaybe<Scalars['Int']['input']>;
  weight?: InputMaybe<Scalars['numeric']['input']>;
};

/** input type for inserting data into table "workout_session_sets" */
export type WorkoutSessionSets_Insert_Input = {
  reps?: InputMaybe<Scalars['Int']['input']>;
  setNumber?: InputMaybe<Scalars['Int']['input']>;
  weight?: InputMaybe<Scalars['numeric']['input']>;
  workoutSessionExercise?: InputMaybe<WorkoutSessionExercises_Obj_Rel_Insert_Input>;
  workoutSessionExerciseId?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate max on columns */
export type WorkoutSessionSets_Max_Fields = {
  __typename?: 'workoutSessionSets_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  reps?: Maybe<Scalars['Int']['output']>;
  setNumber?: Maybe<Scalars['Int']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  weight?: Maybe<Scalars['numeric']['output']>;
  workoutSessionExerciseId?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "workout_session_sets" */
export type WorkoutSessionSets_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  reps?: InputMaybe<Order_By>;
  setNumber?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
  workoutSessionExerciseId?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type WorkoutSessionSets_Min_Fields = {
  __typename?: 'workoutSessionSets_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  reps?: Maybe<Scalars['Int']['output']>;
  setNumber?: Maybe<Scalars['Int']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  weight?: Maybe<Scalars['numeric']['output']>;
  workoutSessionExerciseId?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "workout_session_sets" */
export type WorkoutSessionSets_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  reps?: InputMaybe<Order_By>;
  setNumber?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
  workoutSessionExerciseId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "workout_session_sets" */
export type WorkoutSessionSets_Mutation_Response = {
  __typename?: 'workoutSessionSets_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<WorkoutSessionSets>;
};

/** on_conflict condition type for table "workout_session_sets" */
export type WorkoutSessionSets_On_Conflict = {
  constraint: WorkoutSessionSets_Constraint;
  update_columns?: Array<WorkoutSessionSets_Update_Column>;
  where?: InputMaybe<WorkoutSessionSets_Bool_Exp>;
};

/** Ordering options when selecting data from "workout_session_sets". */
export type WorkoutSessionSets_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  reps?: InputMaybe<Order_By>;
  setNumber?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
  workoutSessionExercise?: InputMaybe<WorkoutSessionExercises_Order_By>;
  workoutSessionExerciseId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: workout_session_sets */
export type WorkoutSessionSets_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "workout_session_sets" */
export enum WorkoutSessionSets_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  Reps = 'reps',
  /** column name */
  SetNumber = 'setNumber',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  Weight = 'weight',
  /** column name */
  WorkoutSessionExerciseId = 'workoutSessionExerciseId'
}

/** input type for updating data in table "workout_session_sets" */
export type WorkoutSessionSets_Set_Input = {
  reps?: InputMaybe<Scalars['Int']['input']>;
  setNumber?: InputMaybe<Scalars['Int']['input']>;
  weight?: InputMaybe<Scalars['numeric']['input']>;
};

/** aggregate stddev on columns */
export type WorkoutSessionSets_Stddev_Fields = {
  __typename?: 'workoutSessionSets_stddev_fields';
  reps?: Maybe<Scalars['Float']['output']>;
  setNumber?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "workout_session_sets" */
export type WorkoutSessionSets_Stddev_Order_By = {
  reps?: InputMaybe<Order_By>;
  setNumber?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type WorkoutSessionSets_Stddev_Pop_Fields = {
  __typename?: 'workoutSessionSets_stddev_pop_fields';
  reps?: Maybe<Scalars['Float']['output']>;
  setNumber?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "workout_session_sets" */
export type WorkoutSessionSets_Stddev_Pop_Order_By = {
  reps?: InputMaybe<Order_By>;
  setNumber?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type WorkoutSessionSets_Stddev_Samp_Fields = {
  __typename?: 'workoutSessionSets_stddev_samp_fields';
  reps?: Maybe<Scalars['Float']['output']>;
  setNumber?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "workout_session_sets" */
export type WorkoutSessionSets_Stddev_Samp_Order_By = {
  reps?: InputMaybe<Order_By>;
  setNumber?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "workoutSessionSets" */
export type WorkoutSessionSets_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: WorkoutSessionSets_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type WorkoutSessionSets_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  reps?: InputMaybe<Scalars['Int']['input']>;
  setNumber?: InputMaybe<Scalars['Int']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
  weight?: InputMaybe<Scalars['numeric']['input']>;
  workoutSessionExerciseId?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate sum on columns */
export type WorkoutSessionSets_Sum_Fields = {
  __typename?: 'workoutSessionSets_sum_fields';
  reps?: Maybe<Scalars['Int']['output']>;
  setNumber?: Maybe<Scalars['Int']['output']>;
  weight?: Maybe<Scalars['numeric']['output']>;
};

/** order by sum() on columns of table "workout_session_sets" */
export type WorkoutSessionSets_Sum_Order_By = {
  reps?: InputMaybe<Order_By>;
  setNumber?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** update columns of table "workout_session_sets" */
export enum WorkoutSessionSets_Update_Column {
  /** column name */
  Reps = 'reps',
  /** column name */
  SetNumber = 'setNumber',
  /** column name */
  Weight = 'weight'
}

export type WorkoutSessionSets_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<WorkoutSessionSets_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<WorkoutSessionSets_Set_Input>;
  /** filter the rows which have to be updated */
  where: WorkoutSessionSets_Bool_Exp;
};

/** aggregate var_pop on columns */
export type WorkoutSessionSets_Var_Pop_Fields = {
  __typename?: 'workoutSessionSets_var_pop_fields';
  reps?: Maybe<Scalars['Float']['output']>;
  setNumber?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "workout_session_sets" */
export type WorkoutSessionSets_Var_Pop_Order_By = {
  reps?: InputMaybe<Order_By>;
  setNumber?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type WorkoutSessionSets_Var_Samp_Fields = {
  __typename?: 'workoutSessionSets_var_samp_fields';
  reps?: Maybe<Scalars['Float']['output']>;
  setNumber?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "workout_session_sets" */
export type WorkoutSessionSets_Var_Samp_Order_By = {
  reps?: InputMaybe<Order_By>;
  setNumber?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type WorkoutSessionSets_Variance_Fields = {
  __typename?: 'workoutSessionSets_variance_fields';
  reps?: Maybe<Scalars['Float']['output']>;
  setNumber?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "workout_session_sets" */
export type WorkoutSessionSets_Variance_Order_By = {
  reps?: InputMaybe<Order_By>;
  setNumber?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** columns and relationships of "workout_sessions" */
export type WorkoutSessions = {
  __typename?: 'workoutSessions';
  createdAt: Scalars['timestamptz']['output'];
  id: Scalars['uuid']['output'];
  startedAt: Scalars['timestamptz']['output'];
  updatedAt: Scalars['timestamptz']['output'];
  userId: Scalars['uuid']['output'];
  /** An object relationship */
  workout?: Maybe<Workouts>;
  workoutId?: Maybe<Scalars['uuid']['output']>;
  /** An array relationship */
  workoutSessionExercises: Array<WorkoutSessionExercises>;
  /** An aggregate relationship */
  workoutSessionExercises_aggregate: WorkoutSessionExercises_Aggregate;
};


/** columns and relationships of "workout_sessions" */
export type WorkoutSessionsWorkoutSessionExercisesArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionExercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionExercises_Order_By>>;
  where?: InputMaybe<WorkoutSessionExercises_Bool_Exp>;
};


/** columns and relationships of "workout_sessions" */
export type WorkoutSessionsWorkoutSessionExercises_AggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionExercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionExercises_Order_By>>;
  where?: InputMaybe<WorkoutSessionExercises_Bool_Exp>;
};

/** aggregated selection of "workout_sessions" */
export type WorkoutSessions_Aggregate = {
  __typename?: 'workoutSessions_aggregate';
  aggregate?: Maybe<WorkoutSessions_Aggregate_Fields>;
  nodes: Array<WorkoutSessions>;
};

export type WorkoutSessions_Aggregate_Bool_Exp = {
  count?: InputMaybe<WorkoutSessions_Aggregate_Bool_Exp_Count>;
};

export type WorkoutSessions_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<WorkoutSessions_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<WorkoutSessions_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "workout_sessions" */
export type WorkoutSessions_Aggregate_Fields = {
  __typename?: 'workoutSessions_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<WorkoutSessions_Max_Fields>;
  min?: Maybe<WorkoutSessions_Min_Fields>;
};


/** aggregate fields of "workout_sessions" */
export type WorkoutSessions_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<WorkoutSessions_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "workout_sessions" */
export type WorkoutSessions_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<WorkoutSessions_Max_Order_By>;
  min?: InputMaybe<WorkoutSessions_Min_Order_By>;
};

/** input type for inserting array relation for remote table "workout_sessions" */
export type WorkoutSessions_Arr_Rel_Insert_Input = {
  data: Array<WorkoutSessions_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<WorkoutSessions_On_Conflict>;
};

/** Boolean expression to filter rows from the table "workout_sessions". All fields are combined with a logical 'AND'. */
export type WorkoutSessions_Bool_Exp = {
  _and?: InputMaybe<Array<WorkoutSessions_Bool_Exp>>;
  _not?: InputMaybe<WorkoutSessions_Bool_Exp>;
  _or?: InputMaybe<Array<WorkoutSessions_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  startedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  userId?: InputMaybe<Uuid_Comparison_Exp>;
  workout?: InputMaybe<Workouts_Bool_Exp>;
  workoutId?: InputMaybe<Uuid_Comparison_Exp>;
  workoutSessionExercises?: InputMaybe<WorkoutSessionExercises_Bool_Exp>;
  workoutSessionExercises_aggregate?: InputMaybe<WorkoutSessionExercises_Aggregate_Bool_Exp>;
};

/** unique or primary key constraints on table "workout_sessions" */
export enum WorkoutSessions_Constraint {
  /** unique or primary key constraint on columns "id" */
  WorkoutSessionsPkey = 'workout_sessions_pkey'
}

/** input type for inserting data into table "workout_sessions" */
export type WorkoutSessions_Insert_Input = {
  startedAt?: InputMaybe<Scalars['timestamptz']['input']>;
  workout?: InputMaybe<Workouts_Obj_Rel_Insert_Input>;
  workoutId?: InputMaybe<Scalars['uuid']['input']>;
  workoutSessionExercises?: InputMaybe<WorkoutSessionExercises_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type WorkoutSessions_Max_Fields = {
  __typename?: 'workoutSessions_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  startedAt?: Maybe<Scalars['timestamptz']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
  workoutId?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "workout_sessions" */
export type WorkoutSessions_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  startedAt?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
  workoutId?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type WorkoutSessions_Min_Fields = {
  __typename?: 'workoutSessions_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  startedAt?: Maybe<Scalars['timestamptz']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
  workoutId?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "workout_sessions" */
export type WorkoutSessions_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  startedAt?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
  workoutId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "workout_sessions" */
export type WorkoutSessions_Mutation_Response = {
  __typename?: 'workoutSessions_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<WorkoutSessions>;
};

/** input type for inserting object relation for remote table "workout_sessions" */
export type WorkoutSessions_Obj_Rel_Insert_Input = {
  data: WorkoutSessions_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<WorkoutSessions_On_Conflict>;
};

/** on_conflict condition type for table "workout_sessions" */
export type WorkoutSessions_On_Conflict = {
  constraint: WorkoutSessions_Constraint;
  update_columns?: Array<WorkoutSessions_Update_Column>;
  where?: InputMaybe<WorkoutSessions_Bool_Exp>;
};

/** Ordering options when selecting data from "workout_sessions". */
export type WorkoutSessions_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  startedAt?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
  workout?: InputMaybe<Workouts_Order_By>;
  workoutId?: InputMaybe<Order_By>;
  workoutSessionExercises_aggregate?: InputMaybe<WorkoutSessionExercises_Aggregate_Order_By>;
};

/** primary key columns input for table: workout_sessions */
export type WorkoutSessions_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "workout_sessions" */
export enum WorkoutSessions_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  StartedAt = 'startedAt',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UserId = 'userId',
  /** column name */
  WorkoutId = 'workoutId'
}

/** input type for updating data in table "workout_sessions" */
export type WorkoutSessions_Set_Input = {
  startedAt?: InputMaybe<Scalars['timestamptz']['input']>;
  workoutId?: InputMaybe<Scalars['uuid']['input']>;
};

/** Streaming cursor of the table "workoutSessions" */
export type WorkoutSessions_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: WorkoutSessions_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type WorkoutSessions_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  startedAt?: InputMaybe<Scalars['timestamptz']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
  userId?: InputMaybe<Scalars['uuid']['input']>;
  workoutId?: InputMaybe<Scalars['uuid']['input']>;
};

/** update columns of table "workout_sessions" */
export enum WorkoutSessions_Update_Column {
  /** column name */
  StartedAt = 'startedAt',
  /** column name */
  WorkoutId = 'workoutId'
}

export type WorkoutSessions_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<WorkoutSessions_Set_Input>;
  /** filter the rows which have to be updated */
  where: WorkoutSessions_Bool_Exp;
};

/** columns and relationships of "workouts" */
export type Workouts = {
  __typename?: 'workouts';
  createdAt: Scalars['timestamptz']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['uuid']['output'];
  isPublic: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  updatedAt: Scalars['timestamptz']['output'];
  userId?: Maybe<Scalars['uuid']['output']>;
  /** An array relationship */
  workoutExercises: Array<WorkoutExercises>;
  /** An aggregate relationship */
  workoutExercises_aggregate: WorkoutExercises_Aggregate;
  /** An array relationship */
  workoutLabels: Array<WorkoutLabels>;
  /** An aggregate relationship */
  workoutLabels_aggregate: WorkoutLabels_Aggregate;
  /** An array relationship */
  workoutSessions: Array<WorkoutSessions>;
  /** An aggregate relationship */
  workoutSessions_aggregate: WorkoutSessions_Aggregate;
};


/** columns and relationships of "workouts" */
export type WorkoutsWorkoutExercisesArgs = {
  distinct_on?: InputMaybe<Array<WorkoutExercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutExercises_Order_By>>;
  where?: InputMaybe<WorkoutExercises_Bool_Exp>;
};


/** columns and relationships of "workouts" */
export type WorkoutsWorkoutExercises_AggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutExercises_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutExercises_Order_By>>;
  where?: InputMaybe<WorkoutExercises_Bool_Exp>;
};


/** columns and relationships of "workouts" */
export type WorkoutsWorkoutLabelsArgs = {
  distinct_on?: InputMaybe<Array<WorkoutLabels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutLabels_Order_By>>;
  where?: InputMaybe<WorkoutLabels_Bool_Exp>;
};


/** columns and relationships of "workouts" */
export type WorkoutsWorkoutLabels_AggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutLabels_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutLabels_Order_By>>;
  where?: InputMaybe<WorkoutLabels_Bool_Exp>;
};


/** columns and relationships of "workouts" */
export type WorkoutsWorkoutSessionsArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessions_Order_By>>;
  where?: InputMaybe<WorkoutSessions_Bool_Exp>;
};


/** columns and relationships of "workouts" */
export type WorkoutsWorkoutSessions_AggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessions_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessions_Order_By>>;
  where?: InputMaybe<WorkoutSessions_Bool_Exp>;
};

/** aggregated selection of "workouts" */
export type Workouts_Aggregate = {
  __typename?: 'workouts_aggregate';
  aggregate?: Maybe<Workouts_Aggregate_Fields>;
  nodes: Array<Workouts>;
};

/** aggregate fields of "workouts" */
export type Workouts_Aggregate_Fields = {
  __typename?: 'workouts_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Workouts_Max_Fields>;
  min?: Maybe<Workouts_Min_Fields>;
};


/** aggregate fields of "workouts" */
export type Workouts_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Workouts_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "workouts". All fields are combined with a logical 'AND'. */
export type Workouts_Bool_Exp = {
  _and?: InputMaybe<Array<Workouts_Bool_Exp>>;
  _not?: InputMaybe<Workouts_Bool_Exp>;
  _or?: InputMaybe<Array<Workouts_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  description?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  isPublic?: InputMaybe<Boolean_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  userId?: InputMaybe<Uuid_Comparison_Exp>;
  workoutExercises?: InputMaybe<WorkoutExercises_Bool_Exp>;
  workoutExercises_aggregate?: InputMaybe<WorkoutExercises_Aggregate_Bool_Exp>;
  workoutLabels?: InputMaybe<WorkoutLabels_Bool_Exp>;
  workoutLabels_aggregate?: InputMaybe<WorkoutLabels_Aggregate_Bool_Exp>;
  workoutSessions?: InputMaybe<WorkoutSessions_Bool_Exp>;
  workoutSessions_aggregate?: InputMaybe<WorkoutSessions_Aggregate_Bool_Exp>;
};

/** unique or primary key constraints on table "workouts" */
export enum Workouts_Constraint {
  /** unique or primary key constraint on columns "id" */
  WorkoutsPkey = 'workouts_pkey',
  /** unique or primary key constraint on columns "user_id", "name" */
  WorkoutsUserNameUq = 'workouts_user_name_uq'
}

/** input type for inserting data into table "workouts" */
export type Workouts_Insert_Input = {
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  workoutExercises?: InputMaybe<WorkoutExercises_Arr_Rel_Insert_Input>;
  workoutLabels?: InputMaybe<WorkoutLabels_Arr_Rel_Insert_Input>;
  workoutSessions?: InputMaybe<WorkoutSessions_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type Workouts_Max_Fields = {
  __typename?: 'workouts_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
};

/** aggregate min on columns */
export type Workouts_Min_Fields = {
  __typename?: 'workouts_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
};

/** response of any mutation on the table "workouts" */
export type Workouts_Mutation_Response = {
  __typename?: 'workouts_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Workouts>;
};

/** input type for inserting object relation for remote table "workouts" */
export type Workouts_Obj_Rel_Insert_Input = {
  data: Workouts_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Workouts_On_Conflict>;
};

/** on_conflict condition type for table "workouts" */
export type Workouts_On_Conflict = {
  constraint: Workouts_Constraint;
  update_columns?: Array<Workouts_Update_Column>;
  where?: InputMaybe<Workouts_Bool_Exp>;
};

/** Ordering options when selecting data from "workouts". */
export type Workouts_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  isPublic?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
  workoutExercises_aggregate?: InputMaybe<WorkoutExercises_Aggregate_Order_By>;
  workoutLabels_aggregate?: InputMaybe<WorkoutLabels_Aggregate_Order_By>;
  workoutSessions_aggregate?: InputMaybe<WorkoutSessions_Aggregate_Order_By>;
};

/** primary key columns input for table: workouts */
export type Workouts_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "workouts" */
export enum Workouts_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Description = 'description',
  /** column name */
  Id = 'id',
  /** column name */
  IsPublic = 'isPublic',
  /** column name */
  Name = 'name',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UserId = 'userId'
}

/** input type for updating data in table "workouts" */
export type Workouts_Set_Input = {
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

/** Streaming cursor of the table "workouts" */
export type Workouts_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Workouts_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Workouts_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
  userId?: InputMaybe<Scalars['uuid']['input']>;
};

/** update columns of table "workouts" */
export enum Workouts_Update_Column {
  /** column name */
  Description = 'description',
  /** column name */
  Name = 'name'
}

export type Workouts_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Workouts_Set_Input>;
  /** filter the rows which have to be updated */
  where: Workouts_Bool_Exp;
};

export type BreadcrumbWorkoutQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type BreadcrumbWorkoutQuery = { __typename?: 'query_root', workout?: { __typename?: 'workouts', id: any, name: string } | null };

export type BreadcrumbExerciseQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type BreadcrumbExerciseQuery = { __typename?: 'query_root', exercise?: { __typename?: 'exercises', id: any, name: string } | null };

export type BreadcrumbSessionQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type BreadcrumbSessionQuery = { __typename?: 'query_root', workoutSession?: { __typename?: 'workoutSessions', id: any, startedAt: any, workout?: { __typename?: 'workouts', id: any, name: string } | null } | null };

export type BreadcrumbBodyMeasurementQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type BreadcrumbBodyMeasurementQuery = { __typename?: 'query_root', bodyMeasurement?: { __typename?: 'bodyMeasurements', id: any, measuredOn: any } | null };

export type BreadcrumbJournalEntryQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type BreadcrumbJournalEntryQuery = { __typename?: 'query_root', journalEntry?: { __typename?: 'journalEntries', id: any, entryDate: any, title?: string | null } | null };

export type ExerciseDetailQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type ExerciseDetailQuery = { __typename?: 'query_root', exercise?: { __typename?: 'exercises', id: any, name: string, instructions: Array<string>, image1FileId?: any | null, image2FileId?: any | null, doubleWeight: boolean, level?: ExerciseLevels_Enum | null, category?: ExerciseCategories_Enum | null, equipment?: ExerciseEquipments_Enum | null, force?: ExerciseForces_Enum | null, mechanic?: ExerciseMechanics_Enum | null, primaryMuscleGroup: MuscleGroups_Enum, metricsSchema?: any | null, secondaryMuscleGroups: Array<{ __typename?: 'exerciseSecondaryMuscleGroups', muscleGroup: MuscleGroups_Enum }>, workoutSessionExercises: Array<{ __typename?: 'workoutSessionExercises', id: any, workoutSession: { __typename?: 'workoutSessions', id: any, startedAt: any, workout?: { __typename?: 'workouts', id: any, name: string } | null }, workoutSessionSets: Array<{ __typename?: 'workoutSessionSets', id: any, setNumber: number, reps: number, weight: any }>, workoutSessionCardioEntries: Array<{ __typename?: 'workoutSessionCardioEntries', id: any, entryNumber: number, metrics: any }> }> } | null };

export type ExercisePickerExercisesQueryVariables = Exact<{ [key: string]: never; }>;


export type ExercisePickerExercisesQuery = { __typename?: 'query_root', exercises: Array<{ __typename?: 'exercises', id: any, name: string, primaryMuscleGroup: MuscleGroups_Enum, doubleWeight: boolean }> };

export type StartSessionMutationVariables = Exact<{
  obj: WorkoutSessions_Insert_Input;
}>;


export type StartSessionMutation = { __typename?: 'mutation_root', insertWorkoutSession?: { __typename?: 'workoutSessions', id: any } | null };

export type BodyMeasurementByIdQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type BodyMeasurementByIdQuery = { __typename?: 'query_root', bodyMeasurement?: { __typename?: 'bodyMeasurements', id: any, measuredOn: any, weightKg?: any | null, bodyFatPct?: any | null, notes?: string | null, updatedAt: any } | null };

export type EditBodyMeasurementQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type EditBodyMeasurementQuery = { __typename?: 'query_root', bodyMeasurement?: { __typename?: 'bodyMeasurements', id: any, measuredOn: any, weightKg?: any | null, bodyFatPct?: any | null, notes?: string | null } | null };

export type UpdateBodyMeasurementMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
  set: BodyMeasurements_Set_Input;
}>;


export type UpdateBodyMeasurementMutation = { __typename?: 'mutation_root', updateBodyMeasurement?: { __typename?: 'bodyMeasurements', id: any } | null };

export type DeleteBodyMeasurementMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type DeleteBodyMeasurementMutation = { __typename?: 'mutation_root', deleteBodyMeasurement?: { __typename?: 'bodyMeasurements', id: any } | null };

export type BodyMeasurementsQueryVariables = Exact<{ [key: string]: never; }>;


export type BodyMeasurementsQuery = { __typename?: 'query_root', bodyMeasurements: Array<{ __typename?: 'bodyMeasurements', id: any, measuredOn: any, weightKg?: any | null, bodyFatPct?: any | null, notes?: string | null }> };

export type InsertBodyMeasurementMutationVariables = Exact<{
  obj: BodyMeasurements_Insert_Input;
}>;


export type InsertBodyMeasurementMutation = { __typename?: 'mutation_root', insertBodyMeasurement?: { __typename?: 'bodyMeasurements', id: any } | null };

export type ExercisesIndexQueryVariables = Exact<{ [key: string]: never; }>;


export type ExercisesIndexQuery = { __typename?: 'query_root', exercises: Array<{ __typename?: 'exercises', id: any, name: string, doubleWeight: boolean, primaryMuscleGroup: MuscleGroups_Enum, category?: ExerciseCategories_Enum | null, equipment?: ExerciseEquipments_Enum | null, level?: ExerciseLevels_Enum | null, isPublic: boolean, secondaryMuscleGroups: Array<{ __typename?: 'exerciseSecondaryMuscleGroups', muscleGroup: MuscleGroups_Enum }> }> };

export type JournalEntryByIdQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type JournalEntryByIdQuery = { __typename?: 'query_root', journalEntry?: { __typename?: 'journalEntries', id: any, entryDate: any, title?: string | null, body: string, journalEntryLabels: Array<{ __typename?: 'journalEntryLabels', labelId: any, label: { __typename?: 'journalLabels', id: any, name: string } }> } | null };

export type EditJournalEntryQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type EditJournalEntryQuery = { __typename?: 'query_root', journalEntry?: { __typename?: 'journalEntries', id: any, entryDate: any, title?: string | null, body: string, journalEntryLabels: Array<{ __typename?: 'journalEntryLabels', labelId: any, label: { __typename?: 'journalLabels', id: any, name: string } }> } | null, journalLabels: Array<{ __typename?: 'journalLabels', id: any, name: string }> };

export type SaveJournalEntryMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
  set: JournalEntries_Set_Input;
  deleteLabelIds: Array<Scalars['uuid']['input']> | Scalars['uuid']['input'];
  insertLabels: Array<JournalEntryLabels_Insert_Input> | JournalEntryLabels_Insert_Input;
}>;


export type SaveJournalEntryMutation = { __typename?: 'mutation_root', updateJournalEntry?: { __typename?: 'journalEntries', id: any } | null, deleteJournalEntryLabels?: { __typename?: 'journalEntryLabels_mutation_response', affected_rows: number } | null, insertJournalEntryLabels?: { __typename?: 'journalEntryLabels_mutation_response', affected_rows: number } | null };

export type DeleteJournalEntryMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type DeleteJournalEntryMutation = { __typename?: 'mutation_root', deleteJournalEntry?: { __typename?: 'journalEntries', id: any } | null };

export type JournalEntriesQueryVariables = Exact<{
  limit: Scalars['Int']['input'];
  offset: Scalars['Int']['input'];
  where?: InputMaybe<JournalEntries_Bool_Exp>;
}>;


export type JournalEntriesQuery = { __typename?: 'query_root', journalEntries: Array<{ __typename?: 'journalEntries', id: any, entryDate: any, title?: string | null, body: string, journalEntryLabels: Array<{ __typename?: 'journalEntryLabels', labelId: any, label: { __typename?: 'journalLabels', id: any, name: string } }> }> };

export type JournalLabelsFilterQueryVariables = Exact<{ [key: string]: never; }>;


export type JournalLabelsFilterQuery = { __typename?: 'query_root', journalLabels: Array<{ __typename?: 'journalLabels', id: any, name: string }> };

export type JournalLabelsForFormQueryVariables = Exact<{ [key: string]: never; }>;


export type JournalLabelsForFormQuery = { __typename?: 'query_root', journalLabels: Array<{ __typename?: 'journalLabels', id: any, name: string }> };

export type InsertJournalEntryMutationVariables = Exact<{
  obj: JournalEntries_Insert_Input;
}>;


export type InsertJournalEntryMutation = { __typename?: 'mutation_root', insertJournalEntry?: { __typename?: 'journalEntries', id: any } | null };

export type SessionDetailQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type SessionDetailQuery = { __typename?: 'query_root', workoutSession?: { __typename?: 'workoutSessions', id: any, startedAt: any, workout?: { __typename?: 'workouts', id: any, name: string } | null, workoutSessionExercises: Array<{ __typename?: 'workoutSessionExercises', id: any, position: number, exercise: { __typename?: 'exercises', id: any, name: string, category?: ExerciseCategories_Enum | null, doubleWeight: boolean, primaryMuscleGroup: MuscleGroups_Enum, image1FileId?: any | null, image2FileId?: any | null, metricsSchema?: any | null }, workoutSessionSets: Array<{ __typename?: 'workoutSessionSets', id: any, setNumber: number, reps: number, weight: any }>, workoutSessionCardioEntries: Array<{ __typename?: 'workoutSessionCardioEntries', id: any, entryNumber: number, metrics: any }> }> } | null };

export type PriorSessionsPerExerciseQueryVariables = Exact<{
  exerciseIds: Array<Scalars['uuid']['input']> | Scalars['uuid']['input'];
  excludeSessionId: Scalars['uuid']['input'];
}>;


export type PriorSessionsPerExerciseQuery = { __typename?: 'query_root', exercises: Array<{ __typename?: 'exercises', id: any, workoutSessionExercises: Array<{ __typename?: 'workoutSessionExercises', id: any, workoutSession: { __typename?: 'workoutSessions', id: any, startedAt: any }, workoutSessionSets: Array<{ __typename?: 'workoutSessionSets', id: any, setNumber: number, reps: number, weight: any }>, workoutSessionCardioEntries: Array<{ __typename?: 'workoutSessionCardioEntries', id: any, entryNumber: number, metrics: any }> }> }> };

export type InsertWorkoutSessionSetMutationVariables = Exact<{
  obj: WorkoutSessionSets_Insert_Input;
}>;


export type InsertWorkoutSessionSetMutation = { __typename?: 'mutation_root', insertWorkoutSessionSet?: { __typename?: 'workoutSessionSets', id: any } | null };

export type UpdateWorkoutSessionSetMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
  set: WorkoutSessionSets_Set_Input;
}>;


export type UpdateWorkoutSessionSetMutation = { __typename?: 'mutation_root', updateWorkoutSessionSet?: { __typename?: 'workoutSessionSets', id: any } | null };

export type DeleteWorkoutSessionSetMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type DeleteWorkoutSessionSetMutation = { __typename?: 'mutation_root', deleteWorkoutSessionSet?: { __typename?: 'workoutSessionSets', id: any } | null };

export type InsertWorkoutSessionCardioEntryMutationVariables = Exact<{
  obj: WorkoutSessionCardioEntries_Insert_Input;
}>;


export type InsertWorkoutSessionCardioEntryMutation = { __typename?: 'mutation_root', insertWorkoutSessionCardioEntry?: { __typename?: 'workoutSessionCardioEntries', id: any } | null };

export type UpdateWorkoutSessionCardioEntryMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
  set: WorkoutSessionCardioEntries_Set_Input;
}>;


export type UpdateWorkoutSessionCardioEntryMutation = { __typename?: 'mutation_root', updateWorkoutSessionCardioEntry?: { __typename?: 'workoutSessionCardioEntries', id: any } | null };

export type DeleteWorkoutSessionCardioEntryMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type DeleteWorkoutSessionCardioEntryMutation = { __typename?: 'mutation_root', deleteWorkoutSessionCardioEntry?: { __typename?: 'workoutSessionCardioEntries', id: any } | null };

export type UpdateSessionStartedAtMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
  startedAt: Scalars['timestamptz']['input'];
}>;


export type UpdateSessionStartedAtMutation = { __typename?: 'mutation_root', updateWorkoutSession?: { __typename?: 'workoutSessions', id: any } | null };

export type DeleteWorkoutSessionMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type DeleteWorkoutSessionMutation = { __typename?: 'mutation_root', deleteWorkoutSession?: { __typename?: 'workoutSessions', id: any } | null };

export type InsertWorkoutSessionExercisesMutationVariables = Exact<{
  objs: Array<WorkoutSessionExercises_Insert_Input> | WorkoutSessionExercises_Insert_Input;
}>;


export type InsertWorkoutSessionExercisesMutation = { __typename?: 'mutation_root', insertWorkoutSessionExercises?: { __typename?: 'workoutSessionExercises_mutation_response', affected_rows: number } | null };

export type DeleteWorkoutSessionExerciseMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type DeleteWorkoutSessionExerciseMutation = { __typename?: 'mutation_root', deleteWorkoutSessionExercise?: { __typename?: 'workoutSessionExercises', id: any } | null };

export type SessionsIndexQueryVariables = Exact<{
  limit: Scalars['Int']['input'];
  offset: Scalars['Int']['input'];
}>;


export type SessionsIndexQuery = { __typename?: 'query_root', workoutSessions: Array<{ __typename?: 'workoutSessions', id: any, startedAt: any, workout?: { __typename?: 'workouts', id: any, name: string } | null, workoutSessionExercises_aggregate: { __typename?: 'workoutSessionExercises_aggregate', aggregate?: { __typename?: 'workoutSessionExercises_aggregate_fields', count: number } | null }, workoutSessionExercises: Array<{ __typename?: 'workoutSessionExercises', exercise: { __typename?: 'exercises', id: any, name: string }, workoutSessionSets_aggregate: { __typename?: 'workoutSessionSets_aggregate', aggregate?: { __typename?: 'workoutSessionSets_aggregate_fields', count: number, sum?: { __typename?: 'workoutSessionSets_sum_fields', reps?: number | null } | null } | null }, workoutSessionCardioEntries_aggregate: { __typename?: 'workoutSessionCardioEntries_aggregate', aggregate?: { __typename?: 'workoutSessionCardioEntries_aggregate_fields', count: number } | null } }> }> };

export type WorkoutDetailQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type WorkoutDetailQuery = { __typename?: 'query_root', workout?: { __typename?: 'workouts', id: any, name: string, description?: string | null, isPublic: boolean, userId?: any | null, workoutExercises: Array<{ __typename?: 'workoutExercises', id: any, position: number, exercise: { __typename?: 'exercises', id: any, name: string, doubleWeight: boolean, primaryMuscleGroup: MuscleGroups_Enum, image1FileId?: any | null, image2FileId?: any | null } }>, workoutLabels: Array<{ __typename?: 'workoutLabels', labelId: any, label: { __typename?: 'labels', id: any, name: string } }> } | null };

export type EditWorkoutQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type EditWorkoutQuery = { __typename?: 'query_root', workout?: { __typename?: 'workouts', id: any, name: string, description?: string | null, isPublic: boolean, userId?: any | null, workoutExercises: Array<{ __typename?: 'workoutExercises', id: any, position: number, exercise: { __typename?: 'exercises', id: any, name: string, primaryMuscleGroup: MuscleGroups_Enum, doubleWeight: boolean } }>, workoutLabels: Array<{ __typename?: 'workoutLabels', labelId: any, label: { __typename?: 'labels', id: any, name: string } }> } | null, labels: Array<{ __typename?: 'labels', id: any, name: string }> };

export type SaveWorkoutMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
  set: Workouts_Set_Input;
  deleteRowIds: Array<Scalars['uuid']['input']> | Scalars['uuid']['input'];
  insertRows: Array<WorkoutExercises_Insert_Input> | WorkoutExercises_Insert_Input;
  positionUpdates: Array<WorkoutExercises_Updates> | WorkoutExercises_Updates;
  deleteLabelIds: Array<Scalars['uuid']['input']> | Scalars['uuid']['input'];
  insertLabels: Array<WorkoutLabels_Insert_Input> | WorkoutLabels_Insert_Input;
}>;


export type SaveWorkoutMutation = { __typename?: 'mutation_root', updateWorkout?: { __typename?: 'workouts', id: any } | null, deleteWorkoutExercises?: { __typename?: 'workoutExercises_mutation_response', affected_rows: number } | null, insertWorkoutExercises?: { __typename?: 'workoutExercises_mutation_response', affected_rows: number } | null, update_workoutExercises_many?: Array<{ __typename?: 'workoutExercises_mutation_response', affected_rows: number } | null> | null, deleteWorkoutLabels?: { __typename?: 'workoutLabels_mutation_response', affected_rows: number } | null, insertWorkoutLabels?: { __typename?: 'workoutLabels_mutation_response', affected_rows: number } | null };

export type DeleteWorkoutMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type DeleteWorkoutMutation = { __typename?: 'mutation_root', deleteWorkout?: { __typename?: 'workouts', id: any } | null };

export type WorkoutsIndexQueryVariables = Exact<{ [key: string]: never; }>;


export type WorkoutsIndexQuery = { __typename?: 'query_root', workouts: Array<{ __typename?: 'workouts', id: any, name: string, description?: string | null, isPublic: boolean, workoutExercises_aggregate: { __typename?: 'workoutExercises_aggregate', aggregate?: { __typename?: 'workoutExercises_aggregate_fields', count: number } | null }, workoutLabels: Array<{ __typename?: 'workoutLabels', labelId: any, label: { __typename?: 'labels', id: any, name: string } }> }>, labels: Array<{ __typename?: 'labels', id: any, name: string }> };

export type NewWorkoutLabelsQueryVariables = Exact<{ [key: string]: never; }>;


export type NewWorkoutLabelsQuery = { __typename?: 'query_root', labels: Array<{ __typename?: 'labels', id: any, name: string }> };

export type CreateWorkoutMutationVariables = Exact<{
  obj: Workouts_Insert_Input;
}>;


export type CreateWorkoutMutation = { __typename?: 'mutation_root', insertWorkout?: { __typename?: 'workouts', id: any } | null };


export const BreadcrumbWorkoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BreadcrumbWorkout"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"workout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<BreadcrumbWorkoutQuery, BreadcrumbWorkoutQueryVariables>;
export const BreadcrumbExerciseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BreadcrumbExercise"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exercise"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<BreadcrumbExerciseQuery, BreadcrumbExerciseQueryVariables>;
export const BreadcrumbSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BreadcrumbSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"workoutSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"workout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<BreadcrumbSessionQuery, BreadcrumbSessionQueryVariables>;
export const BreadcrumbBodyMeasurementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BreadcrumbBodyMeasurement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"bodyMeasurement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"measuredOn"}}]}}]}}]} as unknown as DocumentNode<BreadcrumbBodyMeasurementQuery, BreadcrumbBodyMeasurementQueryVariables>;
export const BreadcrumbJournalEntryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BreadcrumbJournalEntry"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"journalEntry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"entryDate"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]} as unknown as DocumentNode<BreadcrumbJournalEntryQuery, BreadcrumbJournalEntryQueryVariables>;
export const ExerciseDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExerciseDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exercise"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"instructions"}},{"kind":"Field","name":{"kind":"Name","value":"image1FileId"}},{"kind":"Field","name":{"kind":"Name","value":"image2FileId"}},{"kind":"Field","name":{"kind":"Name","value":"doubleWeight"}},{"kind":"Field","name":{"kind":"Name","value":"level"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"equipment"}},{"kind":"Field","name":{"kind":"Name","value":"force"}},{"kind":"Field","name":{"kind":"Name","value":"mechanic"}},{"kind":"Field","name":{"kind":"Name","value":"primaryMuscleGroup"}},{"kind":"Field","name":{"kind":"Name","value":"metricsSchema"}},{"kind":"Field","name":{"kind":"Name","value":"secondaryMuscleGroups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"muscleGroup"}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionExercises"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"workoutSession"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"workout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionSets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"setNumber"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"setNumber"}},{"kind":"Field","name":{"kind":"Name","value":"reps"}},{"kind":"Field","name":{"kind":"Name","value":"weight"}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionCardioEntries"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"entryNumber"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"entryNumber"}},{"kind":"Field","name":{"kind":"Name","value":"metrics"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ExerciseDetailQuery, ExerciseDetailQueryVariables>;
export const ExercisePickerExercisesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExercisePickerExercises"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exercises"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"primaryMuscleGroup"}},{"kind":"Field","name":{"kind":"Name","value":"doubleWeight"}}]}}]}}]} as unknown as DocumentNode<ExercisePickerExercisesQuery, ExercisePickerExercisesQueryVariables>;
export const StartSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"obj"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"workoutSessions_insert_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insertWorkoutSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"obj"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<StartSessionMutation, StartSessionMutationVariables>;
export const BodyMeasurementByIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BodyMeasurementById"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"bodyMeasurement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"measuredOn"}},{"kind":"Field","name":{"kind":"Name","value":"weightKg"}},{"kind":"Field","name":{"kind":"Name","value":"bodyFatPct"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<BodyMeasurementByIdQuery, BodyMeasurementByIdQueryVariables>;
export const EditBodyMeasurementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EditBodyMeasurement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"bodyMeasurement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"measuredOn"}},{"kind":"Field","name":{"kind":"Name","value":"weightKg"}},{"kind":"Field","name":{"kind":"Name","value":"bodyFatPct"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}}]}}]}}]} as unknown as DocumentNode<EditBodyMeasurementQuery, EditBodyMeasurementQueryVariables>;
export const UpdateBodyMeasurementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateBodyMeasurement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"bodyMeasurements_set_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateBodyMeasurement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UpdateBodyMeasurementMutation, UpdateBodyMeasurementMutationVariables>;
export const DeleteBodyMeasurementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteBodyMeasurement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteBodyMeasurement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteBodyMeasurementMutation, DeleteBodyMeasurementMutationVariables>;
export const BodyMeasurementsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BodyMeasurements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"bodyMeasurements"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"measuredOn"},"value":{"kind":"EnumValue","value":"desc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"measuredOn"}},{"kind":"Field","name":{"kind":"Name","value":"weightKg"}},{"kind":"Field","name":{"kind":"Name","value":"bodyFatPct"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}}]}}]}}]} as unknown as DocumentNode<BodyMeasurementsQuery, BodyMeasurementsQueryVariables>;
export const InsertBodyMeasurementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InsertBodyMeasurement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"obj"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"bodyMeasurements_insert_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insertBodyMeasurement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"obj"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<InsertBodyMeasurementMutation, InsertBodyMeasurementMutationVariables>;
export const ExercisesIndexDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExercisesIndex"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exercises"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"doubleWeight"}},{"kind":"Field","name":{"kind":"Name","value":"primaryMuscleGroup"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"equipment"}},{"kind":"Field","name":{"kind":"Name","value":"level"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"secondaryMuscleGroups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"muscleGroup"}}]}}]}}]}}]} as unknown as DocumentNode<ExercisesIndexQuery, ExercisesIndexQueryVariables>;
export const JournalEntryByIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"JournalEntryById"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"journalEntry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"entryDate"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"journalEntryLabels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"labelId"}},{"kind":"Field","name":{"kind":"Name","value":"label"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<JournalEntryByIdQuery, JournalEntryByIdQueryVariables>;
export const EditJournalEntryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EditJournalEntry"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"journalEntry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"entryDate"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"journalEntryLabels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"labelId"}},{"kind":"Field","name":{"kind":"Name","value":"label"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"journalLabels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<EditJournalEntryQuery, EditJournalEntryQueryVariables>;
export const SaveJournalEntryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveJournalEntry"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"journalEntries_set_input"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"deleteLabelIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"insertLabels"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"journalEntryLabels_insert_input"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateJournalEntry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"deleteJournalEntryLabels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"journalEntryId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"labelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_in"},"value":{"kind":"Variable","name":{"kind":"Name","value":"deleteLabelIds"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}},{"kind":"Field","name":{"kind":"Name","value":"insertJournalEntryLabels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"objects"},"value":{"kind":"Variable","name":{"kind":"Name","value":"insertLabels"}}},{"kind":"Argument","name":{"kind":"Name","value":"on_conflict"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"constraint"},"value":{"kind":"EnumValue","value":"journal_entry_labels_pkey"}},{"kind":"ObjectField","name":{"kind":"Name","value":"update_columns"},"value":{"kind":"ListValue","values":[]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}}]}}]} as unknown as DocumentNode<SaveJournalEntryMutation, SaveJournalEntryMutationVariables>;
export const DeleteJournalEntryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteJournalEntry"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteJournalEntry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteJournalEntryMutation, DeleteJournalEntryMutationVariables>;
export const JournalEntriesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"JournalEntries"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"where"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"journalEntries_bool_exp"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"journalEntries"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"Variable","name":{"kind":"Name","value":"where"}}},{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"entryDate"},"value":{"kind":"EnumValue","value":"desc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"createdAt"},"value":{"kind":"EnumValue","value":"desc"}}]}]}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"entryDate"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"journalEntryLabels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"labelId"}},{"kind":"Field","name":{"kind":"Name","value":"label"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<JournalEntriesQuery, JournalEntriesQueryVariables>;
export const JournalLabelsFilterDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"JournalLabelsFilter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"journalLabels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<JournalLabelsFilterQuery, JournalLabelsFilterQueryVariables>;
export const JournalLabelsForFormDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"JournalLabelsForForm"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"journalLabels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<JournalLabelsForFormQuery, JournalLabelsForFormQueryVariables>;
export const InsertJournalEntryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InsertJournalEntry"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"obj"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"journalEntries_insert_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insertJournalEntry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"obj"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<InsertJournalEntryMutation, InsertJournalEntryMutationVariables>;
export const SessionDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SessionDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"workoutSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"workout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionExercises"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"exercise"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"doubleWeight"}},{"kind":"Field","name":{"kind":"Name","value":"primaryMuscleGroup"}},{"kind":"Field","name":{"kind":"Name","value":"image1FileId"}},{"kind":"Field","name":{"kind":"Name","value":"image2FileId"}},{"kind":"Field","name":{"kind":"Name","value":"metricsSchema"}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionSets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"setNumber"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"setNumber"}},{"kind":"Field","name":{"kind":"Name","value":"reps"}},{"kind":"Field","name":{"kind":"Name","value":"weight"}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionCardioEntries"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"entryNumber"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"entryNumber"}},{"kind":"Field","name":{"kind":"Name","value":"metrics"}}]}}]}}]}}]}}]} as unknown as DocumentNode<SessionDetailQuery, SessionDetailQueryVariables>;
export const PriorSessionsPerExerciseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PriorSessionsPerExercise"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"exerciseIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"excludeSessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exercises"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_in"},"value":{"kind":"Variable","name":{"kind":"Name","value":"exerciseIds"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionExercises"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"3"}},{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"workoutSession"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startedAt"},"value":{"kind":"EnumValue","value":"desc"}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"workoutSessionId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_neq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"excludeSessionId"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"workoutSession"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionSets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"setNumber"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"setNumber"}},{"kind":"Field","name":{"kind":"Name","value":"reps"}},{"kind":"Field","name":{"kind":"Name","value":"weight"}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionCardioEntries"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"entryNumber"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"entryNumber"}},{"kind":"Field","name":{"kind":"Name","value":"metrics"}}]}}]}}]}}]}}]} as unknown as DocumentNode<PriorSessionsPerExerciseQuery, PriorSessionsPerExerciseQueryVariables>;
export const InsertWorkoutSessionSetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InsertWorkoutSessionSet"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"obj"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"workoutSessionSets_insert_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insertWorkoutSessionSet"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"obj"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<InsertWorkoutSessionSetMutation, InsertWorkoutSessionSetMutationVariables>;
export const UpdateWorkoutSessionSetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateWorkoutSessionSet"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"workoutSessionSets_set_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateWorkoutSessionSet"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UpdateWorkoutSessionSetMutation, UpdateWorkoutSessionSetMutationVariables>;
export const DeleteWorkoutSessionSetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteWorkoutSessionSet"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteWorkoutSessionSet"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteWorkoutSessionSetMutation, DeleteWorkoutSessionSetMutationVariables>;
export const InsertWorkoutSessionCardioEntryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InsertWorkoutSessionCardioEntry"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"obj"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"workoutSessionCardioEntries_insert_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insertWorkoutSessionCardioEntry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"obj"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<InsertWorkoutSessionCardioEntryMutation, InsertWorkoutSessionCardioEntryMutationVariables>;
export const UpdateWorkoutSessionCardioEntryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateWorkoutSessionCardioEntry"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"workoutSessionCardioEntries_set_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateWorkoutSessionCardioEntry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UpdateWorkoutSessionCardioEntryMutation, UpdateWorkoutSessionCardioEntryMutationVariables>;
export const DeleteWorkoutSessionCardioEntryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteWorkoutSessionCardioEntry"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteWorkoutSessionCardioEntry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteWorkoutSessionCardioEntryMutation, DeleteWorkoutSessionCardioEntryMutationVariables>;
export const UpdateSessionStartedAtDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateSessionStartedAt"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"startedAt"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"timestamptz"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateWorkoutSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startedAt"},"value":{"kind":"Variable","name":{"kind":"Name","value":"startedAt"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UpdateSessionStartedAtMutation, UpdateSessionStartedAtMutationVariables>;
export const DeleteWorkoutSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteWorkoutSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteWorkoutSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteWorkoutSessionMutation, DeleteWorkoutSessionMutationVariables>;
export const InsertWorkoutSessionExercisesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InsertWorkoutSessionExercises"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"objs"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"workoutSessionExercises_insert_input"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insertWorkoutSessionExercises"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"objects"},"value":{"kind":"Variable","name":{"kind":"Name","value":"objs"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}}]}}]} as unknown as DocumentNode<InsertWorkoutSessionExercisesMutation, InsertWorkoutSessionExercisesMutationVariables>;
export const DeleteWorkoutSessionExerciseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteWorkoutSessionExercise"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteWorkoutSessionExercise"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteWorkoutSessionExerciseMutation, DeleteWorkoutSessionExerciseMutationVariables>;
export const SessionsIndexDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SessionsIndex"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"workoutSessions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startedAt"},"value":{"kind":"EnumValue","value":"desc"}}]}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"workout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionExercises_aggregate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionExercises"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exercise"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionSets_aggregate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"sum"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reps"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionCardioEntries_aggregate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<SessionsIndexQuery, SessionsIndexQueryVariables>;
export const WorkoutDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"WorkoutDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"workout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"workoutExercises"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"exercise"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"doubleWeight"}},{"kind":"Field","name":{"kind":"Name","value":"primaryMuscleGroup"}},{"kind":"Field","name":{"kind":"Name","value":"image1FileId"}},{"kind":"Field","name":{"kind":"Name","value":"image2FileId"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutLabels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"labelId"}},{"kind":"Field","name":{"kind":"Name","value":"label"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<WorkoutDetailQuery, WorkoutDetailQueryVariables>;
export const EditWorkoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EditWorkout"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"workout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"workoutExercises"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"exercise"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"primaryMuscleGroup"}},{"kind":"Field","name":{"kind":"Name","value":"doubleWeight"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutLabels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"labelId"}},{"kind":"Field","name":{"kind":"Name","value":"label"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<EditWorkoutQuery, EditWorkoutQueryVariables>;
export const SaveWorkoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveWorkout"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"workouts_set_input"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"deleteRowIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"insertRows"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"workoutExercises_insert_input"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"positionUpdates"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"workoutExercises_updates"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"deleteLabelIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"insertLabels"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"workoutLabels_insert_input"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateWorkout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"deleteWorkoutExercises"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_in"},"value":{"kind":"Variable","name":{"kind":"Name","value":"deleteRowIds"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}},{"kind":"Field","name":{"kind":"Name","value":"insertWorkoutExercises"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"objects"},"value":{"kind":"Variable","name":{"kind":"Name","value":"insertRows"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}},{"kind":"Field","name":{"kind":"Name","value":"update_workoutExercises_many"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"updates"},"value":{"kind":"Variable","name":{"kind":"Name","value":"positionUpdates"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}},{"kind":"Field","name":{"kind":"Name","value":"deleteWorkoutLabels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"workoutId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"labelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_in"},"value":{"kind":"Variable","name":{"kind":"Name","value":"deleteLabelIds"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}},{"kind":"Field","name":{"kind":"Name","value":"insertWorkoutLabels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"objects"},"value":{"kind":"Variable","name":{"kind":"Name","value":"insertLabels"}}},{"kind":"Argument","name":{"kind":"Name","value":"on_conflict"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"constraint"},"value":{"kind":"EnumValue","value":"workout_labels_pkey"}},{"kind":"ObjectField","name":{"kind":"Name","value":"update_columns"},"value":{"kind":"ListValue","values":[]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}}]}}]} as unknown as DocumentNode<SaveWorkoutMutation, SaveWorkoutMutationVariables>;
export const DeleteWorkoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteWorkout"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteWorkout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteWorkoutMutation, DeleteWorkoutMutationVariables>;
export const WorkoutsIndexDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"WorkoutsIndex"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"workouts"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isPublic"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"workoutExercises_aggregate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutLabels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"labelId"}},{"kind":"Field","name":{"kind":"Name","value":"label"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<WorkoutsIndexQuery, WorkoutsIndexQueryVariables>;
export const NewWorkoutLabelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"NewWorkoutLabels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"labels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<NewWorkoutLabelsQuery, NewWorkoutLabelsQueryVariables>;
export const CreateWorkoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateWorkout"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"obj"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"workouts_insert_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insertWorkout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"obj"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreateWorkoutMutation, CreateWorkoutMutationVariables>;