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
  time: { input: any; output: any; }
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
  /** unique or primary key constraint on columns "user_id", "measured_on" */
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

/** columns and relationships of "daily_energy" */
export type DailyEnergy = {
  __typename?: 'dailyEnergy';
  activeKcal?: Maybe<Scalars['numeric']['output']>;
  createdAt: Scalars['timestamptz']['output'];
  energyOn: Scalars['date']['output'];
  id: Scalars['uuid']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  restingKcal?: Maybe<Scalars['numeric']['output']>;
  updatedAt: Scalars['timestamptz']['output'];
  userId: Scalars['uuid']['output'];
};

/** aggregated selection of "daily_energy" */
export type DailyEnergy_Aggregate = {
  __typename?: 'dailyEnergy_aggregate';
  aggregate?: Maybe<DailyEnergy_Aggregate_Fields>;
  nodes: Array<DailyEnergy>;
};

/** aggregate fields of "daily_energy" */
export type DailyEnergy_Aggregate_Fields = {
  __typename?: 'dailyEnergy_aggregate_fields';
  avg?: Maybe<DailyEnergy_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<DailyEnergy_Max_Fields>;
  min?: Maybe<DailyEnergy_Min_Fields>;
  stddev?: Maybe<DailyEnergy_Stddev_Fields>;
  stddev_pop?: Maybe<DailyEnergy_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<DailyEnergy_Stddev_Samp_Fields>;
  sum?: Maybe<DailyEnergy_Sum_Fields>;
  var_pop?: Maybe<DailyEnergy_Var_Pop_Fields>;
  var_samp?: Maybe<DailyEnergy_Var_Samp_Fields>;
  variance?: Maybe<DailyEnergy_Variance_Fields>;
};


/** aggregate fields of "daily_energy" */
export type DailyEnergy_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<DailyEnergy_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate avg on columns */
export type DailyEnergy_Avg_Fields = {
  __typename?: 'dailyEnergy_avg_fields';
  activeKcal?: Maybe<Scalars['Float']['output']>;
  restingKcal?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "daily_energy". All fields are combined with a logical 'AND'. */
export type DailyEnergy_Bool_Exp = {
  _and?: InputMaybe<Array<DailyEnergy_Bool_Exp>>;
  _not?: InputMaybe<DailyEnergy_Bool_Exp>;
  _or?: InputMaybe<Array<DailyEnergy_Bool_Exp>>;
  activeKcal?: InputMaybe<Numeric_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  energyOn?: InputMaybe<Date_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  notes?: InputMaybe<String_Comparison_Exp>;
  restingKcal?: InputMaybe<Numeric_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  userId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "daily_energy" */
export enum DailyEnergy_Constraint {
  /** unique or primary key constraint on columns "id" */
  DailyEnergyPkey = 'daily_energy_pkey',
  /** unique or primary key constraint on columns "user_id", "energy_on" */
  DailyEnergyUserDateKey = 'daily_energy_user_date_key'
}

/** input type for incrementing numeric columns in table "daily_energy" */
export type DailyEnergy_Inc_Input = {
  activeKcal?: InputMaybe<Scalars['numeric']['input']>;
  restingKcal?: InputMaybe<Scalars['numeric']['input']>;
};

/** input type for inserting data into table "daily_energy" */
export type DailyEnergy_Insert_Input = {
  activeKcal?: InputMaybe<Scalars['numeric']['input']>;
  energyOn?: InputMaybe<Scalars['date']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  restingKcal?: InputMaybe<Scalars['numeric']['input']>;
};

/** aggregate max on columns */
export type DailyEnergy_Max_Fields = {
  __typename?: 'dailyEnergy_max_fields';
  activeKcal?: Maybe<Scalars['numeric']['output']>;
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  energyOn?: Maybe<Scalars['date']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  restingKcal?: Maybe<Scalars['numeric']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
};

/** aggregate min on columns */
export type DailyEnergy_Min_Fields = {
  __typename?: 'dailyEnergy_min_fields';
  activeKcal?: Maybe<Scalars['numeric']['output']>;
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  energyOn?: Maybe<Scalars['date']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  notes?: Maybe<Scalars['String']['output']>;
  restingKcal?: Maybe<Scalars['numeric']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
};

/** response of any mutation on the table "daily_energy" */
export type DailyEnergy_Mutation_Response = {
  __typename?: 'dailyEnergy_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<DailyEnergy>;
};

/** on_conflict condition type for table "daily_energy" */
export type DailyEnergy_On_Conflict = {
  constraint: DailyEnergy_Constraint;
  update_columns?: Array<DailyEnergy_Update_Column>;
  where?: InputMaybe<DailyEnergy_Bool_Exp>;
};

/** Ordering options when selecting data from "daily_energy". */
export type DailyEnergy_Order_By = {
  activeKcal?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  energyOn?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  notes?: InputMaybe<Order_By>;
  restingKcal?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: daily_energy */
export type DailyEnergy_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "daily_energy" */
export enum DailyEnergy_Select_Column {
  /** column name */
  ActiveKcal = 'activeKcal',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  EnergyOn = 'energyOn',
  /** column name */
  Id = 'id',
  /** column name */
  Notes = 'notes',
  /** column name */
  RestingKcal = 'restingKcal',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UserId = 'userId'
}

/** input type for updating data in table "daily_energy" */
export type DailyEnergy_Set_Input = {
  activeKcal?: InputMaybe<Scalars['numeric']['input']>;
  energyOn?: InputMaybe<Scalars['date']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  restingKcal?: InputMaybe<Scalars['numeric']['input']>;
};

/** aggregate stddev on columns */
export type DailyEnergy_Stddev_Fields = {
  __typename?: 'dailyEnergy_stddev_fields';
  activeKcal?: Maybe<Scalars['Float']['output']>;
  restingKcal?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type DailyEnergy_Stddev_Pop_Fields = {
  __typename?: 'dailyEnergy_stddev_pop_fields';
  activeKcal?: Maybe<Scalars['Float']['output']>;
  restingKcal?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type DailyEnergy_Stddev_Samp_Fields = {
  __typename?: 'dailyEnergy_stddev_samp_fields';
  activeKcal?: Maybe<Scalars['Float']['output']>;
  restingKcal?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "dailyEnergy" */
export type DailyEnergy_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: DailyEnergy_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type DailyEnergy_Stream_Cursor_Value_Input = {
  activeKcal?: InputMaybe<Scalars['numeric']['input']>;
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  energyOn?: InputMaybe<Scalars['date']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  notes?: InputMaybe<Scalars['String']['input']>;
  restingKcal?: InputMaybe<Scalars['numeric']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
  userId?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate sum on columns */
export type DailyEnergy_Sum_Fields = {
  __typename?: 'dailyEnergy_sum_fields';
  activeKcal?: Maybe<Scalars['numeric']['output']>;
  restingKcal?: Maybe<Scalars['numeric']['output']>;
};

/** update columns of table "daily_energy" */
export enum DailyEnergy_Update_Column {
  /** column name */
  ActiveKcal = 'activeKcal',
  /** column name */
  EnergyOn = 'energyOn',
  /** column name */
  Notes = 'notes',
  /** column name */
  RestingKcal = 'restingKcal'
}

export type DailyEnergy_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<DailyEnergy_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<DailyEnergy_Set_Input>;
  /** filter the rows which have to be updated */
  where: DailyEnergy_Bool_Exp;
};

/** aggregate var_pop on columns */
export type DailyEnergy_Var_Pop_Fields = {
  __typename?: 'dailyEnergy_var_pop_fields';
  activeKcal?: Maybe<Scalars['Float']['output']>;
  restingKcal?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type DailyEnergy_Var_Samp_Fields = {
  __typename?: 'dailyEnergy_var_samp_fields';
  activeKcal?: Maybe<Scalars['Float']['output']>;
  restingKcal?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type DailyEnergy_Variance_Fields = {
  __typename?: 'dailyEnergy_variance_fields';
  activeKcal?: Maybe<Scalars['Float']['output']>;
  restingKcal?: Maybe<Scalars['Float']['output']>;
};

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
  exercisesStrength: Array<ExercisesStrength>;
  /** An aggregate relationship */
  exercisesStrength_aggregate: ExercisesStrength_Aggregate;
  value: Scalars['String']['output'];
};


/** columns and relationships of "exercise_forces" */
export type ExerciseForcesExercisesStrengthArgs = {
  distinct_on?: InputMaybe<Array<ExercisesStrength_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExercisesStrength_Order_By>>;
  where?: InputMaybe<ExercisesStrength_Bool_Exp>;
};


/** columns and relationships of "exercise_forces" */
export type ExerciseForcesExercisesStrength_AggregateArgs = {
  distinct_on?: InputMaybe<Array<ExercisesStrength_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExercisesStrength_Order_By>>;
  where?: InputMaybe<ExercisesStrength_Bool_Exp>;
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
  exercisesStrength?: InputMaybe<ExercisesStrength_Bool_Exp>;
  exercisesStrength_aggregate?: InputMaybe<ExercisesStrength_Aggregate_Bool_Exp>;
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
  exercisesStrength_aggregate?: InputMaybe<ExercisesStrength_Aggregate_Order_By>;
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
  exercisesStrength: Array<ExercisesStrength>;
  /** An aggregate relationship */
  exercisesStrength_aggregate: ExercisesStrength_Aggregate;
  value: Scalars['String']['output'];
};


/** columns and relationships of "exercise_mechanics" */
export type ExerciseMechanicsExercisesStrengthArgs = {
  distinct_on?: InputMaybe<Array<ExercisesStrength_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExercisesStrength_Order_By>>;
  where?: InputMaybe<ExercisesStrength_Bool_Exp>;
};


/** columns and relationships of "exercise_mechanics" */
export type ExerciseMechanicsExercisesStrength_AggregateArgs = {
  distinct_on?: InputMaybe<Array<ExercisesStrength_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExercisesStrength_Order_By>>;
  where?: InputMaybe<ExercisesStrength_Bool_Exp>;
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
  exercisesStrength?: InputMaybe<ExercisesStrength_Bool_Exp>;
  exercisesStrength_aggregate?: InputMaybe<ExercisesStrength_Aggregate_Bool_Exp>;
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
  exercisesStrength_aggregate?: InputMaybe<ExercisesStrength_Aggregate_Order_By>;
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
  /** An object relationship */
  cardio?: Maybe<ExercisesCardio>;
  category: ExerciseCategories_Enum;
  createdAt: Scalars['timestamptz']['output'];
  equipment?: Maybe<ExerciseEquipments_Enum>;
  id: Scalars['uuid']['output'];
  /** An object relationship */
  image1?: Maybe<Files>;
  image1FileId?: Maybe<Scalars['uuid']['output']>;
  /** An object relationship */
  image2?: Maybe<Files>;
  image2FileId?: Maybe<Scalars['uuid']['output']>;
  instructions: Array<Scalars['String']['output']>;
  isPublic: Scalars['Boolean']['output'];
  /** GENERATED STORED discriminator derived from category ('cardio' iff category='cardio', else 'strength'). Read-only — set indirectly via category. Used as the FK target alongside id for child tables (workout_exercises, workout_session_exercises, exercises_strength, exercises_cardio), making the strength/cardio split structural rather than trigger-based. */
  kind?: Maybe<Scalars['String']['output']>;
  level?: Maybe<ExerciseLevels_Enum>;
  name: Scalars['String']['output'];
  primaryMuscleGroup: MuscleGroups_Enum;
  /** An array relationship */
  secondaryMuscleGroups: Array<ExerciseSecondaryMuscleGroups>;
  /** An aggregate relationship */
  secondaryMuscleGroups_aggregate: ExerciseSecondaryMuscleGroups_Aggregate;
  slug?: Maybe<Scalars['String']['output']>;
  /** An object relationship */
  strength?: Maybe<ExercisesStrength>;
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

/** Sidecar for cardio exercises (class-table inheritance with exercises): carries the per-exercise JSON Schema in metrics_schema. exercises_cardio.kind is pinned to 'cardio' (added in migration 1790000440000) and composite-FKs to exercises(id, kind), making the strength/cardio split structural. Lifecycle is atomic: every cardio exercise must have a matching row at commit time (exercise_must_have_sidecar trigger), and this row cannot be deleted standalone (sidecar_delete_requires_parent_delete trigger). */
export type ExercisesCardio = {
  __typename?: 'exercisesCardio';
  createdAt: Scalars['timestamptz']['output'];
  /** An object relationship */
  exercise: Exercises;
  exerciseId: Scalars['uuid']['output'];
  /** Pinned to 'cardio' via DEFAULT + CHECK. Forms a composite FK with exercise_id targeting exercises(id, kind), so this row can only attach to a cardio exercise — a category flip on the parent that would change exercises.kind cascades into here and the pinned CHECK rolls back the transaction. Added in this migration to close the asymmetry with exercises_strength. */
  kind: Scalars['String']['output'];
  /** JSON Schema describing the per-entry metrics shape for this cardio exercise. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  metricsSchema: Scalars['jsonb']['output'];
  updatedAt: Scalars['timestamptz']['output'];
};


/** Sidecar for cardio exercises (class-table inheritance with exercises): carries the per-exercise JSON Schema in metrics_schema. exercises_cardio.kind is pinned to 'cardio' (added in migration 1790000440000) and composite-FKs to exercises(id, kind), making the strength/cardio split structural. Lifecycle is atomic: every cardio exercise must have a matching row at commit time (exercise_must_have_sidecar trigger), and this row cannot be deleted standalone (sidecar_delete_requires_parent_delete trigger). */
export type ExercisesCardioMetricsSchemaArgs = {
  path?: InputMaybe<Scalars['String']['input']>;
};

/** aggregated selection of "exercises_cardio" */
export type ExercisesCardio_Aggregate = {
  __typename?: 'exercisesCardio_aggregate';
  aggregate?: Maybe<ExercisesCardio_Aggregate_Fields>;
  nodes: Array<ExercisesCardio>;
};

/** aggregate fields of "exercises_cardio" */
export type ExercisesCardio_Aggregate_Fields = {
  __typename?: 'exercisesCardio_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<ExercisesCardio_Max_Fields>;
  min?: Maybe<ExercisesCardio_Min_Fields>;
};


/** aggregate fields of "exercises_cardio" */
export type ExercisesCardio_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<ExercisesCardio_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** append existing jsonb value of filtered columns with new jsonb value */
export type ExercisesCardio_Append_Input = {
  /** JSON Schema describing the per-entry metrics shape for this cardio exercise. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  metricsSchema?: InputMaybe<Scalars['jsonb']['input']>;
};

/** Boolean expression to filter rows from the table "exercises_cardio". All fields are combined with a logical 'AND'. */
export type ExercisesCardio_Bool_Exp = {
  _and?: InputMaybe<Array<ExercisesCardio_Bool_Exp>>;
  _not?: InputMaybe<ExercisesCardio_Bool_Exp>;
  _or?: InputMaybe<Array<ExercisesCardio_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  exercise?: InputMaybe<Exercises_Bool_Exp>;
  exerciseId?: InputMaybe<Uuid_Comparison_Exp>;
  /** Pinned to 'cardio' via DEFAULT + CHECK. Forms a composite FK with exercise_id targeting exercises(id, kind), so this row can only attach to a cardio exercise — a category flip on the parent that would change exercises.kind cascades into here and the pinned CHECK rolls back the transaction. Added in this migration to close the asymmetry with exercises_strength. */
  kind?: InputMaybe<String_Comparison_Exp>;
  /** JSON Schema describing the per-entry metrics shape for this cardio exercise. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  metricsSchema?: InputMaybe<Jsonb_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "exercises_cardio" */
export enum ExercisesCardio_Constraint {
  /** unique or primary key constraint on columns "exercise_id" */
  ExercisesCardioPkey = 'exercises_cardio_pkey'
}

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type ExercisesCardio_Delete_At_Path_Input = {
  /** JSON Schema describing the per-entry metrics shape for this cardio exercise. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  metricsSchema?: InputMaybe<Array<Scalars['String']['input']>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type ExercisesCardio_Delete_Elem_Input = {
  /** JSON Schema describing the per-entry metrics shape for this cardio exercise. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  metricsSchema?: InputMaybe<Scalars['Int']['input']>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type ExercisesCardio_Delete_Key_Input = {
  /** JSON Schema describing the per-entry metrics shape for this cardio exercise. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  metricsSchema?: InputMaybe<Scalars['String']['input']>;
};

/** input type for inserting data into table "exercises_cardio" */
export type ExercisesCardio_Insert_Input = {
  exercise?: InputMaybe<Exercises_Obj_Rel_Insert_Input>;
  exerciseId?: InputMaybe<Scalars['uuid']['input']>;
  /** JSON Schema describing the per-entry metrics shape for this cardio exercise. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  metricsSchema?: InputMaybe<Scalars['jsonb']['input']>;
};

/** aggregate max on columns */
export type ExercisesCardio_Max_Fields = {
  __typename?: 'exercisesCardio_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  exerciseId?: Maybe<Scalars['uuid']['output']>;
  /** Pinned to 'cardio' via DEFAULT + CHECK. Forms a composite FK with exercise_id targeting exercises(id, kind), so this row can only attach to a cardio exercise — a category flip on the parent that would change exercises.kind cascades into here and the pinned CHECK rolls back the transaction. Added in this migration to close the asymmetry with exercises_strength. */
  kind?: Maybe<Scalars['String']['output']>;
  /** JSON Schema describing the per-entry metrics shape for this cardio exercise. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  metricsSchema?: Maybe<Scalars['jsonb']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
};

/** aggregate min on columns */
export type ExercisesCardio_Min_Fields = {
  __typename?: 'exercisesCardio_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  exerciseId?: Maybe<Scalars['uuid']['output']>;
  /** Pinned to 'cardio' via DEFAULT + CHECK. Forms a composite FK with exercise_id targeting exercises(id, kind), so this row can only attach to a cardio exercise — a category flip on the parent that would change exercises.kind cascades into here and the pinned CHECK rolls back the transaction. Added in this migration to close the asymmetry with exercises_strength. */
  kind?: Maybe<Scalars['String']['output']>;
  /** JSON Schema describing the per-entry metrics shape for this cardio exercise. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  metricsSchema?: Maybe<Scalars['jsonb']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
};

/** response of any mutation on the table "exercises_cardio" */
export type ExercisesCardio_Mutation_Response = {
  __typename?: 'exercisesCardio_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<ExercisesCardio>;
};

/** input type for inserting object relation for remote table "exercises_cardio" */
export type ExercisesCardio_Obj_Rel_Insert_Input = {
  data: ExercisesCardio_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<ExercisesCardio_On_Conflict>;
};

/** on_conflict condition type for table "exercises_cardio" */
export type ExercisesCardio_On_Conflict = {
  constraint: ExercisesCardio_Constraint;
  update_columns?: Array<ExercisesCardio_Update_Column>;
  where?: InputMaybe<ExercisesCardio_Bool_Exp>;
};

/** Ordering options when selecting data from "exercises_cardio". */
export type ExercisesCardio_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  exercise?: InputMaybe<Exercises_Order_By>;
  exerciseId?: InputMaybe<Order_By>;
  /** Pinned to 'cardio' via DEFAULT + CHECK. Forms a composite FK with exercise_id targeting exercises(id, kind), so this row can only attach to a cardio exercise — a category flip on the parent that would change exercises.kind cascades into here and the pinned CHECK rolls back the transaction. Added in this migration to close the asymmetry with exercises_strength. */
  kind?: InputMaybe<Order_By>;
  /** JSON Schema describing the per-entry metrics shape for this cardio exercise. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  metricsSchema?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** primary key columns input for table: exercises_cardio */
export type ExercisesCardio_Pk_Columns_Input = {
  exerciseId: Scalars['uuid']['input'];
};

/** prepend existing jsonb value of filtered columns with new jsonb value */
export type ExercisesCardio_Prepend_Input = {
  /** JSON Schema describing the per-entry metrics shape for this cardio exercise. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  metricsSchema?: InputMaybe<Scalars['jsonb']['input']>;
};

/** select columns of table "exercises_cardio" */
export enum ExercisesCardio_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  ExerciseId = 'exerciseId',
  /** Pinned to 'cardio' via DEFAULT + CHECK. Forms a composite FK with exercise_id targeting exercises(id, kind), so this row can only attach to a cardio exercise — a category flip on the parent that would change exercises.kind cascades into here and the pinned CHECK rolls back the transaction. Added in this migration to close the asymmetry with exercises_strength. */
  Kind = 'kind',
  /** JSON Schema describing the per-entry metrics shape for this cardio exercise. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  MetricsSchema = 'metricsSchema',
  /** column name */
  UpdatedAt = 'updatedAt'
}

/** input type for updating data in table "exercises_cardio" */
export type ExercisesCardio_Set_Input = {
  /** JSON Schema describing the per-entry metrics shape for this cardio exercise. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  metricsSchema?: InputMaybe<Scalars['jsonb']['input']>;
};

/** Streaming cursor of the table "exercisesCardio" */
export type ExercisesCardio_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: ExercisesCardio_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type ExercisesCardio_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  exerciseId?: InputMaybe<Scalars['uuid']['input']>;
  /** Pinned to 'cardio' via DEFAULT + CHECK. Forms a composite FK with exercise_id targeting exercises(id, kind), so this row can only attach to a cardio exercise — a category flip on the parent that would change exercises.kind cascades into here and the pinned CHECK rolls back the transaction. Added in this migration to close the asymmetry with exercises_strength. */
  kind?: InputMaybe<Scalars['String']['input']>;
  /** JSON Schema describing the per-entry metrics shape for this cardio exercise. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  metricsSchema?: InputMaybe<Scalars['jsonb']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** update columns of table "exercises_cardio" */
export enum ExercisesCardio_Update_Column {
  /** JSON Schema describing the per-entry metrics shape for this cardio exercise. Custom annotation keys: x-label, x-unit, x-format (integer|decimal|duration_seconds|average), x-order. Format "average" displays like an integer but is averaged (not summed) when aggregating across entries in a session. */
  MetricsSchema = 'metricsSchema'
}

export type ExercisesCardio_Updates = {
  /** append existing jsonb value of filtered columns with new jsonb value */
  _append?: InputMaybe<ExercisesCardio_Append_Input>;
  /** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
  _delete_at_path?: InputMaybe<ExercisesCardio_Delete_At_Path_Input>;
  /** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
  _delete_elem?: InputMaybe<ExercisesCardio_Delete_Elem_Input>;
  /** delete key/value pair or string element. key/value pairs are matched based on their key value */
  _delete_key?: InputMaybe<ExercisesCardio_Delete_Key_Input>;
  /** prepend existing jsonb value of filtered columns with new jsonb value */
  _prepend?: InputMaybe<ExercisesCardio_Prepend_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<ExercisesCardio_Set_Input>;
  /** filter the rows which have to be updated */
  where: ExercisesCardio_Bool_Exp;
};

/** Sidecar for strength exercises (class-table inheritance with exercises): carries strength-specific catalog metadata (double_weight, force, mechanic). kind is pinned to 'strength' and composite-FKs to exercises(id, kind), making the strength/cardio split structural. Lifecycle is atomic: every strength exercise must have a matching row at commit time (exercise_must_have_sidecar trigger), and this row cannot be deleted standalone (sidecar_delete_requires_parent_delete trigger). */
export type ExercisesStrength = {
  __typename?: 'exercisesStrength';
  createdAt: Scalars['timestamptz']['output'];
  /** Per-exercise hint: the displayed/logged weight is per-implement (dumbbell, kettlebell). Multiplies session volume by 2 when set. Pure UI metadata — no DB-level enforcement of "two implements were actually used". */
  doubleWeight: Scalars['Boolean']['output'];
  /** An object relationship */
  exercise: Exercises;
  exerciseId: Scalars['uuid']['output'];
  /** Movement force pattern (push / pull / static) from exercise_forces — strength-specific catalog metadata, used for filtering/badges. */
  force?: Maybe<ExerciseForces_Enum>;
  /** Pinned to 'strength' via DEFAULT + CHECK. Forms a composite FK with exercise_id targeting exercises(id, kind), so this row can only attach to a strength exercise — a category flip on the parent that would change exercises.kind cascades into here and the pinned CHECK rolls back the transaction. */
  kind: Scalars['String']['output'];
  /** Movement mechanic (compound / isolation) from exercise_mechanics — strength-specific catalog metadata, used for filtering/badges. */
  mechanic?: Maybe<ExerciseMechanics_Enum>;
  updatedAt: Scalars['timestamptz']['output'];
};

/** aggregated selection of "exercises_strength" */
export type ExercisesStrength_Aggregate = {
  __typename?: 'exercisesStrength_aggregate';
  aggregate?: Maybe<ExercisesStrength_Aggregate_Fields>;
  nodes: Array<ExercisesStrength>;
};

export type ExercisesStrength_Aggregate_Bool_Exp = {
  bool_and?: InputMaybe<ExercisesStrength_Aggregate_Bool_Exp_Bool_And>;
  bool_or?: InputMaybe<ExercisesStrength_Aggregate_Bool_Exp_Bool_Or>;
  count?: InputMaybe<ExercisesStrength_Aggregate_Bool_Exp_Count>;
};

export type ExercisesStrength_Aggregate_Bool_Exp_Bool_And = {
  arguments: ExercisesStrength_Select_Column_ExercisesStrength_Aggregate_Bool_Exp_Bool_And_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<ExercisesStrength_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type ExercisesStrength_Aggregate_Bool_Exp_Bool_Or = {
  arguments: ExercisesStrength_Select_Column_ExercisesStrength_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<ExercisesStrength_Bool_Exp>;
  predicate: Boolean_Comparison_Exp;
};

export type ExercisesStrength_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<ExercisesStrength_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<ExercisesStrength_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "exercises_strength" */
export type ExercisesStrength_Aggregate_Fields = {
  __typename?: 'exercisesStrength_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<ExercisesStrength_Max_Fields>;
  min?: Maybe<ExercisesStrength_Min_Fields>;
};


/** aggregate fields of "exercises_strength" */
export type ExercisesStrength_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<ExercisesStrength_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "exercises_strength" */
export type ExercisesStrength_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<ExercisesStrength_Max_Order_By>;
  min?: InputMaybe<ExercisesStrength_Min_Order_By>;
};

/** Boolean expression to filter rows from the table "exercises_strength". All fields are combined with a logical 'AND'. */
export type ExercisesStrength_Bool_Exp = {
  _and?: InputMaybe<Array<ExercisesStrength_Bool_Exp>>;
  _not?: InputMaybe<ExercisesStrength_Bool_Exp>;
  _or?: InputMaybe<Array<ExercisesStrength_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  /** Per-exercise hint: the displayed/logged weight is per-implement (dumbbell, kettlebell). Multiplies session volume by 2 when set. Pure UI metadata — no DB-level enforcement of "two implements were actually used". */
  doubleWeight?: InputMaybe<Boolean_Comparison_Exp>;
  exercise?: InputMaybe<Exercises_Bool_Exp>;
  exerciseId?: InputMaybe<Uuid_Comparison_Exp>;
  /** Movement force pattern (push / pull / static) from exercise_forces — strength-specific catalog metadata, used for filtering/badges. */
  force?: InputMaybe<ExerciseForces_Enum_Comparison_Exp>;
  /** Pinned to 'strength' via DEFAULT + CHECK. Forms a composite FK with exercise_id targeting exercises(id, kind), so this row can only attach to a strength exercise — a category flip on the parent that would change exercises.kind cascades into here and the pinned CHECK rolls back the transaction. */
  kind?: InputMaybe<String_Comparison_Exp>;
  /** Movement mechanic (compound / isolation) from exercise_mechanics — strength-specific catalog metadata, used for filtering/badges. */
  mechanic?: InputMaybe<ExerciseMechanics_Enum_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "exercises_strength" */
export enum ExercisesStrength_Constraint {
  /** unique or primary key constraint on columns "exercise_id" */
  ExercisesStrengthPkey = 'exercises_strength_pkey'
}

/** input type for inserting data into table "exercises_strength" */
export type ExercisesStrength_Insert_Input = {
  /** Per-exercise hint: the displayed/logged weight is per-implement (dumbbell, kettlebell). Multiplies session volume by 2 when set. Pure UI metadata — no DB-level enforcement of "two implements were actually used". */
  doubleWeight?: InputMaybe<Scalars['Boolean']['input']>;
  exercise?: InputMaybe<Exercises_Obj_Rel_Insert_Input>;
  exerciseId?: InputMaybe<Scalars['uuid']['input']>;
  /** Movement force pattern (push / pull / static) from exercise_forces — strength-specific catalog metadata, used for filtering/badges. */
  force?: InputMaybe<ExerciseForces_Enum>;
  /** Movement mechanic (compound / isolation) from exercise_mechanics — strength-specific catalog metadata, used for filtering/badges. */
  mechanic?: InputMaybe<ExerciseMechanics_Enum>;
};

/** aggregate max on columns */
export type ExercisesStrength_Max_Fields = {
  __typename?: 'exercisesStrength_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  /** Per-exercise hint: the displayed/logged weight is per-implement (dumbbell, kettlebell). Multiplies session volume by 2 when set. Pure UI metadata — no DB-level enforcement of "two implements were actually used". */
  doubleWeight?: Maybe<Scalars['Boolean']['output']>;
  exerciseId?: Maybe<Scalars['uuid']['output']>;
  /** Pinned to 'strength' via DEFAULT + CHECK. Forms a composite FK with exercise_id targeting exercises(id, kind), so this row can only attach to a strength exercise — a category flip on the parent that would change exercises.kind cascades into here and the pinned CHECK rolls back the transaction. */
  kind?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by max() on columns of table "exercises_strength" */
export type ExercisesStrength_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  /** Per-exercise hint: the displayed/logged weight is per-implement (dumbbell, kettlebell). Multiplies session volume by 2 when set. Pure UI metadata — no DB-level enforcement of "two implements were actually used". */
  doubleWeight?: InputMaybe<Order_By>;
  exerciseId?: InputMaybe<Order_By>;
  /** Pinned to 'strength' via DEFAULT + CHECK. Forms a composite FK with exercise_id targeting exercises(id, kind), so this row can only attach to a strength exercise — a category flip on the parent that would change exercises.kind cascades into here and the pinned CHECK rolls back the transaction. */
  kind?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type ExercisesStrength_Min_Fields = {
  __typename?: 'exercisesStrength_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  /** Per-exercise hint: the displayed/logged weight is per-implement (dumbbell, kettlebell). Multiplies session volume by 2 when set. Pure UI metadata — no DB-level enforcement of "two implements were actually used". */
  doubleWeight?: Maybe<Scalars['Boolean']['output']>;
  exerciseId?: Maybe<Scalars['uuid']['output']>;
  /** Pinned to 'strength' via DEFAULT + CHECK. Forms a composite FK with exercise_id targeting exercises(id, kind), so this row can only attach to a strength exercise — a category flip on the parent that would change exercises.kind cascades into here and the pinned CHECK rolls back the transaction. */
  kind?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by min() on columns of table "exercises_strength" */
export type ExercisesStrength_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  /** Per-exercise hint: the displayed/logged weight is per-implement (dumbbell, kettlebell). Multiplies session volume by 2 when set. Pure UI metadata — no DB-level enforcement of "two implements were actually used". */
  doubleWeight?: InputMaybe<Order_By>;
  exerciseId?: InputMaybe<Order_By>;
  /** Pinned to 'strength' via DEFAULT + CHECK. Forms a composite FK with exercise_id targeting exercises(id, kind), so this row can only attach to a strength exercise — a category flip on the parent that would change exercises.kind cascades into here and the pinned CHECK rolls back the transaction. */
  kind?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "exercises_strength" */
export type ExercisesStrength_Mutation_Response = {
  __typename?: 'exercisesStrength_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<ExercisesStrength>;
};

/** input type for inserting object relation for remote table "exercises_strength" */
export type ExercisesStrength_Obj_Rel_Insert_Input = {
  data: ExercisesStrength_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<ExercisesStrength_On_Conflict>;
};

/** on_conflict condition type for table "exercises_strength" */
export type ExercisesStrength_On_Conflict = {
  constraint: ExercisesStrength_Constraint;
  update_columns?: Array<ExercisesStrength_Update_Column>;
  where?: InputMaybe<ExercisesStrength_Bool_Exp>;
};

/** Ordering options when selecting data from "exercises_strength". */
export type ExercisesStrength_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  /** Per-exercise hint: the displayed/logged weight is per-implement (dumbbell, kettlebell). Multiplies session volume by 2 when set. Pure UI metadata — no DB-level enforcement of "two implements were actually used". */
  doubleWeight?: InputMaybe<Order_By>;
  exercise?: InputMaybe<Exercises_Order_By>;
  exerciseId?: InputMaybe<Order_By>;
  /** Movement force pattern (push / pull / static) from exercise_forces — strength-specific catalog metadata, used for filtering/badges. */
  force?: InputMaybe<Order_By>;
  /** Pinned to 'strength' via DEFAULT + CHECK. Forms a composite FK with exercise_id targeting exercises(id, kind), so this row can only attach to a strength exercise — a category flip on the parent that would change exercises.kind cascades into here and the pinned CHECK rolls back the transaction. */
  kind?: InputMaybe<Order_By>;
  /** Movement mechanic (compound / isolation) from exercise_mechanics — strength-specific catalog metadata, used for filtering/badges. */
  mechanic?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** primary key columns input for table: exercises_strength */
export type ExercisesStrength_Pk_Columns_Input = {
  exerciseId: Scalars['uuid']['input'];
};

/** select columns of table "exercises_strength" */
export enum ExercisesStrength_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** Per-exercise hint: the displayed/logged weight is per-implement (dumbbell, kettlebell). Multiplies session volume by 2 when set. Pure UI metadata — no DB-level enforcement of "two implements were actually used". */
  DoubleWeight = 'doubleWeight',
  /** column name */
  ExerciseId = 'exerciseId',
  /** Movement force pattern (push / pull / static) from exercise_forces — strength-specific catalog metadata, used for filtering/badges. */
  Force = 'force',
  /** Pinned to 'strength' via DEFAULT + CHECK. Forms a composite FK with exercise_id targeting exercises(id, kind), so this row can only attach to a strength exercise — a category flip on the parent that would change exercises.kind cascades into here and the pinned CHECK rolls back the transaction. */
  Kind = 'kind',
  /** Movement mechanic (compound / isolation) from exercise_mechanics — strength-specific catalog metadata, used for filtering/badges. */
  Mechanic = 'mechanic',
  /** column name */
  UpdatedAt = 'updatedAt'
}

/** select "exercisesStrength_aggregate_bool_exp_bool_and_arguments_columns" columns of table "exercises_strength" */
export enum ExercisesStrength_Select_Column_ExercisesStrength_Aggregate_Bool_Exp_Bool_And_Arguments_Columns {
  /** column name */
  DoubleWeight = 'doubleWeight'
}

/** select "exercisesStrength_aggregate_bool_exp_bool_or_arguments_columns" columns of table "exercises_strength" */
export enum ExercisesStrength_Select_Column_ExercisesStrength_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  DoubleWeight = 'doubleWeight'
}

/** input type for updating data in table "exercises_strength" */
export type ExercisesStrength_Set_Input = {
  /** Per-exercise hint: the displayed/logged weight is per-implement (dumbbell, kettlebell). Multiplies session volume by 2 when set. Pure UI metadata — no DB-level enforcement of "two implements were actually used". */
  doubleWeight?: InputMaybe<Scalars['Boolean']['input']>;
  /** Movement force pattern (push / pull / static) from exercise_forces — strength-specific catalog metadata, used for filtering/badges. */
  force?: InputMaybe<ExerciseForces_Enum>;
  /** Movement mechanic (compound / isolation) from exercise_mechanics — strength-specific catalog metadata, used for filtering/badges. */
  mechanic?: InputMaybe<ExerciseMechanics_Enum>;
};

/** Streaming cursor of the table "exercisesStrength" */
export type ExercisesStrength_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: ExercisesStrength_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type ExercisesStrength_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  /** Per-exercise hint: the displayed/logged weight is per-implement (dumbbell, kettlebell). Multiplies session volume by 2 when set. Pure UI metadata — no DB-level enforcement of "two implements were actually used". */
  doubleWeight?: InputMaybe<Scalars['Boolean']['input']>;
  exerciseId?: InputMaybe<Scalars['uuid']['input']>;
  /** Movement force pattern (push / pull / static) from exercise_forces — strength-specific catalog metadata, used for filtering/badges. */
  force?: InputMaybe<ExerciseForces_Enum>;
  /** Pinned to 'strength' via DEFAULT + CHECK. Forms a composite FK with exercise_id targeting exercises(id, kind), so this row can only attach to a strength exercise — a category flip on the parent that would change exercises.kind cascades into here and the pinned CHECK rolls back the transaction. */
  kind?: InputMaybe<Scalars['String']['input']>;
  /** Movement mechanic (compound / isolation) from exercise_mechanics — strength-specific catalog metadata, used for filtering/badges. */
  mechanic?: InputMaybe<ExerciseMechanics_Enum>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** update columns of table "exercises_strength" */
export enum ExercisesStrength_Update_Column {
  /** Per-exercise hint: the displayed/logged weight is per-implement (dumbbell, kettlebell). Multiplies session volume by 2 when set. Pure UI metadata — no DB-level enforcement of "two implements were actually used". */
  DoubleWeight = 'doubleWeight',
  /** Movement force pattern (push / pull / static) from exercise_forces — strength-specific catalog metadata, used for filtering/badges. */
  Force = 'force',
  /** Movement mechanic (compound / isolation) from exercise_mechanics — strength-specific catalog metadata, used for filtering/badges. */
  Mechanic = 'mechanic'
}

export type ExercisesStrength_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<ExercisesStrength_Set_Input>;
  /** filter the rows which have to be updated */
  where: ExercisesStrength_Bool_Exp;
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

/** Boolean expression to filter rows from the table "exercises". All fields are combined with a logical 'AND'. */
export type Exercises_Bool_Exp = {
  _and?: InputMaybe<Array<Exercises_Bool_Exp>>;
  _not?: InputMaybe<Exercises_Bool_Exp>;
  _or?: InputMaybe<Array<Exercises_Bool_Exp>>;
  cardio?: InputMaybe<ExercisesCardio_Bool_Exp>;
  category?: InputMaybe<ExerciseCategories_Enum_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  equipment?: InputMaybe<ExerciseEquipments_Enum_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  image1?: InputMaybe<Files_Bool_Exp>;
  image1FileId?: InputMaybe<Uuid_Comparison_Exp>;
  image2?: InputMaybe<Files_Bool_Exp>;
  image2FileId?: InputMaybe<Uuid_Comparison_Exp>;
  instructions?: InputMaybe<String_Array_Comparison_Exp>;
  isPublic?: InputMaybe<Boolean_Comparison_Exp>;
  /** GENERATED STORED discriminator derived from category ('cardio' iff category='cardio', else 'strength'). Read-only — set indirectly via category. Used as the FK target alongside id for child tables (workout_exercises, workout_session_exercises, exercises_strength, exercises_cardio), making the strength/cardio split structural rather than trigger-based. */
  kind?: InputMaybe<String_Comparison_Exp>;
  level?: InputMaybe<ExerciseLevels_Enum_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  primaryMuscleGroup?: InputMaybe<MuscleGroups_Enum_Comparison_Exp>;
  secondaryMuscleGroups?: InputMaybe<ExerciseSecondaryMuscleGroups_Bool_Exp>;
  secondaryMuscleGroups_aggregate?: InputMaybe<ExerciseSecondaryMuscleGroups_Aggregate_Bool_Exp>;
  slug?: InputMaybe<String_Comparison_Exp>;
  strength?: InputMaybe<ExercisesStrength_Bool_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  userId?: InputMaybe<Uuid_Comparison_Exp>;
  workoutExercises?: InputMaybe<WorkoutExercises_Bool_Exp>;
  workoutExercises_aggregate?: InputMaybe<WorkoutExercises_Aggregate_Bool_Exp>;
  workoutSessionExercises?: InputMaybe<WorkoutSessionExercises_Bool_Exp>;
  workoutSessionExercises_aggregate?: InputMaybe<WorkoutSessionExercises_Aggregate_Bool_Exp>;
};

/** unique or primary key constraints on table "exercises" */
export enum Exercises_Constraint {
  /** unique or primary key constraint on columns "id", "kind" */
  ExercisesIdKindUq = 'exercises_id_kind_uq',
  /** unique or primary key constraint on columns "id" */
  ExercisesPkey = 'exercises_pkey',
  /** unique or primary key constraint on columns "slug" */
  ExercisesSlugKey = 'exercises_slug_key',
  /** unique or primary key constraint on columns "user_id", "name" */
  ExercisesUserNameUq = 'exercises_user_name_uq'
}

/** input type for inserting data into table "exercises" */
export type Exercises_Insert_Input = {
  cardio?: InputMaybe<ExercisesCardio_Obj_Rel_Insert_Input>;
  category?: InputMaybe<ExerciseCategories_Enum>;
  equipment?: InputMaybe<ExerciseEquipments_Enum>;
  image1FileId?: InputMaybe<Scalars['uuid']['input']>;
  image2FileId?: InputMaybe<Scalars['uuid']['input']>;
  instructions?: InputMaybe<Array<Scalars['String']['input']>>;
  level?: InputMaybe<ExerciseLevels_Enum>;
  name?: InputMaybe<Scalars['String']['input']>;
  primaryMuscleGroup?: InputMaybe<MuscleGroups_Enum>;
  strength?: InputMaybe<ExercisesStrength_Obj_Rel_Insert_Input>;
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
  isPublic?: Maybe<Scalars['Boolean']['output']>;
  /** GENERATED STORED discriminator derived from category ('cardio' iff category='cardio', else 'strength'). Read-only — set indirectly via category. Used as the FK target alongside id for child tables (workout_exercises, workout_session_exercises, exercises_strength, exercises_cardio), making the strength/cardio split structural rather than trigger-based. */
  kind?: Maybe<Scalars['String']['output']>;
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
  isPublic?: InputMaybe<Order_By>;
  /** GENERATED STORED discriminator derived from category ('cardio' iff category='cardio', else 'strength'). Read-only — set indirectly via category. Used as the FK target alongside id for child tables (workout_exercises, workout_session_exercises, exercises_strength, exercises_cardio), making the strength/cardio split structural rather than trigger-based. */
  kind?: InputMaybe<Order_By>;
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
  isPublic?: Maybe<Scalars['Boolean']['output']>;
  /** GENERATED STORED discriminator derived from category ('cardio' iff category='cardio', else 'strength'). Read-only — set indirectly via category. Used as the FK target alongside id for child tables (workout_exercises, workout_session_exercises, exercises_strength, exercises_cardio), making the strength/cardio split structural rather than trigger-based. */
  kind?: Maybe<Scalars['String']['output']>;
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
  isPublic?: InputMaybe<Order_By>;
  /** GENERATED STORED discriminator derived from category ('cardio' iff category='cardio', else 'strength'). Read-only — set indirectly via category. Used as the FK target alongside id for child tables (workout_exercises, workout_session_exercises, exercises_strength, exercises_cardio), making the strength/cardio split structural rather than trigger-based. */
  kind?: InputMaybe<Order_By>;
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
  cardio?: InputMaybe<ExercisesCardio_Order_By>;
  category?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  equipment?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  image1?: InputMaybe<Files_Order_By>;
  image1FileId?: InputMaybe<Order_By>;
  image2?: InputMaybe<Files_Order_By>;
  image2FileId?: InputMaybe<Order_By>;
  instructions?: InputMaybe<Order_By>;
  isPublic?: InputMaybe<Order_By>;
  /** GENERATED STORED discriminator derived from category ('cardio' iff category='cardio', else 'strength'). Read-only — set indirectly via category. Used as the FK target alongside id for child tables (workout_exercises, workout_session_exercises, exercises_strength, exercises_cardio), making the strength/cardio split structural rather than trigger-based. */
  kind?: InputMaybe<Order_By>;
  level?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  primaryMuscleGroup?: InputMaybe<Order_By>;
  secondaryMuscleGroups_aggregate?: InputMaybe<ExerciseSecondaryMuscleGroups_Aggregate_Order_By>;
  slug?: InputMaybe<Order_By>;
  strength?: InputMaybe<ExercisesStrength_Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
  workoutExercises_aggregate?: InputMaybe<WorkoutExercises_Aggregate_Order_By>;
  workoutSessionExercises_aggregate?: InputMaybe<WorkoutSessionExercises_Aggregate_Order_By>;
};

/** primary key columns input for table: exercises */
export type Exercises_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "exercises" */
export enum Exercises_Select_Column {
  /** column name */
  Category = 'category',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Equipment = 'equipment',
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
  /** GENERATED STORED discriminator derived from category ('cardio' iff category='cardio', else 'strength'). Read-only — set indirectly via category. Used as the FK target alongside id for child tables (workout_exercises, workout_session_exercises, exercises_strength, exercises_cardio), making the strength/cardio split structural rather than trigger-based. */
  Kind = 'kind',
  /** column name */
  Level = 'level',
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
  IsPublic = 'isPublic'
}

/** select "exercises_aggregate_bool_exp_bool_or_arguments_columns" columns of table "exercises" */
export enum Exercises_Select_Column_Exercises_Aggregate_Bool_Exp_Bool_Or_Arguments_Columns {
  /** column name */
  IsPublic = 'isPublic'
}

/** input type for updating data in table "exercises" */
export type Exercises_Set_Input = {
  category?: InputMaybe<ExerciseCategories_Enum>;
  equipment?: InputMaybe<ExerciseEquipments_Enum>;
  image1FileId?: InputMaybe<Scalars['uuid']['input']>;
  image2FileId?: InputMaybe<Scalars['uuid']['input']>;
  instructions?: InputMaybe<Array<Scalars['String']['input']>>;
  level?: InputMaybe<ExerciseLevels_Enum>;
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
  equipment?: InputMaybe<ExerciseEquipments_Enum>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  image1FileId?: InputMaybe<Scalars['uuid']['input']>;
  image2FileId?: InputMaybe<Scalars['uuid']['input']>;
  instructions?: InputMaybe<Array<Scalars['String']['input']>>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  /** GENERATED STORED discriminator derived from category ('cardio' iff category='cardio', else 'strength'). Read-only — set indirectly via category. Used as the FK target alongside id for child tables (workout_exercises, workout_session_exercises, exercises_strength, exercises_cardio), making the strength/cardio split structural rather than trigger-based. */
  kind?: InputMaybe<Scalars['String']['input']>;
  level?: InputMaybe<ExerciseLevels_Enum>;
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
  Equipment = 'equipment',
  /** column name */
  Image1FileId = 'image1FileId',
  /** column name */
  Image2FileId = 'image2FileId',
  /** column name */
  Instructions = 'instructions',
  /** column name */
  Level = 'level',
  /** column name */
  Name = 'name',
  /** column name */
  PrimaryMuscleGroup = 'primaryMuscleGroup'
}

export type Exercises_Updates = {
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

/** Owner-or-public nutrition catalog. Nutrients are canonical per 100 grams. v1 intentionally has no brand column; name uniqueness follows the exercises/workouts/labels UNIQUE NULLS NOT DISTINCT catalog precedent. */
export type Foods = {
  __typename?: 'foods';
  carbsPer100g: Scalars['numeric']['output'];
  createdAt: Scalars['timestamptz']['output'];
  fatPer100g: Scalars['numeric']['output'];
  fiberPer100g: Scalars['numeric']['output'];
  id: Scalars['uuid']['output'];
  isPublic: Scalars['Boolean']['output'];
  kcalPer100g: Scalars['numeric']['output'];
  /** An array relationship */
  mealIngredients: Array<MealIngredients>;
  /** An aggregate relationship */
  mealIngredients_aggregate: MealIngredients_Aggregate;
  name: Scalars['String']['output'];
  /** An array relationship */
  nutritionLogEntries: Array<NutritionLogEntries>;
  /** An aggregate relationship */
  nutritionLogEntries_aggregate: NutritionLogEntries_Aggregate;
  proteinPer100g: Scalars['numeric']['output'];
  sugarPer100g: Scalars['numeric']['output'];
  updatedAt: Scalars['timestamptz']['output'];
  userId?: Maybe<Scalars['uuid']['output']>;
};


/** Owner-or-public nutrition catalog. Nutrients are canonical per 100 grams. v1 intentionally has no brand column; name uniqueness follows the exercises/workouts/labels UNIQUE NULLS NOT DISTINCT catalog precedent. */
export type FoodsMealIngredientsArgs = {
  distinct_on?: InputMaybe<Array<MealIngredients_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<MealIngredients_Order_By>>;
  where?: InputMaybe<MealIngredients_Bool_Exp>;
};


/** Owner-or-public nutrition catalog. Nutrients are canonical per 100 grams. v1 intentionally has no brand column; name uniqueness follows the exercises/workouts/labels UNIQUE NULLS NOT DISTINCT catalog precedent. */
export type FoodsMealIngredients_AggregateArgs = {
  distinct_on?: InputMaybe<Array<MealIngredients_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<MealIngredients_Order_By>>;
  where?: InputMaybe<MealIngredients_Bool_Exp>;
};


/** Owner-or-public nutrition catalog. Nutrients are canonical per 100 grams. v1 intentionally has no brand column; name uniqueness follows the exercises/workouts/labels UNIQUE NULLS NOT DISTINCT catalog precedent. */
export type FoodsNutritionLogEntriesArgs = {
  distinct_on?: InputMaybe<Array<NutritionLogEntries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionLogEntries_Order_By>>;
  where?: InputMaybe<NutritionLogEntries_Bool_Exp>;
};


/** Owner-or-public nutrition catalog. Nutrients are canonical per 100 grams. v1 intentionally has no brand column; name uniqueness follows the exercises/workouts/labels UNIQUE NULLS NOT DISTINCT catalog precedent. */
export type FoodsNutritionLogEntries_AggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionLogEntries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionLogEntries_Order_By>>;
  where?: InputMaybe<NutritionLogEntries_Bool_Exp>;
};

/** aggregated selection of "foods" */
export type Foods_Aggregate = {
  __typename?: 'foods_aggregate';
  aggregate?: Maybe<Foods_Aggregate_Fields>;
  nodes: Array<Foods>;
};

/** aggregate fields of "foods" */
export type Foods_Aggregate_Fields = {
  __typename?: 'foods_aggregate_fields';
  avg?: Maybe<Foods_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<Foods_Max_Fields>;
  min?: Maybe<Foods_Min_Fields>;
  stddev?: Maybe<Foods_Stddev_Fields>;
  stddev_pop?: Maybe<Foods_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<Foods_Stddev_Samp_Fields>;
  sum?: Maybe<Foods_Sum_Fields>;
  var_pop?: Maybe<Foods_Var_Pop_Fields>;
  var_samp?: Maybe<Foods_Var_Samp_Fields>;
  variance?: Maybe<Foods_Variance_Fields>;
};


/** aggregate fields of "foods" */
export type Foods_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Foods_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** aggregate avg on columns */
export type Foods_Avg_Fields = {
  __typename?: 'foods_avg_fields';
  carbsPer100g?: Maybe<Scalars['Float']['output']>;
  fatPer100g?: Maybe<Scalars['Float']['output']>;
  fiberPer100g?: Maybe<Scalars['Float']['output']>;
  kcalPer100g?: Maybe<Scalars['Float']['output']>;
  proteinPer100g?: Maybe<Scalars['Float']['output']>;
  sugarPer100g?: Maybe<Scalars['Float']['output']>;
};

/** Boolean expression to filter rows from the table "foods". All fields are combined with a logical 'AND'. */
export type Foods_Bool_Exp = {
  _and?: InputMaybe<Array<Foods_Bool_Exp>>;
  _not?: InputMaybe<Foods_Bool_Exp>;
  _or?: InputMaybe<Array<Foods_Bool_Exp>>;
  carbsPer100g?: InputMaybe<Numeric_Comparison_Exp>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  fatPer100g?: InputMaybe<Numeric_Comparison_Exp>;
  fiberPer100g?: InputMaybe<Numeric_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  isPublic?: InputMaybe<Boolean_Comparison_Exp>;
  kcalPer100g?: InputMaybe<Numeric_Comparison_Exp>;
  mealIngredients?: InputMaybe<MealIngredients_Bool_Exp>;
  mealIngredients_aggregate?: InputMaybe<MealIngredients_Aggregate_Bool_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  nutritionLogEntries?: InputMaybe<NutritionLogEntries_Bool_Exp>;
  nutritionLogEntries_aggregate?: InputMaybe<NutritionLogEntries_Aggregate_Bool_Exp>;
  proteinPer100g?: InputMaybe<Numeric_Comparison_Exp>;
  sugarPer100g?: InputMaybe<Numeric_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  userId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "foods" */
export enum Foods_Constraint {
  /** unique or primary key constraint on columns "id" */
  FoodsPkey = 'foods_pkey',
  /** unique or primary key constraint on columns "user_id", "name" */
  FoodsUserNameUq = 'foods_user_name_uq'
}

/** input type for incrementing numeric columns in table "foods" */
export type Foods_Inc_Input = {
  carbsPer100g?: InputMaybe<Scalars['numeric']['input']>;
  fatPer100g?: InputMaybe<Scalars['numeric']['input']>;
  fiberPer100g?: InputMaybe<Scalars['numeric']['input']>;
  kcalPer100g?: InputMaybe<Scalars['numeric']['input']>;
  proteinPer100g?: InputMaybe<Scalars['numeric']['input']>;
  sugarPer100g?: InputMaybe<Scalars['numeric']['input']>;
};

/** input type for inserting data into table "foods" */
export type Foods_Insert_Input = {
  carbsPer100g?: InputMaybe<Scalars['numeric']['input']>;
  fatPer100g?: InputMaybe<Scalars['numeric']['input']>;
  fiberPer100g?: InputMaybe<Scalars['numeric']['input']>;
  kcalPer100g?: InputMaybe<Scalars['numeric']['input']>;
  mealIngredients?: InputMaybe<MealIngredients_Arr_Rel_Insert_Input>;
  name?: InputMaybe<Scalars['String']['input']>;
  nutritionLogEntries?: InputMaybe<NutritionLogEntries_Arr_Rel_Insert_Input>;
  proteinPer100g?: InputMaybe<Scalars['numeric']['input']>;
  sugarPer100g?: InputMaybe<Scalars['numeric']['input']>;
};

/** aggregate max on columns */
export type Foods_Max_Fields = {
  __typename?: 'foods_max_fields';
  carbsPer100g?: Maybe<Scalars['numeric']['output']>;
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  fatPer100g?: Maybe<Scalars['numeric']['output']>;
  fiberPer100g?: Maybe<Scalars['numeric']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  isPublic?: Maybe<Scalars['Boolean']['output']>;
  kcalPer100g?: Maybe<Scalars['numeric']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  proteinPer100g?: Maybe<Scalars['numeric']['output']>;
  sugarPer100g?: Maybe<Scalars['numeric']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
};

/** aggregate min on columns */
export type Foods_Min_Fields = {
  __typename?: 'foods_min_fields';
  carbsPer100g?: Maybe<Scalars['numeric']['output']>;
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  fatPer100g?: Maybe<Scalars['numeric']['output']>;
  fiberPer100g?: Maybe<Scalars['numeric']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  isPublic?: Maybe<Scalars['Boolean']['output']>;
  kcalPer100g?: Maybe<Scalars['numeric']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  proteinPer100g?: Maybe<Scalars['numeric']['output']>;
  sugarPer100g?: Maybe<Scalars['numeric']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
};

/** response of any mutation on the table "foods" */
export type Foods_Mutation_Response = {
  __typename?: 'foods_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Foods>;
};

/** input type for inserting object relation for remote table "foods" */
export type Foods_Obj_Rel_Insert_Input = {
  data: Foods_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Foods_On_Conflict>;
};

/** on_conflict condition type for table "foods" */
export type Foods_On_Conflict = {
  constraint: Foods_Constraint;
  update_columns?: Array<Foods_Update_Column>;
  where?: InputMaybe<Foods_Bool_Exp>;
};

/** Ordering options when selecting data from "foods". */
export type Foods_Order_By = {
  carbsPer100g?: InputMaybe<Order_By>;
  createdAt?: InputMaybe<Order_By>;
  fatPer100g?: InputMaybe<Order_By>;
  fiberPer100g?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  isPublic?: InputMaybe<Order_By>;
  kcalPer100g?: InputMaybe<Order_By>;
  mealIngredients_aggregate?: InputMaybe<MealIngredients_Aggregate_Order_By>;
  name?: InputMaybe<Order_By>;
  nutritionLogEntries_aggregate?: InputMaybe<NutritionLogEntries_Aggregate_Order_By>;
  proteinPer100g?: InputMaybe<Order_By>;
  sugarPer100g?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: foods */
export type Foods_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "foods" */
export enum Foods_Select_Column {
  /** column name */
  CarbsPer100g = 'carbsPer100g',
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  FatPer100g = 'fatPer100g',
  /** column name */
  FiberPer100g = 'fiberPer100g',
  /** column name */
  Id = 'id',
  /** column name */
  IsPublic = 'isPublic',
  /** column name */
  KcalPer100g = 'kcalPer100g',
  /** column name */
  Name = 'name',
  /** column name */
  ProteinPer100g = 'proteinPer100g',
  /** column name */
  SugarPer100g = 'sugarPer100g',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UserId = 'userId'
}

/** input type for updating data in table "foods" */
export type Foods_Set_Input = {
  carbsPer100g?: InputMaybe<Scalars['numeric']['input']>;
  fatPer100g?: InputMaybe<Scalars['numeric']['input']>;
  fiberPer100g?: InputMaybe<Scalars['numeric']['input']>;
  kcalPer100g?: InputMaybe<Scalars['numeric']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  proteinPer100g?: InputMaybe<Scalars['numeric']['input']>;
  sugarPer100g?: InputMaybe<Scalars['numeric']['input']>;
};

/** aggregate stddev on columns */
export type Foods_Stddev_Fields = {
  __typename?: 'foods_stddev_fields';
  carbsPer100g?: Maybe<Scalars['Float']['output']>;
  fatPer100g?: Maybe<Scalars['Float']['output']>;
  fiberPer100g?: Maybe<Scalars['Float']['output']>;
  kcalPer100g?: Maybe<Scalars['Float']['output']>;
  proteinPer100g?: Maybe<Scalars['Float']['output']>;
  sugarPer100g?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_pop on columns */
export type Foods_Stddev_Pop_Fields = {
  __typename?: 'foods_stddev_pop_fields';
  carbsPer100g?: Maybe<Scalars['Float']['output']>;
  fatPer100g?: Maybe<Scalars['Float']['output']>;
  fiberPer100g?: Maybe<Scalars['Float']['output']>;
  kcalPer100g?: Maybe<Scalars['Float']['output']>;
  proteinPer100g?: Maybe<Scalars['Float']['output']>;
  sugarPer100g?: Maybe<Scalars['Float']['output']>;
};

/** aggregate stddev_samp on columns */
export type Foods_Stddev_Samp_Fields = {
  __typename?: 'foods_stddev_samp_fields';
  carbsPer100g?: Maybe<Scalars['Float']['output']>;
  fatPer100g?: Maybe<Scalars['Float']['output']>;
  fiberPer100g?: Maybe<Scalars['Float']['output']>;
  kcalPer100g?: Maybe<Scalars['Float']['output']>;
  proteinPer100g?: Maybe<Scalars['Float']['output']>;
  sugarPer100g?: Maybe<Scalars['Float']['output']>;
};

/** Streaming cursor of the table "foods" */
export type Foods_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Foods_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Foods_Stream_Cursor_Value_Input = {
  carbsPer100g?: InputMaybe<Scalars['numeric']['input']>;
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  fatPer100g?: InputMaybe<Scalars['numeric']['input']>;
  fiberPer100g?: InputMaybe<Scalars['numeric']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  kcalPer100g?: InputMaybe<Scalars['numeric']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  proteinPer100g?: InputMaybe<Scalars['numeric']['input']>;
  sugarPer100g?: InputMaybe<Scalars['numeric']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
  userId?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate sum on columns */
export type Foods_Sum_Fields = {
  __typename?: 'foods_sum_fields';
  carbsPer100g?: Maybe<Scalars['numeric']['output']>;
  fatPer100g?: Maybe<Scalars['numeric']['output']>;
  fiberPer100g?: Maybe<Scalars['numeric']['output']>;
  kcalPer100g?: Maybe<Scalars['numeric']['output']>;
  proteinPer100g?: Maybe<Scalars['numeric']['output']>;
  sugarPer100g?: Maybe<Scalars['numeric']['output']>;
};

/** update columns of table "foods" */
export enum Foods_Update_Column {
  /** column name */
  CarbsPer100g = 'carbsPer100g',
  /** column name */
  FatPer100g = 'fatPer100g',
  /** column name */
  FiberPer100g = 'fiberPer100g',
  /** column name */
  KcalPer100g = 'kcalPer100g',
  /** column name */
  Name = 'name',
  /** column name */
  ProteinPer100g = 'proteinPer100g',
  /** column name */
  SugarPer100g = 'sugarPer100g'
}

export type Foods_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<Foods_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Foods_Set_Input>;
  /** filter the rows which have to be updated */
  where: Foods_Bool_Exp;
};

/** aggregate var_pop on columns */
export type Foods_Var_Pop_Fields = {
  __typename?: 'foods_var_pop_fields';
  carbsPer100g?: Maybe<Scalars['Float']['output']>;
  fatPer100g?: Maybe<Scalars['Float']['output']>;
  fiberPer100g?: Maybe<Scalars['Float']['output']>;
  kcalPer100g?: Maybe<Scalars['Float']['output']>;
  proteinPer100g?: Maybe<Scalars['Float']['output']>;
  sugarPer100g?: Maybe<Scalars['Float']['output']>;
};

/** aggregate var_samp on columns */
export type Foods_Var_Samp_Fields = {
  __typename?: 'foods_var_samp_fields';
  carbsPer100g?: Maybe<Scalars['Float']['output']>;
  fatPer100g?: Maybe<Scalars['Float']['output']>;
  fiberPer100g?: Maybe<Scalars['Float']['output']>;
  kcalPer100g?: Maybe<Scalars['Float']['output']>;
  proteinPer100g?: Maybe<Scalars['Float']['output']>;
  sugarPer100g?: Maybe<Scalars['Float']['output']>;
};

/** aggregate variance on columns */
export type Foods_Variance_Fields = {
  __typename?: 'foods_variance_fields';
  carbsPer100g?: Maybe<Scalars['Float']['output']>;
  fatPer100g?: Maybe<Scalars['Float']['output']>;
  fiberPer100g?: Maybe<Scalars['Float']['output']>;
  kcalPer100g?: Maybe<Scalars['Float']['output']>;
  proteinPer100g?: Maybe<Scalars['Float']['output']>;
  sugarPer100g?: Maybe<Scalars['Float']['output']>;
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
  /** unique or primary key constraint on columns "journal_entry_id", "label_id" */
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
  isPublic?: Maybe<Scalars['Boolean']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
};

/** aggregate min on columns */
export type Labels_Min_Fields = {
  __typename?: 'labels_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  isPublic?: Maybe<Scalars['Boolean']['output']>;
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

/** columns and relationships of "meal_ingredients" */
export type MealIngredients = {
  __typename?: 'mealIngredients';
  createdAt: Scalars['timestamptz']['output'];
  /** An object relationship */
  food: Foods;
  foodId: Scalars['uuid']['output'];
  grams: Scalars['numeric']['output'];
  id: Scalars['uuid']['output'];
  /** An object relationship */
  meal: Meals;
  mealId: Scalars['uuid']['output'];
  position: Scalars['Int']['output'];
  updatedAt: Scalars['timestamptz']['output'];
};

/** aggregated selection of "meal_ingredients" */
export type MealIngredients_Aggregate = {
  __typename?: 'mealIngredients_aggregate';
  aggregate?: Maybe<MealIngredients_Aggregate_Fields>;
  nodes: Array<MealIngredients>;
};

export type MealIngredients_Aggregate_Bool_Exp = {
  count?: InputMaybe<MealIngredients_Aggregate_Bool_Exp_Count>;
};

export type MealIngredients_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<MealIngredients_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<MealIngredients_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "meal_ingredients" */
export type MealIngredients_Aggregate_Fields = {
  __typename?: 'mealIngredients_aggregate_fields';
  avg?: Maybe<MealIngredients_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<MealIngredients_Max_Fields>;
  min?: Maybe<MealIngredients_Min_Fields>;
  stddev?: Maybe<MealIngredients_Stddev_Fields>;
  stddev_pop?: Maybe<MealIngredients_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<MealIngredients_Stddev_Samp_Fields>;
  sum?: Maybe<MealIngredients_Sum_Fields>;
  var_pop?: Maybe<MealIngredients_Var_Pop_Fields>;
  var_samp?: Maybe<MealIngredients_Var_Samp_Fields>;
  variance?: Maybe<MealIngredients_Variance_Fields>;
};


/** aggregate fields of "meal_ingredients" */
export type MealIngredients_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<MealIngredients_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "meal_ingredients" */
export type MealIngredients_Aggregate_Order_By = {
  avg?: InputMaybe<MealIngredients_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<MealIngredients_Max_Order_By>;
  min?: InputMaybe<MealIngredients_Min_Order_By>;
  stddev?: InputMaybe<MealIngredients_Stddev_Order_By>;
  stddev_pop?: InputMaybe<MealIngredients_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<MealIngredients_Stddev_Samp_Order_By>;
  sum?: InputMaybe<MealIngredients_Sum_Order_By>;
  var_pop?: InputMaybe<MealIngredients_Var_Pop_Order_By>;
  var_samp?: InputMaybe<MealIngredients_Var_Samp_Order_By>;
  variance?: InputMaybe<MealIngredients_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "meal_ingredients" */
export type MealIngredients_Arr_Rel_Insert_Input = {
  data: Array<MealIngredients_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<MealIngredients_On_Conflict>;
};

/** aggregate avg on columns */
export type MealIngredients_Avg_Fields = {
  __typename?: 'mealIngredients_avg_fields';
  grams?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "meal_ingredients" */
export type MealIngredients_Avg_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "meal_ingredients". All fields are combined with a logical 'AND'. */
export type MealIngredients_Bool_Exp = {
  _and?: InputMaybe<Array<MealIngredients_Bool_Exp>>;
  _not?: InputMaybe<MealIngredients_Bool_Exp>;
  _or?: InputMaybe<Array<MealIngredients_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  food?: InputMaybe<Foods_Bool_Exp>;
  foodId?: InputMaybe<Uuid_Comparison_Exp>;
  grams?: InputMaybe<Numeric_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  meal?: InputMaybe<Meals_Bool_Exp>;
  mealId?: InputMaybe<Uuid_Comparison_Exp>;
  position?: InputMaybe<Int_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "meal_ingredients" */
export enum MealIngredients_Constraint {
  /** unique or primary key constraint on columns "id" */
  MealIngredientsPkey = 'meal_ingredients_pkey'
}

/** input type for incrementing numeric columns in table "meal_ingredients" */
export type MealIngredients_Inc_Input = {
  grams?: InputMaybe<Scalars['numeric']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "meal_ingredients" */
export type MealIngredients_Insert_Input = {
  food?: InputMaybe<Foods_Obj_Rel_Insert_Input>;
  foodId?: InputMaybe<Scalars['uuid']['input']>;
  grams?: InputMaybe<Scalars['numeric']['input']>;
  meal?: InputMaybe<Meals_Obj_Rel_Insert_Input>;
  mealId?: InputMaybe<Scalars['uuid']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
};

/** aggregate max on columns */
export type MealIngredients_Max_Fields = {
  __typename?: 'mealIngredients_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  foodId?: Maybe<Scalars['uuid']['output']>;
  grams?: Maybe<Scalars['numeric']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  mealId?: Maybe<Scalars['uuid']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by max() on columns of table "meal_ingredients" */
export type MealIngredients_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  foodId?: InputMaybe<Order_By>;
  grams?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  mealId?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type MealIngredients_Min_Fields = {
  __typename?: 'mealIngredients_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  foodId?: Maybe<Scalars['uuid']['output']>;
  grams?: Maybe<Scalars['numeric']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  mealId?: Maybe<Scalars['uuid']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by min() on columns of table "meal_ingredients" */
export type MealIngredients_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  foodId?: InputMaybe<Order_By>;
  grams?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  mealId?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "meal_ingredients" */
export type MealIngredients_Mutation_Response = {
  __typename?: 'mealIngredients_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<MealIngredients>;
};

/** on_conflict condition type for table "meal_ingredients" */
export type MealIngredients_On_Conflict = {
  constraint: MealIngredients_Constraint;
  update_columns?: Array<MealIngredients_Update_Column>;
  where?: InputMaybe<MealIngredients_Bool_Exp>;
};

/** Ordering options when selecting data from "meal_ingredients". */
export type MealIngredients_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  food?: InputMaybe<Foods_Order_By>;
  foodId?: InputMaybe<Order_By>;
  grams?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  meal?: InputMaybe<Meals_Order_By>;
  mealId?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** primary key columns input for table: meal_ingredients */
export type MealIngredients_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "meal_ingredients" */
export enum MealIngredients_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  FoodId = 'foodId',
  /** column name */
  Grams = 'grams',
  /** column name */
  Id = 'id',
  /** column name */
  MealId = 'mealId',
  /** column name */
  Position = 'position',
  /** column name */
  UpdatedAt = 'updatedAt'
}

/** input type for updating data in table "meal_ingredients" */
export type MealIngredients_Set_Input = {
  grams?: InputMaybe<Scalars['numeric']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
};

/** aggregate stddev on columns */
export type MealIngredients_Stddev_Fields = {
  __typename?: 'mealIngredients_stddev_fields';
  grams?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "meal_ingredients" */
export type MealIngredients_Stddev_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type MealIngredients_Stddev_Pop_Fields = {
  __typename?: 'mealIngredients_stddev_pop_fields';
  grams?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "meal_ingredients" */
export type MealIngredients_Stddev_Pop_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type MealIngredients_Stddev_Samp_Fields = {
  __typename?: 'mealIngredients_stddev_samp_fields';
  grams?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "meal_ingredients" */
export type MealIngredients_Stddev_Samp_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "mealIngredients" */
export type MealIngredients_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: MealIngredients_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type MealIngredients_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  foodId?: InputMaybe<Scalars['uuid']['input']>;
  grams?: InputMaybe<Scalars['numeric']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  mealId?: InputMaybe<Scalars['uuid']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate sum on columns */
export type MealIngredients_Sum_Fields = {
  __typename?: 'mealIngredients_sum_fields';
  grams?: Maybe<Scalars['numeric']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
};

/** order by sum() on columns of table "meal_ingredients" */
export type MealIngredients_Sum_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
};

/** update columns of table "meal_ingredients" */
export enum MealIngredients_Update_Column {
  /** column name */
  Grams = 'grams',
  /** column name */
  Position = 'position'
}

export type MealIngredients_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<MealIngredients_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<MealIngredients_Set_Input>;
  /** filter the rows which have to be updated */
  where: MealIngredients_Bool_Exp;
};

/** aggregate var_pop on columns */
export type MealIngredients_Var_Pop_Fields = {
  __typename?: 'mealIngredients_var_pop_fields';
  grams?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "meal_ingredients" */
export type MealIngredients_Var_Pop_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type MealIngredients_Var_Samp_Fields = {
  __typename?: 'mealIngredients_var_samp_fields';
  grams?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "meal_ingredients" */
export type MealIngredients_Var_Samp_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type MealIngredients_Variance_Fields = {
  __typename?: 'mealIngredients_variance_fields';
  grams?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "meal_ingredients" */
export type MealIngredients_Variance_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
};

/** columns and relationships of "meals" */
export type Meals = {
  __typename?: 'meals';
  createdAt: Scalars['timestamptz']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['uuid']['output'];
  /** An array relationship */
  mealIngredients: Array<MealIngredients>;
  /** An aggregate relationship */
  mealIngredients_aggregate: MealIngredients_Aggregate;
  name: Scalars['String']['output'];
  /** An array relationship */
  nutritionLogMeals: Array<NutritionLogMeals>;
  /** An aggregate relationship */
  nutritionLogMeals_aggregate: NutritionLogMeals_Aggregate;
  /** An array relationship */
  nutritionPlanMeals: Array<NutritionPlanMeals>;
  /** An aggregate relationship */
  nutritionPlanMeals_aggregate: NutritionPlanMeals_Aggregate;
  updatedAt: Scalars['timestamptz']['output'];
  userId: Scalars['uuid']['output'];
};


/** columns and relationships of "meals" */
export type MealsMealIngredientsArgs = {
  distinct_on?: InputMaybe<Array<MealIngredients_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<MealIngredients_Order_By>>;
  where?: InputMaybe<MealIngredients_Bool_Exp>;
};


/** columns and relationships of "meals" */
export type MealsMealIngredients_AggregateArgs = {
  distinct_on?: InputMaybe<Array<MealIngredients_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<MealIngredients_Order_By>>;
  where?: InputMaybe<MealIngredients_Bool_Exp>;
};


/** columns and relationships of "meals" */
export type MealsNutritionLogMealsArgs = {
  distinct_on?: InputMaybe<Array<NutritionLogMeals_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionLogMeals_Order_By>>;
  where?: InputMaybe<NutritionLogMeals_Bool_Exp>;
};


/** columns and relationships of "meals" */
export type MealsNutritionLogMeals_AggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionLogMeals_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionLogMeals_Order_By>>;
  where?: InputMaybe<NutritionLogMeals_Bool_Exp>;
};


/** columns and relationships of "meals" */
export type MealsNutritionPlanMealsArgs = {
  distinct_on?: InputMaybe<Array<NutritionPlanMeals_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionPlanMeals_Order_By>>;
  where?: InputMaybe<NutritionPlanMeals_Bool_Exp>;
};


/** columns and relationships of "meals" */
export type MealsNutritionPlanMeals_AggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionPlanMeals_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionPlanMeals_Order_By>>;
  where?: InputMaybe<NutritionPlanMeals_Bool_Exp>;
};

/** aggregated selection of "meals" */
export type Meals_Aggregate = {
  __typename?: 'meals_aggregate';
  aggregate?: Maybe<Meals_Aggregate_Fields>;
  nodes: Array<Meals>;
};

/** aggregate fields of "meals" */
export type Meals_Aggregate_Fields = {
  __typename?: 'meals_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<Meals_Max_Fields>;
  min?: Maybe<Meals_Min_Fields>;
};


/** aggregate fields of "meals" */
export type Meals_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<Meals_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "meals". All fields are combined with a logical 'AND'. */
export type Meals_Bool_Exp = {
  _and?: InputMaybe<Array<Meals_Bool_Exp>>;
  _not?: InputMaybe<Meals_Bool_Exp>;
  _or?: InputMaybe<Array<Meals_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  description?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  mealIngredients?: InputMaybe<MealIngredients_Bool_Exp>;
  mealIngredients_aggregate?: InputMaybe<MealIngredients_Aggregate_Bool_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  nutritionLogMeals?: InputMaybe<NutritionLogMeals_Bool_Exp>;
  nutritionLogMeals_aggregate?: InputMaybe<NutritionLogMeals_Aggregate_Bool_Exp>;
  nutritionPlanMeals?: InputMaybe<NutritionPlanMeals_Bool_Exp>;
  nutritionPlanMeals_aggregate?: InputMaybe<NutritionPlanMeals_Aggregate_Bool_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  userId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "meals" */
export enum Meals_Constraint {
  /** unique or primary key constraint on columns "id" */
  MealsPkey = 'meals_pkey',
  /** unique or primary key constraint on columns "user_id", "name" */
  MealsUserNameUq = 'meals_user_name_uq'
}

/** input type for inserting data into table "meals" */
export type Meals_Insert_Input = {
  description?: InputMaybe<Scalars['String']['input']>;
  mealIngredients?: InputMaybe<MealIngredients_Arr_Rel_Insert_Input>;
  name?: InputMaybe<Scalars['String']['input']>;
  nutritionLogMeals?: InputMaybe<NutritionLogMeals_Arr_Rel_Insert_Input>;
  nutritionPlanMeals?: InputMaybe<NutritionPlanMeals_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type Meals_Max_Fields = {
  __typename?: 'meals_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
};

/** aggregate min on columns */
export type Meals_Min_Fields = {
  __typename?: 'meals_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
};

/** response of any mutation on the table "meals" */
export type Meals_Mutation_Response = {
  __typename?: 'meals_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<Meals>;
};

/** input type for inserting object relation for remote table "meals" */
export type Meals_Obj_Rel_Insert_Input = {
  data: Meals_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<Meals_On_Conflict>;
};

/** on_conflict condition type for table "meals" */
export type Meals_On_Conflict = {
  constraint: Meals_Constraint;
  update_columns?: Array<Meals_Update_Column>;
  where?: InputMaybe<Meals_Bool_Exp>;
};

/** Ordering options when selecting data from "meals". */
export type Meals_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  mealIngredients_aggregate?: InputMaybe<MealIngredients_Aggregate_Order_By>;
  name?: InputMaybe<Order_By>;
  nutritionLogMeals_aggregate?: InputMaybe<NutritionLogMeals_Aggregate_Order_By>;
  nutritionPlanMeals_aggregate?: InputMaybe<NutritionPlanMeals_Aggregate_Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: meals */
export type Meals_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "meals" */
export enum Meals_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Description = 'description',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UserId = 'userId'
}

/** input type for updating data in table "meals" */
export type Meals_Set_Input = {
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

/** Streaming cursor of the table "meals" */
export type Meals_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: Meals_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type Meals_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
  userId?: InputMaybe<Scalars['uuid']['input']>;
};

/** update columns of table "meals" */
export enum Meals_Update_Column {
  /** column name */
  Description = 'description',
  /** column name */
  Name = 'name'
}

export type Meals_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<Meals_Set_Input>;
  /** filter the rows which have to be updated */
  where: Meals_Bool_Exp;
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
  /** delete data from the table: "daily_energy" */
  deleteDailyEnergyEntries?: Maybe<DailyEnergy_Mutation_Response>;
  /** delete single row from the table: "daily_energy" */
  deleteDailyEnergyEntry?: Maybe<DailyEnergy>;
  /** delete single row from the table: "exercises" */
  deleteExercise?: Maybe<Exercises>;
  /** delete data from the table: "exercises" */
  deleteExercises?: Maybe<Exercises_Mutation_Response>;
  /** delete single row from the table: "foods" */
  deleteFood?: Maybe<Foods>;
  /** delete data from the table: "foods" */
  deleteFoods?: Maybe<Foods_Mutation_Response>;
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
  /** delete single row from the table: "meals" */
  deleteMeal?: Maybe<Meals>;
  /** delete single row from the table: "meal_ingredients" */
  deleteMealIngredient?: Maybe<MealIngredients>;
  /** delete data from the table: "meal_ingredients" */
  deleteMealIngredients?: Maybe<MealIngredients_Mutation_Response>;
  /** delete data from the table: "meals" */
  deleteMeals?: Maybe<Meals_Mutation_Response>;
  /** delete single row from the table: "nutrition_days" */
  deleteNutritionDay?: Maybe<NutritionDays>;
  /** delete data from the table: "nutrition_days" */
  deleteNutritionDays?: Maybe<NutritionDays_Mutation_Response>;
  /** delete data from the table: "nutrition_log_entries" */
  deleteNutritionLogEntries?: Maybe<NutritionLogEntries_Mutation_Response>;
  /** delete single row from the table: "nutrition_log_entries" */
  deleteNutritionLogEntry?: Maybe<NutritionLogEntries>;
  /** delete single row from the table: "nutrition_log_meals" */
  deleteNutritionLogMeal?: Maybe<NutritionLogMeals>;
  /** delete data from the table: "nutrition_log_meals" */
  deleteNutritionLogMeals?: Maybe<NutritionLogMeals_Mutation_Response>;
  /** delete single row from the table: "nutrition_plans" */
  deleteNutritionPlan?: Maybe<NutritionPlans>;
  /** delete single row from the table: "nutrition_plan_foods" */
  deleteNutritionPlanFood?: Maybe<NutritionPlanFoods>;
  /** delete data from the table: "nutrition_plan_foods" */
  deleteNutritionPlanFoods?: Maybe<NutritionPlanFoods_Mutation_Response>;
  /** delete single row from the table: "nutrition_plan_meals" */
  deleteNutritionPlanMeal?: Maybe<NutritionPlanMeals>;
  /** delete data from the table: "nutrition_plan_meals" */
  deleteNutritionPlanMeals?: Maybe<NutritionPlanMeals_Mutation_Response>;
  /** delete data from the table: "nutrition_plans" */
  deleteNutritionPlans?: Maybe<NutritionPlans_Mutation_Response>;
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
  /** delete single row from the table: "workout_session_strength_sets" */
  deleteWorkoutSessionStrengthSet?: Maybe<WorkoutSessionStrengthSets>;
  /** delete data from the table: "workout_session_strength_sets" */
  deleteWorkoutSessionStrengthSets?: Maybe<WorkoutSessionStrengthSets_Mutation_Response>;
  /** delete data from the table: "workout_sessions" */
  deleteWorkoutSessions?: Maybe<WorkoutSessions_Mutation_Response>;
  /** delete data from the table: "workouts" */
  deleteWorkouts?: Maybe<Workouts_Mutation_Response>;
  /** insert a single row into the table: "body_measurements" */
  insertBodyMeasurement?: Maybe<BodyMeasurements>;
  /** insert data into the table: "body_measurements" */
  insertBodyMeasurements?: Maybe<BodyMeasurements_Mutation_Response>;
  /** insert data into the table: "daily_energy" */
  insertDailyEnergyEntries?: Maybe<DailyEnergy_Mutation_Response>;
  /** insert a single row into the table: "daily_energy" */
  insertDailyEnergyEntry?: Maybe<DailyEnergy>;
  /** insert a single row into the table: "exercises" */
  insertExercise?: Maybe<Exercises>;
  /** insert a single row into the table: "exercises_cardio" */
  insertExerciseCardio?: Maybe<ExercisesCardio>;
  /** insert a single row into the table: "exercises_strength" */
  insertExerciseStrength?: Maybe<ExercisesStrength>;
  /** insert data into the table: "exercises" */
  insertExercises?: Maybe<Exercises_Mutation_Response>;
  /** insert data into the table: "exercises_cardio" */
  insertExercisesCardio?: Maybe<ExercisesCardio_Mutation_Response>;
  /** insert data into the table: "exercises_strength" */
  insertExercisesStrength?: Maybe<ExercisesStrength_Mutation_Response>;
  /** insert a single row into the table: "foods" */
  insertFood?: Maybe<Foods>;
  /** insert data into the table: "foods" */
  insertFoods?: Maybe<Foods_Mutation_Response>;
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
  /** insert a single row into the table: "meals" */
  insertMeal?: Maybe<Meals>;
  /** insert a single row into the table: "meal_ingredients" */
  insertMealIngredient?: Maybe<MealIngredients>;
  /** insert data into the table: "meal_ingredients" */
  insertMealIngredients?: Maybe<MealIngredients_Mutation_Response>;
  /** insert data into the table: "meals" */
  insertMeals?: Maybe<Meals_Mutation_Response>;
  /** insert a single row into the table: "nutrition_days" */
  insertNutritionDay?: Maybe<NutritionDays>;
  /** insert data into the table: "nutrition_days" */
  insertNutritionDays?: Maybe<NutritionDays_Mutation_Response>;
  /** insert data into the table: "nutrition_log_entries" */
  insertNutritionLogEntries?: Maybe<NutritionLogEntries_Mutation_Response>;
  /** insert a single row into the table: "nutrition_log_entries" */
  insertNutritionLogEntry?: Maybe<NutritionLogEntries>;
  /** insert a single row into the table: "nutrition_log_meals" */
  insertNutritionLogMeal?: Maybe<NutritionLogMeals>;
  /** insert data into the table: "nutrition_log_meals" */
  insertNutritionLogMeals?: Maybe<NutritionLogMeals_Mutation_Response>;
  /** insert a single row into the table: "nutrition_plans" */
  insertNutritionPlan?: Maybe<NutritionPlans>;
  /** insert a single row into the table: "nutrition_plan_foods" */
  insertNutritionPlanFood?: Maybe<NutritionPlanFoods>;
  /** insert data into the table: "nutrition_plan_foods" */
  insertNutritionPlanFoods?: Maybe<NutritionPlanFoods_Mutation_Response>;
  /** insert a single row into the table: "nutrition_plan_meals" */
  insertNutritionPlanMeal?: Maybe<NutritionPlanMeals>;
  /** insert data into the table: "nutrition_plan_meals" */
  insertNutritionPlanMeals?: Maybe<NutritionPlanMeals_Mutation_Response>;
  /** insert data into the table: "nutrition_plans" */
  insertNutritionPlans?: Maybe<NutritionPlans_Mutation_Response>;
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
  /** insert a single row into the table: "workout_session_strength_sets" */
  insertWorkoutSessionStrengthSet?: Maybe<WorkoutSessionStrengthSets>;
  /** insert data into the table: "workout_session_strength_sets" */
  insertWorkoutSessionStrengthSets?: Maybe<WorkoutSessionStrengthSets_Mutation_Response>;
  /** insert data into the table: "workout_sessions" */
  insertWorkoutSessions?: Maybe<WorkoutSessions_Mutation_Response>;
  /** insert data into the table: "workouts" */
  insertWorkouts?: Maybe<Workouts_Mutation_Response>;
  /** update single row of the table: "body_measurements" */
  updateBodyMeasurement?: Maybe<BodyMeasurements>;
  /** update data of the table: "body_measurements" */
  updateBodyMeasurements?: Maybe<BodyMeasurements_Mutation_Response>;
  /** update data of the table: "daily_energy" */
  updateDailyEnergyEntries?: Maybe<DailyEnergy_Mutation_Response>;
  /** update single row of the table: "daily_energy" */
  updateDailyEnergyEntry?: Maybe<DailyEnergy>;
  /** update single row of the table: "exercises" */
  updateExercise?: Maybe<Exercises>;
  /** update single row of the table: "exercises_cardio" */
  updateExerciseCardio?: Maybe<ExercisesCardio>;
  /** update single row of the table: "exercises_strength" */
  updateExerciseStrength?: Maybe<ExercisesStrength>;
  /** update data of the table: "exercises" */
  updateExercises?: Maybe<Exercises_Mutation_Response>;
  /** update data of the table: "exercises_cardio" */
  updateExercisesCardio?: Maybe<ExercisesCardio_Mutation_Response>;
  /** update data of the table: "exercises_strength" */
  updateExercisesStrength?: Maybe<ExercisesStrength_Mutation_Response>;
  /** update single row of the table: "foods" */
  updateFood?: Maybe<Foods>;
  /** update data of the table: "foods" */
  updateFoods?: Maybe<Foods_Mutation_Response>;
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
  /** update single row of the table: "meals" */
  updateMeal?: Maybe<Meals>;
  /** update single row of the table: "meal_ingredients" */
  updateMealIngredient?: Maybe<MealIngredients>;
  /** update data of the table: "meal_ingredients" */
  updateMealIngredients?: Maybe<MealIngredients_Mutation_Response>;
  /** update data of the table: "meals" */
  updateMeals?: Maybe<Meals_Mutation_Response>;
  /** update single row of the table: "nutrition_days" */
  updateNutritionDay?: Maybe<NutritionDays>;
  /** update data of the table: "nutrition_days" */
  updateNutritionDays?: Maybe<NutritionDays_Mutation_Response>;
  /** update data of the table: "nutrition_log_entries" */
  updateNutritionLogEntries?: Maybe<NutritionLogEntries_Mutation_Response>;
  /** update single row of the table: "nutrition_log_entries" */
  updateNutritionLogEntry?: Maybe<NutritionLogEntries>;
  /** update single row of the table: "nutrition_log_meals" */
  updateNutritionLogMeal?: Maybe<NutritionLogMeals>;
  /** update data of the table: "nutrition_log_meals" */
  updateNutritionLogMeals?: Maybe<NutritionLogMeals_Mutation_Response>;
  /** update single row of the table: "nutrition_plans" */
  updateNutritionPlan?: Maybe<NutritionPlans>;
  /** update single row of the table: "nutrition_plan_foods" */
  updateNutritionPlanFood?: Maybe<NutritionPlanFoods>;
  /** update data of the table: "nutrition_plan_foods" */
  updateNutritionPlanFoods?: Maybe<NutritionPlanFoods_Mutation_Response>;
  /** update single row of the table: "nutrition_plan_meals" */
  updateNutritionPlanMeal?: Maybe<NutritionPlanMeals>;
  /** update data of the table: "nutrition_plan_meals" */
  updateNutritionPlanMeals?: Maybe<NutritionPlanMeals_Mutation_Response>;
  /** update data of the table: "nutrition_plans" */
  updateNutritionPlans?: Maybe<NutritionPlans_Mutation_Response>;
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
  /** update single row of the table: "workout_session_strength_sets" */
  updateWorkoutSessionStrengthSet?: Maybe<WorkoutSessionStrengthSets>;
  /** update data of the table: "workout_session_strength_sets" */
  updateWorkoutSessionStrengthSets?: Maybe<WorkoutSessionStrengthSets_Mutation_Response>;
  /** update data of the table: "workout_sessions" */
  updateWorkoutSessions?: Maybe<WorkoutSessions_Mutation_Response>;
  /** update data of the table: "workouts" */
  updateWorkouts?: Maybe<Workouts_Mutation_Response>;
  /** update multiples rows of table: "body_measurements" */
  update_bodyMeasurements_many?: Maybe<Array<Maybe<BodyMeasurements_Mutation_Response>>>;
  /** update multiples rows of table: "daily_energy" */
  update_dailyEnergy_many?: Maybe<Array<Maybe<DailyEnergy_Mutation_Response>>>;
  /** update multiples rows of table: "exercises_cardio" */
  update_exercisesCardio_many?: Maybe<Array<Maybe<ExercisesCardio_Mutation_Response>>>;
  /** update multiples rows of table: "exercises_strength" */
  update_exercisesStrength_many?: Maybe<Array<Maybe<ExercisesStrength_Mutation_Response>>>;
  /** update multiples rows of table: "exercises" */
  update_exercises_many?: Maybe<Array<Maybe<Exercises_Mutation_Response>>>;
  /** update multiples rows of table: "foods" */
  update_foods_many?: Maybe<Array<Maybe<Foods_Mutation_Response>>>;
  /** update multiples rows of table: "journal_entries" */
  update_journalEntries_many?: Maybe<Array<Maybe<JournalEntries_Mutation_Response>>>;
  /** update multiples rows of table: "journal_labels" */
  update_journalLabels_many?: Maybe<Array<Maybe<JournalLabels_Mutation_Response>>>;
  /** update multiples rows of table: "labels" */
  update_labels_many?: Maybe<Array<Maybe<Labels_Mutation_Response>>>;
  /** update multiples rows of table: "meal_ingredients" */
  update_mealIngredients_many?: Maybe<Array<Maybe<MealIngredients_Mutation_Response>>>;
  /** update multiples rows of table: "meals" */
  update_meals_many?: Maybe<Array<Maybe<Meals_Mutation_Response>>>;
  /** update multiples rows of table: "nutrition_days" */
  update_nutritionDays_many?: Maybe<Array<Maybe<NutritionDays_Mutation_Response>>>;
  /** update multiples rows of table: "nutrition_log_entries" */
  update_nutritionLogEntries_many?: Maybe<Array<Maybe<NutritionLogEntries_Mutation_Response>>>;
  /** update multiples rows of table: "nutrition_log_meals" */
  update_nutritionLogMeals_many?: Maybe<Array<Maybe<NutritionLogMeals_Mutation_Response>>>;
  /** update multiples rows of table: "nutrition_plan_foods" */
  update_nutritionPlanFoods_many?: Maybe<Array<Maybe<NutritionPlanFoods_Mutation_Response>>>;
  /** update multiples rows of table: "nutrition_plan_meals" */
  update_nutritionPlanMeals_many?: Maybe<Array<Maybe<NutritionPlanMeals_Mutation_Response>>>;
  /** update multiples rows of table: "nutrition_plans" */
  update_nutritionPlans_many?: Maybe<Array<Maybe<NutritionPlans_Mutation_Response>>>;
  /** update multiples rows of table: "workout_exercises" */
  update_workoutExercises_many?: Maybe<Array<Maybe<WorkoutExercises_Mutation_Response>>>;
  /** update multiples rows of table: "workout_session_cardio_entries" */
  update_workoutSessionCardioEntries_many?: Maybe<Array<Maybe<WorkoutSessionCardioEntries_Mutation_Response>>>;
  /** update multiples rows of table: "workout_session_exercises" */
  update_workoutSessionExercises_many?: Maybe<Array<Maybe<WorkoutSessionExercises_Mutation_Response>>>;
  /** update multiples rows of table: "workout_session_strength_sets" */
  update_workoutSessionStrengthSets_many?: Maybe<Array<Maybe<WorkoutSessionStrengthSets_Mutation_Response>>>;
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
export type Mutation_RootDeleteDailyEnergyEntriesArgs = {
  where: DailyEnergy_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteDailyEnergyEntryArgs = {
  id: Scalars['uuid']['input'];
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
export type Mutation_RootDeleteFoodArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteFoodsArgs = {
  where: Foods_Bool_Exp;
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
export type Mutation_RootDeleteMealArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteMealIngredientArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteMealIngredientsArgs = {
  where: MealIngredients_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteMealsArgs = {
  where: Meals_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteNutritionDayArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteNutritionDaysArgs = {
  where: NutritionDays_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteNutritionLogEntriesArgs = {
  where: NutritionLogEntries_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteNutritionLogEntryArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteNutritionLogMealArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteNutritionLogMealsArgs = {
  where: NutritionLogMeals_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteNutritionPlanArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteNutritionPlanFoodArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteNutritionPlanFoodsArgs = {
  where: NutritionPlanFoods_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteNutritionPlanMealArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteNutritionPlanMealsArgs = {
  where: NutritionPlanMeals_Bool_Exp;
};


/** mutation root */
export type Mutation_RootDeleteNutritionPlansArgs = {
  where: NutritionPlans_Bool_Exp;
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
export type Mutation_RootDeleteWorkoutSessionStrengthSetArgs = {
  id: Scalars['uuid']['input'];
};


/** mutation root */
export type Mutation_RootDeleteWorkoutSessionStrengthSetsArgs = {
  where: WorkoutSessionStrengthSets_Bool_Exp;
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
export type Mutation_RootInsertDailyEnergyEntriesArgs = {
  objects: Array<DailyEnergy_Insert_Input>;
  on_conflict?: InputMaybe<DailyEnergy_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertDailyEnergyEntryArgs = {
  object: DailyEnergy_Insert_Input;
  on_conflict?: InputMaybe<DailyEnergy_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertExerciseArgs = {
  object: Exercises_Insert_Input;
  on_conflict?: InputMaybe<Exercises_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertExerciseCardioArgs = {
  object: ExercisesCardio_Insert_Input;
  on_conflict?: InputMaybe<ExercisesCardio_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertExerciseStrengthArgs = {
  object: ExercisesStrength_Insert_Input;
  on_conflict?: InputMaybe<ExercisesStrength_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertExercisesArgs = {
  objects: Array<Exercises_Insert_Input>;
  on_conflict?: InputMaybe<Exercises_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertExercisesCardioArgs = {
  objects: Array<ExercisesCardio_Insert_Input>;
  on_conflict?: InputMaybe<ExercisesCardio_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertExercisesStrengthArgs = {
  objects: Array<ExercisesStrength_Insert_Input>;
  on_conflict?: InputMaybe<ExercisesStrength_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertFoodArgs = {
  object: Foods_Insert_Input;
  on_conflict?: InputMaybe<Foods_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertFoodsArgs = {
  objects: Array<Foods_Insert_Input>;
  on_conflict?: InputMaybe<Foods_On_Conflict>;
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
export type Mutation_RootInsertMealArgs = {
  object: Meals_Insert_Input;
  on_conflict?: InputMaybe<Meals_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertMealIngredientArgs = {
  object: MealIngredients_Insert_Input;
  on_conflict?: InputMaybe<MealIngredients_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertMealIngredientsArgs = {
  objects: Array<MealIngredients_Insert_Input>;
  on_conflict?: InputMaybe<MealIngredients_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertMealsArgs = {
  objects: Array<Meals_Insert_Input>;
  on_conflict?: InputMaybe<Meals_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertNutritionDayArgs = {
  object: NutritionDays_Insert_Input;
  on_conflict?: InputMaybe<NutritionDays_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertNutritionDaysArgs = {
  objects: Array<NutritionDays_Insert_Input>;
  on_conflict?: InputMaybe<NutritionDays_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertNutritionLogEntriesArgs = {
  objects: Array<NutritionLogEntries_Insert_Input>;
  on_conflict?: InputMaybe<NutritionLogEntries_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertNutritionLogEntryArgs = {
  object: NutritionLogEntries_Insert_Input;
  on_conflict?: InputMaybe<NutritionLogEntries_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertNutritionLogMealArgs = {
  object: NutritionLogMeals_Insert_Input;
  on_conflict?: InputMaybe<NutritionLogMeals_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertNutritionLogMealsArgs = {
  objects: Array<NutritionLogMeals_Insert_Input>;
  on_conflict?: InputMaybe<NutritionLogMeals_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertNutritionPlanArgs = {
  object: NutritionPlans_Insert_Input;
  on_conflict?: InputMaybe<NutritionPlans_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertNutritionPlanFoodArgs = {
  object: NutritionPlanFoods_Insert_Input;
  on_conflict?: InputMaybe<NutritionPlanFoods_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertNutritionPlanFoodsArgs = {
  objects: Array<NutritionPlanFoods_Insert_Input>;
  on_conflict?: InputMaybe<NutritionPlanFoods_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertNutritionPlanMealArgs = {
  object: NutritionPlanMeals_Insert_Input;
  on_conflict?: InputMaybe<NutritionPlanMeals_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertNutritionPlanMealsArgs = {
  objects: Array<NutritionPlanMeals_Insert_Input>;
  on_conflict?: InputMaybe<NutritionPlanMeals_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertNutritionPlansArgs = {
  objects: Array<NutritionPlans_Insert_Input>;
  on_conflict?: InputMaybe<NutritionPlans_On_Conflict>;
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
export type Mutation_RootInsertWorkoutSessionStrengthSetArgs = {
  object: WorkoutSessionStrengthSets_Insert_Input;
  on_conflict?: InputMaybe<WorkoutSessionStrengthSets_On_Conflict>;
};


/** mutation root */
export type Mutation_RootInsertWorkoutSessionStrengthSetsArgs = {
  objects: Array<WorkoutSessionStrengthSets_Insert_Input>;
  on_conflict?: InputMaybe<WorkoutSessionStrengthSets_On_Conflict>;
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
export type Mutation_RootUpdateDailyEnergyEntriesArgs = {
  _inc?: InputMaybe<DailyEnergy_Inc_Input>;
  _set?: InputMaybe<DailyEnergy_Set_Input>;
  where: DailyEnergy_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateDailyEnergyEntryArgs = {
  _inc?: InputMaybe<DailyEnergy_Inc_Input>;
  _set?: InputMaybe<DailyEnergy_Set_Input>;
  pk_columns: DailyEnergy_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateExerciseArgs = {
  _set?: InputMaybe<Exercises_Set_Input>;
  pk_columns: Exercises_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateExerciseCardioArgs = {
  _append?: InputMaybe<ExercisesCardio_Append_Input>;
  _delete_at_path?: InputMaybe<ExercisesCardio_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<ExercisesCardio_Delete_Elem_Input>;
  _delete_key?: InputMaybe<ExercisesCardio_Delete_Key_Input>;
  _prepend?: InputMaybe<ExercisesCardio_Prepend_Input>;
  _set?: InputMaybe<ExercisesCardio_Set_Input>;
  pk_columns: ExercisesCardio_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateExerciseStrengthArgs = {
  _set?: InputMaybe<ExercisesStrength_Set_Input>;
  pk_columns: ExercisesStrength_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateExercisesArgs = {
  _set?: InputMaybe<Exercises_Set_Input>;
  where: Exercises_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateExercisesCardioArgs = {
  _append?: InputMaybe<ExercisesCardio_Append_Input>;
  _delete_at_path?: InputMaybe<ExercisesCardio_Delete_At_Path_Input>;
  _delete_elem?: InputMaybe<ExercisesCardio_Delete_Elem_Input>;
  _delete_key?: InputMaybe<ExercisesCardio_Delete_Key_Input>;
  _prepend?: InputMaybe<ExercisesCardio_Prepend_Input>;
  _set?: InputMaybe<ExercisesCardio_Set_Input>;
  where: ExercisesCardio_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateExercisesStrengthArgs = {
  _set?: InputMaybe<ExercisesStrength_Set_Input>;
  where: ExercisesStrength_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateFoodArgs = {
  _inc?: InputMaybe<Foods_Inc_Input>;
  _set?: InputMaybe<Foods_Set_Input>;
  pk_columns: Foods_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateFoodsArgs = {
  _inc?: InputMaybe<Foods_Inc_Input>;
  _set?: InputMaybe<Foods_Set_Input>;
  where: Foods_Bool_Exp;
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
export type Mutation_RootUpdateMealArgs = {
  _set?: InputMaybe<Meals_Set_Input>;
  pk_columns: Meals_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateMealIngredientArgs = {
  _inc?: InputMaybe<MealIngredients_Inc_Input>;
  _set?: InputMaybe<MealIngredients_Set_Input>;
  pk_columns: MealIngredients_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateMealIngredientsArgs = {
  _inc?: InputMaybe<MealIngredients_Inc_Input>;
  _set?: InputMaybe<MealIngredients_Set_Input>;
  where: MealIngredients_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateMealsArgs = {
  _set?: InputMaybe<Meals_Set_Input>;
  where: Meals_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateNutritionDayArgs = {
  _set?: InputMaybe<NutritionDays_Set_Input>;
  pk_columns: NutritionDays_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateNutritionDaysArgs = {
  _set?: InputMaybe<NutritionDays_Set_Input>;
  where: NutritionDays_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateNutritionLogEntriesArgs = {
  _inc?: InputMaybe<NutritionLogEntries_Inc_Input>;
  _set?: InputMaybe<NutritionLogEntries_Set_Input>;
  where: NutritionLogEntries_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateNutritionLogEntryArgs = {
  _inc?: InputMaybe<NutritionLogEntries_Inc_Input>;
  _set?: InputMaybe<NutritionLogEntries_Set_Input>;
  pk_columns: NutritionLogEntries_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateNutritionLogMealArgs = {
  _inc?: InputMaybe<NutritionLogMeals_Inc_Input>;
  _set?: InputMaybe<NutritionLogMeals_Set_Input>;
  pk_columns: NutritionLogMeals_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateNutritionLogMealsArgs = {
  _inc?: InputMaybe<NutritionLogMeals_Inc_Input>;
  _set?: InputMaybe<NutritionLogMeals_Set_Input>;
  where: NutritionLogMeals_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateNutritionPlanArgs = {
  _set?: InputMaybe<NutritionPlans_Set_Input>;
  pk_columns: NutritionPlans_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateNutritionPlanFoodArgs = {
  _inc?: InputMaybe<NutritionPlanFoods_Inc_Input>;
  _set?: InputMaybe<NutritionPlanFoods_Set_Input>;
  pk_columns: NutritionPlanFoods_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateNutritionPlanFoodsArgs = {
  _inc?: InputMaybe<NutritionPlanFoods_Inc_Input>;
  _set?: InputMaybe<NutritionPlanFoods_Set_Input>;
  where: NutritionPlanFoods_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateNutritionPlanMealArgs = {
  _inc?: InputMaybe<NutritionPlanMeals_Inc_Input>;
  _set?: InputMaybe<NutritionPlanMeals_Set_Input>;
  pk_columns: NutritionPlanMeals_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateNutritionPlanMealsArgs = {
  _inc?: InputMaybe<NutritionPlanMeals_Inc_Input>;
  _set?: InputMaybe<NutritionPlanMeals_Set_Input>;
  where: NutritionPlanMeals_Bool_Exp;
};


/** mutation root */
export type Mutation_RootUpdateNutritionPlansArgs = {
  _set?: InputMaybe<NutritionPlans_Set_Input>;
  where: NutritionPlans_Bool_Exp;
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
export type Mutation_RootUpdateWorkoutSessionStrengthSetArgs = {
  _inc?: InputMaybe<WorkoutSessionStrengthSets_Inc_Input>;
  _set?: InputMaybe<WorkoutSessionStrengthSets_Set_Input>;
  pk_columns: WorkoutSessionStrengthSets_Pk_Columns_Input;
};


/** mutation root */
export type Mutation_RootUpdateWorkoutSessionStrengthSetsArgs = {
  _inc?: InputMaybe<WorkoutSessionStrengthSets_Inc_Input>;
  _set?: InputMaybe<WorkoutSessionStrengthSets_Set_Input>;
  where: WorkoutSessionStrengthSets_Bool_Exp;
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
export type Mutation_RootUpdate_DailyEnergy_ManyArgs = {
  updates: Array<DailyEnergy_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_ExercisesCardio_ManyArgs = {
  updates: Array<ExercisesCardio_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_ExercisesStrength_ManyArgs = {
  updates: Array<ExercisesStrength_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Exercises_ManyArgs = {
  updates: Array<Exercises_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Foods_ManyArgs = {
  updates: Array<Foods_Updates>;
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
export type Mutation_RootUpdate_MealIngredients_ManyArgs = {
  updates: Array<MealIngredients_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_Meals_ManyArgs = {
  updates: Array<Meals_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_NutritionDays_ManyArgs = {
  updates: Array<NutritionDays_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_NutritionLogEntries_ManyArgs = {
  updates: Array<NutritionLogEntries_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_NutritionLogMeals_ManyArgs = {
  updates: Array<NutritionLogMeals_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_NutritionPlanFoods_ManyArgs = {
  updates: Array<NutritionPlanFoods_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_NutritionPlanMeals_ManyArgs = {
  updates: Array<NutritionPlanMeals_Updates>;
};


/** mutation root */
export type Mutation_RootUpdate_NutritionPlans_ManyArgs = {
  updates: Array<NutritionPlans_Updates>;
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
export type Mutation_RootUpdate_WorkoutSessionStrengthSets_ManyArgs = {
  updates: Array<WorkoutSessionStrengthSets_Updates>;
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

/** columns and relationships of "nutrition_days" */
export type NutritionDays = {
  __typename?: 'nutritionDays';
  createdAt: Scalars['timestamptz']['output'];
  id: Scalars['uuid']['output'];
  logDate: Scalars['date']['output'];
  /** An array relationship */
  nutritionLogEntries: Array<NutritionLogEntries>;
  /** An aggregate relationship */
  nutritionLogEntries_aggregate: NutritionLogEntries_Aggregate;
  /** An array relationship */
  nutritionLogMeals: Array<NutritionLogMeals>;
  /** An aggregate relationship */
  nutritionLogMeals_aggregate: NutritionLogMeals_Aggregate;
  /** An object relationship */
  nutritionPlan?: Maybe<NutritionPlans>;
  nutritionPlanId?: Maybe<Scalars['uuid']['output']>;
  updatedAt: Scalars['timestamptz']['output'];
  userId: Scalars['uuid']['output'];
};


/** columns and relationships of "nutrition_days" */
export type NutritionDaysNutritionLogEntriesArgs = {
  distinct_on?: InputMaybe<Array<NutritionLogEntries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionLogEntries_Order_By>>;
  where?: InputMaybe<NutritionLogEntries_Bool_Exp>;
};


/** columns and relationships of "nutrition_days" */
export type NutritionDaysNutritionLogEntries_AggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionLogEntries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionLogEntries_Order_By>>;
  where?: InputMaybe<NutritionLogEntries_Bool_Exp>;
};


/** columns and relationships of "nutrition_days" */
export type NutritionDaysNutritionLogMealsArgs = {
  distinct_on?: InputMaybe<Array<NutritionLogMeals_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionLogMeals_Order_By>>;
  where?: InputMaybe<NutritionLogMeals_Bool_Exp>;
};


/** columns and relationships of "nutrition_days" */
export type NutritionDaysNutritionLogMeals_AggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionLogMeals_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionLogMeals_Order_By>>;
  where?: InputMaybe<NutritionLogMeals_Bool_Exp>;
};

/** aggregated selection of "nutrition_days" */
export type NutritionDays_Aggregate = {
  __typename?: 'nutritionDays_aggregate';
  aggregate?: Maybe<NutritionDays_Aggregate_Fields>;
  nodes: Array<NutritionDays>;
};

export type NutritionDays_Aggregate_Bool_Exp = {
  count?: InputMaybe<NutritionDays_Aggregate_Bool_Exp_Count>;
};

export type NutritionDays_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<NutritionDays_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<NutritionDays_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "nutrition_days" */
export type NutritionDays_Aggregate_Fields = {
  __typename?: 'nutritionDays_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<NutritionDays_Max_Fields>;
  min?: Maybe<NutritionDays_Min_Fields>;
};


/** aggregate fields of "nutrition_days" */
export type NutritionDays_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<NutritionDays_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "nutrition_days" */
export type NutritionDays_Aggregate_Order_By = {
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<NutritionDays_Max_Order_By>;
  min?: InputMaybe<NutritionDays_Min_Order_By>;
};

/** input type for inserting array relation for remote table "nutrition_days" */
export type NutritionDays_Arr_Rel_Insert_Input = {
  data: Array<NutritionDays_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<NutritionDays_On_Conflict>;
};

/** Boolean expression to filter rows from the table "nutrition_days". All fields are combined with a logical 'AND'. */
export type NutritionDays_Bool_Exp = {
  _and?: InputMaybe<Array<NutritionDays_Bool_Exp>>;
  _not?: InputMaybe<NutritionDays_Bool_Exp>;
  _or?: InputMaybe<Array<NutritionDays_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  logDate?: InputMaybe<Date_Comparison_Exp>;
  nutritionLogEntries?: InputMaybe<NutritionLogEntries_Bool_Exp>;
  nutritionLogEntries_aggregate?: InputMaybe<NutritionLogEntries_Aggregate_Bool_Exp>;
  nutritionLogMeals?: InputMaybe<NutritionLogMeals_Bool_Exp>;
  nutritionLogMeals_aggregate?: InputMaybe<NutritionLogMeals_Aggregate_Bool_Exp>;
  nutritionPlan?: InputMaybe<NutritionPlans_Bool_Exp>;
  nutritionPlanId?: InputMaybe<Uuid_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  userId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "nutrition_days" */
export enum NutritionDays_Constraint {
  /** unique or primary key constraint on columns "id" */
  NutritionDaysPkey = 'nutrition_days_pkey',
  /** unique or primary key constraint on columns "user_id", "log_date" */
  NutritionDaysUserDateUq = 'nutrition_days_user_date_uq'
}

/** input type for inserting data into table "nutrition_days" */
export type NutritionDays_Insert_Input = {
  logDate?: InputMaybe<Scalars['date']['input']>;
  nutritionLogEntries?: InputMaybe<NutritionLogEntries_Arr_Rel_Insert_Input>;
  nutritionLogMeals?: InputMaybe<NutritionLogMeals_Arr_Rel_Insert_Input>;
  nutritionPlan?: InputMaybe<NutritionPlans_Obj_Rel_Insert_Input>;
  nutritionPlanId?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate max on columns */
export type NutritionDays_Max_Fields = {
  __typename?: 'nutritionDays_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  logDate?: Maybe<Scalars['date']['output']>;
  nutritionPlanId?: Maybe<Scalars['uuid']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "nutrition_days" */
export type NutritionDays_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  logDate?: InputMaybe<Order_By>;
  nutritionPlanId?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type NutritionDays_Min_Fields = {
  __typename?: 'nutritionDays_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  logDate?: Maybe<Scalars['date']['output']>;
  nutritionPlanId?: Maybe<Scalars['uuid']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "nutrition_days" */
export type NutritionDays_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  logDate?: InputMaybe<Order_By>;
  nutritionPlanId?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "nutrition_days" */
export type NutritionDays_Mutation_Response = {
  __typename?: 'nutritionDays_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<NutritionDays>;
};

/** input type for inserting object relation for remote table "nutrition_days" */
export type NutritionDays_Obj_Rel_Insert_Input = {
  data: NutritionDays_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<NutritionDays_On_Conflict>;
};

/** on_conflict condition type for table "nutrition_days" */
export type NutritionDays_On_Conflict = {
  constraint: NutritionDays_Constraint;
  update_columns?: Array<NutritionDays_Update_Column>;
  where?: InputMaybe<NutritionDays_Bool_Exp>;
};

/** Ordering options when selecting data from "nutrition_days". */
export type NutritionDays_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  logDate?: InputMaybe<Order_By>;
  nutritionLogEntries_aggregate?: InputMaybe<NutritionLogEntries_Aggregate_Order_By>;
  nutritionLogMeals_aggregate?: InputMaybe<NutritionLogMeals_Aggregate_Order_By>;
  nutritionPlan?: InputMaybe<NutritionPlans_Order_By>;
  nutritionPlanId?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: nutrition_days */
export type NutritionDays_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "nutrition_days" */
export enum NutritionDays_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  LogDate = 'logDate',
  /** column name */
  NutritionPlanId = 'nutritionPlanId',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UserId = 'userId'
}

/** input type for updating data in table "nutrition_days" */
export type NutritionDays_Set_Input = {
  logDate?: InputMaybe<Scalars['date']['input']>;
  nutritionPlanId?: InputMaybe<Scalars['uuid']['input']>;
};

/** Streaming cursor of the table "nutritionDays" */
export type NutritionDays_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: NutritionDays_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type NutritionDays_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  logDate?: InputMaybe<Scalars['date']['input']>;
  nutritionPlanId?: InputMaybe<Scalars['uuid']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
  userId?: InputMaybe<Scalars['uuid']['input']>;
};

/** update columns of table "nutrition_days" */
export enum NutritionDays_Update_Column {
  /** column name */
  LogDate = 'logDate',
  /** column name */
  NutritionPlanId = 'nutritionPlanId'
}

export type NutritionDays_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<NutritionDays_Set_Input>;
  /** filter the rows which have to be updated */
  where: NutritionDays_Bool_Exp;
};

/** Historical food log rows. source=food rows copy trusted snapshot_* values from foods at insert time; source=ad_hoc rows store standalone user-supplied snapshot values. Daily totals use snapshots, not live foods. */
export type NutritionLogEntries = {
  __typename?: 'nutritionLogEntries';
  createdAt: Scalars['timestamptz']['output'];
  /** An object relationship */
  food?: Maybe<Foods>;
  foodId?: Maybe<Scalars['uuid']['output']>;
  grams: Scalars['numeric']['output'];
  id: Scalars['uuid']['output'];
  /** An object relationship */
  nutritionDay?: Maybe<NutritionDays>;
  nutritionDayId: Scalars['uuid']['output'];
  /** An object relationship */
  nutritionLogMeal?: Maybe<NutritionLogMeals>;
  nutritionLogMealId?: Maybe<Scalars['uuid']['output']>;
  /** An object relationship */
  nutritionPlanFood?: Maybe<NutritionPlanFoods>;
  /** Nullable provenance pointer for standalone logs created from a direct food entry in a nutrition plan. Deleting the plan/template nulls this pointer while snapshots remain. */
  nutritionPlanFoodId?: Maybe<Scalars['uuid']['output']>;
  position: Scalars['Int']['output'];
  /** Client-supplied logged time-of-day for standalone entries. Grouped entries inherit display time from nutrition_log_meals.slot_time. */
  slotTime?: Maybe<Scalars['time']['output']>;
  snapshotCarbsPer100g: Scalars['numeric']['output'];
  snapshotFatPer100g: Scalars['numeric']['output'];
  snapshotFiberPer100g: Scalars['numeric']['output'];
  snapshotFoodName: Scalars['String']['output'];
  snapshotKcalPer100g: Scalars['numeric']['output'];
  snapshotProteinPer100g: Scalars['numeric']['output'];
  snapshotSugarPer100g: Scalars['numeric']['output'];
  /** Discriminator for log-entry snapshot provenance. food rows snapshot a foods row at insert time; ad_hoc rows are standalone user-supplied snapshots and never appear in reusable food catalogs. */
  source: Scalars['String']['output'];
  updatedAt: Scalars['timestamptz']['output'];
};

/** aggregated selection of "nutrition_log_entries" */
export type NutritionLogEntries_Aggregate = {
  __typename?: 'nutritionLogEntries_aggregate';
  aggregate?: Maybe<NutritionLogEntries_Aggregate_Fields>;
  nodes: Array<NutritionLogEntries>;
};

export type NutritionLogEntries_Aggregate_Bool_Exp = {
  count?: InputMaybe<NutritionLogEntries_Aggregate_Bool_Exp_Count>;
};

export type NutritionLogEntries_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<NutritionLogEntries_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<NutritionLogEntries_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "nutrition_log_entries" */
export type NutritionLogEntries_Aggregate_Fields = {
  __typename?: 'nutritionLogEntries_aggregate_fields';
  avg?: Maybe<NutritionLogEntries_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<NutritionLogEntries_Max_Fields>;
  min?: Maybe<NutritionLogEntries_Min_Fields>;
  stddev?: Maybe<NutritionLogEntries_Stddev_Fields>;
  stddev_pop?: Maybe<NutritionLogEntries_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<NutritionLogEntries_Stddev_Samp_Fields>;
  sum?: Maybe<NutritionLogEntries_Sum_Fields>;
  var_pop?: Maybe<NutritionLogEntries_Var_Pop_Fields>;
  var_samp?: Maybe<NutritionLogEntries_Var_Samp_Fields>;
  variance?: Maybe<NutritionLogEntries_Variance_Fields>;
};


/** aggregate fields of "nutrition_log_entries" */
export type NutritionLogEntries_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<NutritionLogEntries_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "nutrition_log_entries" */
export type NutritionLogEntries_Aggregate_Order_By = {
  avg?: InputMaybe<NutritionLogEntries_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<NutritionLogEntries_Max_Order_By>;
  min?: InputMaybe<NutritionLogEntries_Min_Order_By>;
  stddev?: InputMaybe<NutritionLogEntries_Stddev_Order_By>;
  stddev_pop?: InputMaybe<NutritionLogEntries_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<NutritionLogEntries_Stddev_Samp_Order_By>;
  sum?: InputMaybe<NutritionLogEntries_Sum_Order_By>;
  var_pop?: InputMaybe<NutritionLogEntries_Var_Pop_Order_By>;
  var_samp?: InputMaybe<NutritionLogEntries_Var_Samp_Order_By>;
  variance?: InputMaybe<NutritionLogEntries_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "nutrition_log_entries" */
export type NutritionLogEntries_Arr_Rel_Insert_Input = {
  data: Array<NutritionLogEntries_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<NutritionLogEntries_On_Conflict>;
};

/** aggregate avg on columns */
export type NutritionLogEntries_Avg_Fields = {
  __typename?: 'nutritionLogEntries_avg_fields';
  grams?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
  snapshotCarbsPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotFatPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotFiberPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotKcalPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotProteinPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotSugarPer100g?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "nutrition_log_entries" */
export type NutritionLogEntries_Avg_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  snapshotCarbsPer100g?: InputMaybe<Order_By>;
  snapshotFatPer100g?: InputMaybe<Order_By>;
  snapshotFiberPer100g?: InputMaybe<Order_By>;
  snapshotKcalPer100g?: InputMaybe<Order_By>;
  snapshotProteinPer100g?: InputMaybe<Order_By>;
  snapshotSugarPer100g?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "nutrition_log_entries". All fields are combined with a logical 'AND'. */
export type NutritionLogEntries_Bool_Exp = {
  _and?: InputMaybe<Array<NutritionLogEntries_Bool_Exp>>;
  _not?: InputMaybe<NutritionLogEntries_Bool_Exp>;
  _or?: InputMaybe<Array<NutritionLogEntries_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  food?: InputMaybe<Foods_Bool_Exp>;
  foodId?: InputMaybe<Uuid_Comparison_Exp>;
  grams?: InputMaybe<Numeric_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  nutritionDay?: InputMaybe<NutritionDays_Bool_Exp>;
  nutritionDayId?: InputMaybe<Uuid_Comparison_Exp>;
  nutritionLogMeal?: InputMaybe<NutritionLogMeals_Bool_Exp>;
  nutritionLogMealId?: InputMaybe<Uuid_Comparison_Exp>;
  nutritionPlanFood?: InputMaybe<NutritionPlanFoods_Bool_Exp>;
  /** Nullable provenance pointer for standalone logs created from a direct food entry in a nutrition plan. Deleting the plan/template nulls this pointer while snapshots remain. */
  nutritionPlanFoodId?: InputMaybe<Uuid_Comparison_Exp>;
  position?: InputMaybe<Int_Comparison_Exp>;
  /** Client-supplied logged time-of-day for standalone entries. Grouped entries inherit display time from nutrition_log_meals.slot_time. */
  slotTime?: InputMaybe<Time_Comparison_Exp>;
  snapshotCarbsPer100g?: InputMaybe<Numeric_Comparison_Exp>;
  snapshotFatPer100g?: InputMaybe<Numeric_Comparison_Exp>;
  snapshotFiberPer100g?: InputMaybe<Numeric_Comparison_Exp>;
  snapshotFoodName?: InputMaybe<String_Comparison_Exp>;
  snapshotKcalPer100g?: InputMaybe<Numeric_Comparison_Exp>;
  snapshotProteinPer100g?: InputMaybe<Numeric_Comparison_Exp>;
  snapshotSugarPer100g?: InputMaybe<Numeric_Comparison_Exp>;
  /** Discriminator for log-entry snapshot provenance. food rows snapshot a foods row at insert time; ad_hoc rows are standalone user-supplied snapshots and never appear in reusable food catalogs. */
  source?: InputMaybe<String_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "nutrition_log_entries" */
export enum NutritionLogEntries_Constraint {
  /** unique or primary key constraint on columns "id" */
  NutritionLogEntriesPkey = 'nutrition_log_entries_pkey'
}

/** input type for incrementing numeric columns in table "nutrition_log_entries" */
export type NutritionLogEntries_Inc_Input = {
  grams?: InputMaybe<Scalars['numeric']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  snapshotCarbsPer100g?: InputMaybe<Scalars['numeric']['input']>;
  snapshotFatPer100g?: InputMaybe<Scalars['numeric']['input']>;
  snapshotFiberPer100g?: InputMaybe<Scalars['numeric']['input']>;
  snapshotKcalPer100g?: InputMaybe<Scalars['numeric']['input']>;
  snapshotProteinPer100g?: InputMaybe<Scalars['numeric']['input']>;
  snapshotSugarPer100g?: InputMaybe<Scalars['numeric']['input']>;
};

/** input type for inserting data into table "nutrition_log_entries" */
export type NutritionLogEntries_Insert_Input = {
  food?: InputMaybe<Foods_Obj_Rel_Insert_Input>;
  foodId?: InputMaybe<Scalars['uuid']['input']>;
  grams?: InputMaybe<Scalars['numeric']['input']>;
  nutritionDay?: InputMaybe<NutritionDays_Obj_Rel_Insert_Input>;
  nutritionDayId?: InputMaybe<Scalars['uuid']['input']>;
  nutritionLogMeal?: InputMaybe<NutritionLogMeals_Obj_Rel_Insert_Input>;
  nutritionLogMealId?: InputMaybe<Scalars['uuid']['input']>;
  nutritionPlanFood?: InputMaybe<NutritionPlanFoods_Obj_Rel_Insert_Input>;
  /** Nullable provenance pointer for standalone logs created from a direct food entry in a nutrition plan. Deleting the plan/template nulls this pointer while snapshots remain. */
  nutritionPlanFoodId?: InputMaybe<Scalars['uuid']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  /** Client-supplied logged time-of-day for standalone entries. Grouped entries inherit display time from nutrition_log_meals.slot_time. */
  slotTime?: InputMaybe<Scalars['time']['input']>;
  snapshotCarbsPer100g?: InputMaybe<Scalars['numeric']['input']>;
  snapshotFatPer100g?: InputMaybe<Scalars['numeric']['input']>;
  snapshotFiberPer100g?: InputMaybe<Scalars['numeric']['input']>;
  snapshotFoodName?: InputMaybe<Scalars['String']['input']>;
  snapshotKcalPer100g?: InputMaybe<Scalars['numeric']['input']>;
  snapshotProteinPer100g?: InputMaybe<Scalars['numeric']['input']>;
  snapshotSugarPer100g?: InputMaybe<Scalars['numeric']['input']>;
  /** Discriminator for log-entry snapshot provenance. food rows snapshot a foods row at insert time; ad_hoc rows are standalone user-supplied snapshots and never appear in reusable food catalogs. */
  source?: InputMaybe<Scalars['String']['input']>;
};

/** aggregate max on columns */
export type NutritionLogEntries_Max_Fields = {
  __typename?: 'nutritionLogEntries_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  foodId?: Maybe<Scalars['uuid']['output']>;
  grams?: Maybe<Scalars['numeric']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  nutritionDayId?: Maybe<Scalars['uuid']['output']>;
  nutritionLogMealId?: Maybe<Scalars['uuid']['output']>;
  /** Nullable provenance pointer for standalone logs created from a direct food entry in a nutrition plan. Deleting the plan/template nulls this pointer while snapshots remain. */
  nutritionPlanFoodId?: Maybe<Scalars['uuid']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  /** Client-supplied logged time-of-day for standalone entries. Grouped entries inherit display time from nutrition_log_meals.slot_time. */
  slotTime?: Maybe<Scalars['time']['output']>;
  snapshotCarbsPer100g?: Maybe<Scalars['numeric']['output']>;
  snapshotFatPer100g?: Maybe<Scalars['numeric']['output']>;
  snapshotFiberPer100g?: Maybe<Scalars['numeric']['output']>;
  snapshotFoodName?: Maybe<Scalars['String']['output']>;
  snapshotKcalPer100g?: Maybe<Scalars['numeric']['output']>;
  snapshotProteinPer100g?: Maybe<Scalars['numeric']['output']>;
  snapshotSugarPer100g?: Maybe<Scalars['numeric']['output']>;
  /** Discriminator for log-entry snapshot provenance. food rows snapshot a foods row at insert time; ad_hoc rows are standalone user-supplied snapshots and never appear in reusable food catalogs. */
  source?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by max() on columns of table "nutrition_log_entries" */
export type NutritionLogEntries_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  foodId?: InputMaybe<Order_By>;
  grams?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  nutritionDayId?: InputMaybe<Order_By>;
  nutritionLogMealId?: InputMaybe<Order_By>;
  /** Nullable provenance pointer for standalone logs created from a direct food entry in a nutrition plan. Deleting the plan/template nulls this pointer while snapshots remain. */
  nutritionPlanFoodId?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  /** Client-supplied logged time-of-day for standalone entries. Grouped entries inherit display time from nutrition_log_meals.slot_time. */
  slotTime?: InputMaybe<Order_By>;
  snapshotCarbsPer100g?: InputMaybe<Order_By>;
  snapshotFatPer100g?: InputMaybe<Order_By>;
  snapshotFiberPer100g?: InputMaybe<Order_By>;
  snapshotFoodName?: InputMaybe<Order_By>;
  snapshotKcalPer100g?: InputMaybe<Order_By>;
  snapshotProteinPer100g?: InputMaybe<Order_By>;
  snapshotSugarPer100g?: InputMaybe<Order_By>;
  /** Discriminator for log-entry snapshot provenance. food rows snapshot a foods row at insert time; ad_hoc rows are standalone user-supplied snapshots and never appear in reusable food catalogs. */
  source?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type NutritionLogEntries_Min_Fields = {
  __typename?: 'nutritionLogEntries_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  foodId?: Maybe<Scalars['uuid']['output']>;
  grams?: Maybe<Scalars['numeric']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  nutritionDayId?: Maybe<Scalars['uuid']['output']>;
  nutritionLogMealId?: Maybe<Scalars['uuid']['output']>;
  /** Nullable provenance pointer for standalone logs created from a direct food entry in a nutrition plan. Deleting the plan/template nulls this pointer while snapshots remain. */
  nutritionPlanFoodId?: Maybe<Scalars['uuid']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  /** Client-supplied logged time-of-day for standalone entries. Grouped entries inherit display time from nutrition_log_meals.slot_time. */
  slotTime?: Maybe<Scalars['time']['output']>;
  snapshotCarbsPer100g?: Maybe<Scalars['numeric']['output']>;
  snapshotFatPer100g?: Maybe<Scalars['numeric']['output']>;
  snapshotFiberPer100g?: Maybe<Scalars['numeric']['output']>;
  snapshotFoodName?: Maybe<Scalars['String']['output']>;
  snapshotKcalPer100g?: Maybe<Scalars['numeric']['output']>;
  snapshotProteinPer100g?: Maybe<Scalars['numeric']['output']>;
  snapshotSugarPer100g?: Maybe<Scalars['numeric']['output']>;
  /** Discriminator for log-entry snapshot provenance. food rows snapshot a foods row at insert time; ad_hoc rows are standalone user-supplied snapshots and never appear in reusable food catalogs. */
  source?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by min() on columns of table "nutrition_log_entries" */
export type NutritionLogEntries_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  foodId?: InputMaybe<Order_By>;
  grams?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  nutritionDayId?: InputMaybe<Order_By>;
  nutritionLogMealId?: InputMaybe<Order_By>;
  /** Nullable provenance pointer for standalone logs created from a direct food entry in a nutrition plan. Deleting the plan/template nulls this pointer while snapshots remain. */
  nutritionPlanFoodId?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  /** Client-supplied logged time-of-day for standalone entries. Grouped entries inherit display time from nutrition_log_meals.slot_time. */
  slotTime?: InputMaybe<Order_By>;
  snapshotCarbsPer100g?: InputMaybe<Order_By>;
  snapshotFatPer100g?: InputMaybe<Order_By>;
  snapshotFiberPer100g?: InputMaybe<Order_By>;
  snapshotFoodName?: InputMaybe<Order_By>;
  snapshotKcalPer100g?: InputMaybe<Order_By>;
  snapshotProteinPer100g?: InputMaybe<Order_By>;
  snapshotSugarPer100g?: InputMaybe<Order_By>;
  /** Discriminator for log-entry snapshot provenance. food rows snapshot a foods row at insert time; ad_hoc rows are standalone user-supplied snapshots and never appear in reusable food catalogs. */
  source?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "nutrition_log_entries" */
export type NutritionLogEntries_Mutation_Response = {
  __typename?: 'nutritionLogEntries_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<NutritionLogEntries>;
};

/** on_conflict condition type for table "nutrition_log_entries" */
export type NutritionLogEntries_On_Conflict = {
  constraint: NutritionLogEntries_Constraint;
  update_columns?: Array<NutritionLogEntries_Update_Column>;
  where?: InputMaybe<NutritionLogEntries_Bool_Exp>;
};

/** Ordering options when selecting data from "nutrition_log_entries". */
export type NutritionLogEntries_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  food?: InputMaybe<Foods_Order_By>;
  foodId?: InputMaybe<Order_By>;
  grams?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  nutritionDay?: InputMaybe<NutritionDays_Order_By>;
  nutritionDayId?: InputMaybe<Order_By>;
  nutritionLogMeal?: InputMaybe<NutritionLogMeals_Order_By>;
  nutritionLogMealId?: InputMaybe<Order_By>;
  nutritionPlanFood?: InputMaybe<NutritionPlanFoods_Order_By>;
  /** Nullable provenance pointer for standalone logs created from a direct food entry in a nutrition plan. Deleting the plan/template nulls this pointer while snapshots remain. */
  nutritionPlanFoodId?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  /** Client-supplied logged time-of-day for standalone entries. Grouped entries inherit display time from nutrition_log_meals.slot_time. */
  slotTime?: InputMaybe<Order_By>;
  snapshotCarbsPer100g?: InputMaybe<Order_By>;
  snapshotFatPer100g?: InputMaybe<Order_By>;
  snapshotFiberPer100g?: InputMaybe<Order_By>;
  snapshotFoodName?: InputMaybe<Order_By>;
  snapshotKcalPer100g?: InputMaybe<Order_By>;
  snapshotProteinPer100g?: InputMaybe<Order_By>;
  snapshotSugarPer100g?: InputMaybe<Order_By>;
  /** Discriminator for log-entry snapshot provenance. food rows snapshot a foods row at insert time; ad_hoc rows are standalone user-supplied snapshots and never appear in reusable food catalogs. */
  source?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** primary key columns input for table: nutrition_log_entries */
export type NutritionLogEntries_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "nutrition_log_entries" */
export enum NutritionLogEntries_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  FoodId = 'foodId',
  /** column name */
  Grams = 'grams',
  /** column name */
  Id = 'id',
  /** column name */
  NutritionDayId = 'nutritionDayId',
  /** column name */
  NutritionLogMealId = 'nutritionLogMealId',
  /** Nullable provenance pointer for standalone logs created from a direct food entry in a nutrition plan. Deleting the plan/template nulls this pointer while snapshots remain. */
  NutritionPlanFoodId = 'nutritionPlanFoodId',
  /** column name */
  Position = 'position',
  /** Client-supplied logged time-of-day for standalone entries. Grouped entries inherit display time from nutrition_log_meals.slot_time. */
  SlotTime = 'slotTime',
  /** column name */
  SnapshotCarbsPer100g = 'snapshotCarbsPer100g',
  /** column name */
  SnapshotFatPer100g = 'snapshotFatPer100g',
  /** column name */
  SnapshotFiberPer100g = 'snapshotFiberPer100g',
  /** column name */
  SnapshotFoodName = 'snapshotFoodName',
  /** column name */
  SnapshotKcalPer100g = 'snapshotKcalPer100g',
  /** column name */
  SnapshotProteinPer100g = 'snapshotProteinPer100g',
  /** column name */
  SnapshotSugarPer100g = 'snapshotSugarPer100g',
  /** Discriminator for log-entry snapshot provenance. food rows snapshot a foods row at insert time; ad_hoc rows are standalone user-supplied snapshots and never appear in reusable food catalogs. */
  Source = 'source',
  /** column name */
  UpdatedAt = 'updatedAt'
}

/** input type for updating data in table "nutrition_log_entries" */
export type NutritionLogEntries_Set_Input = {
  grams?: InputMaybe<Scalars['numeric']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  /** Client-supplied logged time-of-day for standalone entries. Grouped entries inherit display time from nutrition_log_meals.slot_time. */
  slotTime?: InputMaybe<Scalars['time']['input']>;
  snapshotCarbsPer100g?: InputMaybe<Scalars['numeric']['input']>;
  snapshotFatPer100g?: InputMaybe<Scalars['numeric']['input']>;
  snapshotFiberPer100g?: InputMaybe<Scalars['numeric']['input']>;
  snapshotFoodName?: InputMaybe<Scalars['String']['input']>;
  snapshotKcalPer100g?: InputMaybe<Scalars['numeric']['input']>;
  snapshotProteinPer100g?: InputMaybe<Scalars['numeric']['input']>;
  snapshotSugarPer100g?: InputMaybe<Scalars['numeric']['input']>;
};

/** aggregate stddev on columns */
export type NutritionLogEntries_Stddev_Fields = {
  __typename?: 'nutritionLogEntries_stddev_fields';
  grams?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
  snapshotCarbsPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotFatPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotFiberPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotKcalPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotProteinPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotSugarPer100g?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "nutrition_log_entries" */
export type NutritionLogEntries_Stddev_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  snapshotCarbsPer100g?: InputMaybe<Order_By>;
  snapshotFatPer100g?: InputMaybe<Order_By>;
  snapshotFiberPer100g?: InputMaybe<Order_By>;
  snapshotKcalPer100g?: InputMaybe<Order_By>;
  snapshotProteinPer100g?: InputMaybe<Order_By>;
  snapshotSugarPer100g?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type NutritionLogEntries_Stddev_Pop_Fields = {
  __typename?: 'nutritionLogEntries_stddev_pop_fields';
  grams?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
  snapshotCarbsPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotFatPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotFiberPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotKcalPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotProteinPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotSugarPer100g?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "nutrition_log_entries" */
export type NutritionLogEntries_Stddev_Pop_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  snapshotCarbsPer100g?: InputMaybe<Order_By>;
  snapshotFatPer100g?: InputMaybe<Order_By>;
  snapshotFiberPer100g?: InputMaybe<Order_By>;
  snapshotKcalPer100g?: InputMaybe<Order_By>;
  snapshotProteinPer100g?: InputMaybe<Order_By>;
  snapshotSugarPer100g?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type NutritionLogEntries_Stddev_Samp_Fields = {
  __typename?: 'nutritionLogEntries_stddev_samp_fields';
  grams?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
  snapshotCarbsPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotFatPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotFiberPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotKcalPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotProteinPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotSugarPer100g?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "nutrition_log_entries" */
export type NutritionLogEntries_Stddev_Samp_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  snapshotCarbsPer100g?: InputMaybe<Order_By>;
  snapshotFatPer100g?: InputMaybe<Order_By>;
  snapshotFiberPer100g?: InputMaybe<Order_By>;
  snapshotKcalPer100g?: InputMaybe<Order_By>;
  snapshotProteinPer100g?: InputMaybe<Order_By>;
  snapshotSugarPer100g?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "nutritionLogEntries" */
export type NutritionLogEntries_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: NutritionLogEntries_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type NutritionLogEntries_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  foodId?: InputMaybe<Scalars['uuid']['input']>;
  grams?: InputMaybe<Scalars['numeric']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  nutritionDayId?: InputMaybe<Scalars['uuid']['input']>;
  nutritionLogMealId?: InputMaybe<Scalars['uuid']['input']>;
  /** Nullable provenance pointer for standalone logs created from a direct food entry in a nutrition plan. Deleting the plan/template nulls this pointer while snapshots remain. */
  nutritionPlanFoodId?: InputMaybe<Scalars['uuid']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  /** Client-supplied logged time-of-day for standalone entries. Grouped entries inherit display time from nutrition_log_meals.slot_time. */
  slotTime?: InputMaybe<Scalars['time']['input']>;
  snapshotCarbsPer100g?: InputMaybe<Scalars['numeric']['input']>;
  snapshotFatPer100g?: InputMaybe<Scalars['numeric']['input']>;
  snapshotFiberPer100g?: InputMaybe<Scalars['numeric']['input']>;
  snapshotFoodName?: InputMaybe<Scalars['String']['input']>;
  snapshotKcalPer100g?: InputMaybe<Scalars['numeric']['input']>;
  snapshotProteinPer100g?: InputMaybe<Scalars['numeric']['input']>;
  snapshotSugarPer100g?: InputMaybe<Scalars['numeric']['input']>;
  /** Discriminator for log-entry snapshot provenance. food rows snapshot a foods row at insert time; ad_hoc rows are standalone user-supplied snapshots and never appear in reusable food catalogs. */
  source?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate sum on columns */
export type NutritionLogEntries_Sum_Fields = {
  __typename?: 'nutritionLogEntries_sum_fields';
  grams?: Maybe<Scalars['numeric']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  snapshotCarbsPer100g?: Maybe<Scalars['numeric']['output']>;
  snapshotFatPer100g?: Maybe<Scalars['numeric']['output']>;
  snapshotFiberPer100g?: Maybe<Scalars['numeric']['output']>;
  snapshotKcalPer100g?: Maybe<Scalars['numeric']['output']>;
  snapshotProteinPer100g?: Maybe<Scalars['numeric']['output']>;
  snapshotSugarPer100g?: Maybe<Scalars['numeric']['output']>;
};

/** order by sum() on columns of table "nutrition_log_entries" */
export type NutritionLogEntries_Sum_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  snapshotCarbsPer100g?: InputMaybe<Order_By>;
  snapshotFatPer100g?: InputMaybe<Order_By>;
  snapshotFiberPer100g?: InputMaybe<Order_By>;
  snapshotKcalPer100g?: InputMaybe<Order_By>;
  snapshotProteinPer100g?: InputMaybe<Order_By>;
  snapshotSugarPer100g?: InputMaybe<Order_By>;
};

/** update columns of table "nutrition_log_entries" */
export enum NutritionLogEntries_Update_Column {
  /** column name */
  Grams = 'grams',
  /** column name */
  Position = 'position',
  /** Client-supplied logged time-of-day for standalone entries. Grouped entries inherit display time from nutrition_log_meals.slot_time. */
  SlotTime = 'slotTime',
  /** column name */
  SnapshotCarbsPer100g = 'snapshotCarbsPer100g',
  /** column name */
  SnapshotFatPer100g = 'snapshotFatPer100g',
  /** column name */
  SnapshotFiberPer100g = 'snapshotFiberPer100g',
  /** column name */
  SnapshotFoodName = 'snapshotFoodName',
  /** column name */
  SnapshotKcalPer100g = 'snapshotKcalPer100g',
  /** column name */
  SnapshotProteinPer100g = 'snapshotProteinPer100g',
  /** column name */
  SnapshotSugarPer100g = 'snapshotSugarPer100g'
}

export type NutritionLogEntries_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<NutritionLogEntries_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<NutritionLogEntries_Set_Input>;
  /** filter the rows which have to be updated */
  where: NutritionLogEntries_Bool_Exp;
};

/** aggregate var_pop on columns */
export type NutritionLogEntries_Var_Pop_Fields = {
  __typename?: 'nutritionLogEntries_var_pop_fields';
  grams?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
  snapshotCarbsPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotFatPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotFiberPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotKcalPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotProteinPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotSugarPer100g?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "nutrition_log_entries" */
export type NutritionLogEntries_Var_Pop_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  snapshotCarbsPer100g?: InputMaybe<Order_By>;
  snapshotFatPer100g?: InputMaybe<Order_By>;
  snapshotFiberPer100g?: InputMaybe<Order_By>;
  snapshotKcalPer100g?: InputMaybe<Order_By>;
  snapshotProteinPer100g?: InputMaybe<Order_By>;
  snapshotSugarPer100g?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type NutritionLogEntries_Var_Samp_Fields = {
  __typename?: 'nutritionLogEntries_var_samp_fields';
  grams?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
  snapshotCarbsPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotFatPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotFiberPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotKcalPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotProteinPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotSugarPer100g?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "nutrition_log_entries" */
export type NutritionLogEntries_Var_Samp_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  snapshotCarbsPer100g?: InputMaybe<Order_By>;
  snapshotFatPer100g?: InputMaybe<Order_By>;
  snapshotFiberPer100g?: InputMaybe<Order_By>;
  snapshotKcalPer100g?: InputMaybe<Order_By>;
  snapshotProteinPer100g?: InputMaybe<Order_By>;
  snapshotSugarPer100g?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type NutritionLogEntries_Variance_Fields = {
  __typename?: 'nutritionLogEntries_variance_fields';
  grams?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
  snapshotCarbsPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotFatPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotFiberPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotKcalPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotProteinPer100g?: Maybe<Scalars['Float']['output']>;
  snapshotSugarPer100g?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "nutrition_log_entries" */
export type NutritionLogEntries_Variance_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  snapshotCarbsPer100g?: InputMaybe<Order_By>;
  snapshotFatPer100g?: InputMaybe<Order_By>;
  snapshotFiberPer100g?: InputMaybe<Order_By>;
  snapshotKcalPer100g?: InputMaybe<Order_By>;
  snapshotProteinPer100g?: InputMaybe<Order_By>;
  snapshotSugarPer100g?: InputMaybe<Order_By>;
};

/** columns and relationships of "nutrition_log_meals" */
export type NutritionLogMeals = {
  __typename?: 'nutritionLogMeals';
  createdAt: Scalars['timestamptz']['output'];
  id: Scalars['uuid']['output'];
  /** An object relationship */
  meal?: Maybe<Meals>;
  mealId?: Maybe<Scalars['uuid']['output']>;
  name: Scalars['String']['output'];
  /** An object relationship */
  nutritionDay: NutritionDays;
  nutritionDayId: Scalars['uuid']['output'];
  /** An array relationship */
  nutritionLogEntries: Array<NutritionLogEntries>;
  /** An aggregate relationship */
  nutritionLogEntries_aggregate: NutritionLogEntries_Aggregate;
  /** An object relationship */
  nutritionPlanMeal?: Maybe<NutritionPlanMeals>;
  nutritionPlanMealId?: Maybe<Scalars['uuid']['output']>;
  position: Scalars['Int']['output'];
  /** Client-supplied logged time-of-day for the meal group. For planned meals this defaults to now, not the template slot time. */
  slotTime?: Maybe<Scalars['time']['output']>;
  updatedAt: Scalars['timestamptz']['output'];
};


/** columns and relationships of "nutrition_log_meals" */
export type NutritionLogMealsNutritionLogEntriesArgs = {
  distinct_on?: InputMaybe<Array<NutritionLogEntries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionLogEntries_Order_By>>;
  where?: InputMaybe<NutritionLogEntries_Bool_Exp>;
};


/** columns and relationships of "nutrition_log_meals" */
export type NutritionLogMealsNutritionLogEntries_AggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionLogEntries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionLogEntries_Order_By>>;
  where?: InputMaybe<NutritionLogEntries_Bool_Exp>;
};

/** aggregated selection of "nutrition_log_meals" */
export type NutritionLogMeals_Aggregate = {
  __typename?: 'nutritionLogMeals_aggregate';
  aggregate?: Maybe<NutritionLogMeals_Aggregate_Fields>;
  nodes: Array<NutritionLogMeals>;
};

export type NutritionLogMeals_Aggregate_Bool_Exp = {
  count?: InputMaybe<NutritionLogMeals_Aggregate_Bool_Exp_Count>;
};

export type NutritionLogMeals_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<NutritionLogMeals_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<NutritionLogMeals_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "nutrition_log_meals" */
export type NutritionLogMeals_Aggregate_Fields = {
  __typename?: 'nutritionLogMeals_aggregate_fields';
  avg?: Maybe<NutritionLogMeals_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<NutritionLogMeals_Max_Fields>;
  min?: Maybe<NutritionLogMeals_Min_Fields>;
  stddev?: Maybe<NutritionLogMeals_Stddev_Fields>;
  stddev_pop?: Maybe<NutritionLogMeals_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<NutritionLogMeals_Stddev_Samp_Fields>;
  sum?: Maybe<NutritionLogMeals_Sum_Fields>;
  var_pop?: Maybe<NutritionLogMeals_Var_Pop_Fields>;
  var_samp?: Maybe<NutritionLogMeals_Var_Samp_Fields>;
  variance?: Maybe<NutritionLogMeals_Variance_Fields>;
};


/** aggregate fields of "nutrition_log_meals" */
export type NutritionLogMeals_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<NutritionLogMeals_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "nutrition_log_meals" */
export type NutritionLogMeals_Aggregate_Order_By = {
  avg?: InputMaybe<NutritionLogMeals_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<NutritionLogMeals_Max_Order_By>;
  min?: InputMaybe<NutritionLogMeals_Min_Order_By>;
  stddev?: InputMaybe<NutritionLogMeals_Stddev_Order_By>;
  stddev_pop?: InputMaybe<NutritionLogMeals_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<NutritionLogMeals_Stddev_Samp_Order_By>;
  sum?: InputMaybe<NutritionLogMeals_Sum_Order_By>;
  var_pop?: InputMaybe<NutritionLogMeals_Var_Pop_Order_By>;
  var_samp?: InputMaybe<NutritionLogMeals_Var_Samp_Order_By>;
  variance?: InputMaybe<NutritionLogMeals_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "nutrition_log_meals" */
export type NutritionLogMeals_Arr_Rel_Insert_Input = {
  data: Array<NutritionLogMeals_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<NutritionLogMeals_On_Conflict>;
};

/** aggregate avg on columns */
export type NutritionLogMeals_Avg_Fields = {
  __typename?: 'nutritionLogMeals_avg_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "nutrition_log_meals" */
export type NutritionLogMeals_Avg_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "nutrition_log_meals". All fields are combined with a logical 'AND'. */
export type NutritionLogMeals_Bool_Exp = {
  _and?: InputMaybe<Array<NutritionLogMeals_Bool_Exp>>;
  _not?: InputMaybe<NutritionLogMeals_Bool_Exp>;
  _or?: InputMaybe<Array<NutritionLogMeals_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  meal?: InputMaybe<Meals_Bool_Exp>;
  mealId?: InputMaybe<Uuid_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  nutritionDay?: InputMaybe<NutritionDays_Bool_Exp>;
  nutritionDayId?: InputMaybe<Uuid_Comparison_Exp>;
  nutritionLogEntries?: InputMaybe<NutritionLogEntries_Bool_Exp>;
  nutritionLogEntries_aggregate?: InputMaybe<NutritionLogEntries_Aggregate_Bool_Exp>;
  nutritionPlanMeal?: InputMaybe<NutritionPlanMeals_Bool_Exp>;
  nutritionPlanMealId?: InputMaybe<Uuid_Comparison_Exp>;
  position?: InputMaybe<Int_Comparison_Exp>;
  /** Client-supplied logged time-of-day for the meal group. For planned meals this defaults to now, not the template slot time. */
  slotTime?: InputMaybe<Time_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "nutrition_log_meals" */
export enum NutritionLogMeals_Constraint {
  /** unique or primary key constraint on columns "id", "nutrition_day_id" */
  NutritionLogMealsIdDayUq = 'nutrition_log_meals_id_day_uq',
  /** unique or primary key constraint on columns "id" */
  NutritionLogMealsPkey = 'nutrition_log_meals_pkey'
}

/** input type for incrementing numeric columns in table "nutrition_log_meals" */
export type NutritionLogMeals_Inc_Input = {
  position?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "nutrition_log_meals" */
export type NutritionLogMeals_Insert_Input = {
  meal?: InputMaybe<Meals_Obj_Rel_Insert_Input>;
  mealId?: InputMaybe<Scalars['uuid']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  nutritionDay?: InputMaybe<NutritionDays_Obj_Rel_Insert_Input>;
  nutritionDayId?: InputMaybe<Scalars['uuid']['input']>;
  nutritionLogEntries?: InputMaybe<NutritionLogEntries_Arr_Rel_Insert_Input>;
  nutritionPlanMeal?: InputMaybe<NutritionPlanMeals_Obj_Rel_Insert_Input>;
  nutritionPlanMealId?: InputMaybe<Scalars['uuid']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  /** Client-supplied logged time-of-day for the meal group. For planned meals this defaults to now, not the template slot time. */
  slotTime?: InputMaybe<Scalars['time']['input']>;
};

/** aggregate max on columns */
export type NutritionLogMeals_Max_Fields = {
  __typename?: 'nutritionLogMeals_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  mealId?: Maybe<Scalars['uuid']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  nutritionDayId?: Maybe<Scalars['uuid']['output']>;
  nutritionPlanMealId?: Maybe<Scalars['uuid']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  /** Client-supplied logged time-of-day for the meal group. For planned meals this defaults to now, not the template slot time. */
  slotTime?: Maybe<Scalars['time']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by max() on columns of table "nutrition_log_meals" */
export type NutritionLogMeals_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  mealId?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  nutritionDayId?: InputMaybe<Order_By>;
  nutritionPlanMealId?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  /** Client-supplied logged time-of-day for the meal group. For planned meals this defaults to now, not the template slot time. */
  slotTime?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type NutritionLogMeals_Min_Fields = {
  __typename?: 'nutritionLogMeals_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  mealId?: Maybe<Scalars['uuid']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  nutritionDayId?: Maybe<Scalars['uuid']['output']>;
  nutritionPlanMealId?: Maybe<Scalars['uuid']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  /** Client-supplied logged time-of-day for the meal group. For planned meals this defaults to now, not the template slot time. */
  slotTime?: Maybe<Scalars['time']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by min() on columns of table "nutrition_log_meals" */
export type NutritionLogMeals_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  mealId?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  nutritionDayId?: InputMaybe<Order_By>;
  nutritionPlanMealId?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  /** Client-supplied logged time-of-day for the meal group. For planned meals this defaults to now, not the template slot time. */
  slotTime?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "nutrition_log_meals" */
export type NutritionLogMeals_Mutation_Response = {
  __typename?: 'nutritionLogMeals_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<NutritionLogMeals>;
};

/** input type for inserting object relation for remote table "nutrition_log_meals" */
export type NutritionLogMeals_Obj_Rel_Insert_Input = {
  data: NutritionLogMeals_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<NutritionLogMeals_On_Conflict>;
};

/** on_conflict condition type for table "nutrition_log_meals" */
export type NutritionLogMeals_On_Conflict = {
  constraint: NutritionLogMeals_Constraint;
  update_columns?: Array<NutritionLogMeals_Update_Column>;
  where?: InputMaybe<NutritionLogMeals_Bool_Exp>;
};

/** Ordering options when selecting data from "nutrition_log_meals". */
export type NutritionLogMeals_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  meal?: InputMaybe<Meals_Order_By>;
  mealId?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  nutritionDay?: InputMaybe<NutritionDays_Order_By>;
  nutritionDayId?: InputMaybe<Order_By>;
  nutritionLogEntries_aggregate?: InputMaybe<NutritionLogEntries_Aggregate_Order_By>;
  nutritionPlanMeal?: InputMaybe<NutritionPlanMeals_Order_By>;
  nutritionPlanMealId?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  /** Client-supplied logged time-of-day for the meal group. For planned meals this defaults to now, not the template slot time. */
  slotTime?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** primary key columns input for table: nutrition_log_meals */
export type NutritionLogMeals_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "nutrition_log_meals" */
export enum NutritionLogMeals_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  MealId = 'mealId',
  /** column name */
  Name = 'name',
  /** column name */
  NutritionDayId = 'nutritionDayId',
  /** column name */
  NutritionPlanMealId = 'nutritionPlanMealId',
  /** column name */
  Position = 'position',
  /** Client-supplied logged time-of-day for the meal group. For planned meals this defaults to now, not the template slot time. */
  SlotTime = 'slotTime',
  /** column name */
  UpdatedAt = 'updatedAt'
}

/** input type for updating data in table "nutrition_log_meals" */
export type NutritionLogMeals_Set_Input = {
  name?: InputMaybe<Scalars['String']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  /** Client-supplied logged time-of-day for the meal group. For planned meals this defaults to now, not the template slot time. */
  slotTime?: InputMaybe<Scalars['time']['input']>;
};

/** aggregate stddev on columns */
export type NutritionLogMeals_Stddev_Fields = {
  __typename?: 'nutritionLogMeals_stddev_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "nutrition_log_meals" */
export type NutritionLogMeals_Stddev_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type NutritionLogMeals_Stddev_Pop_Fields = {
  __typename?: 'nutritionLogMeals_stddev_pop_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "nutrition_log_meals" */
export type NutritionLogMeals_Stddev_Pop_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type NutritionLogMeals_Stddev_Samp_Fields = {
  __typename?: 'nutritionLogMeals_stddev_samp_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "nutrition_log_meals" */
export type NutritionLogMeals_Stddev_Samp_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "nutritionLogMeals" */
export type NutritionLogMeals_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: NutritionLogMeals_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type NutritionLogMeals_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  mealId?: InputMaybe<Scalars['uuid']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  nutritionDayId?: InputMaybe<Scalars['uuid']['input']>;
  nutritionPlanMealId?: InputMaybe<Scalars['uuid']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  /** Client-supplied logged time-of-day for the meal group. For planned meals this defaults to now, not the template slot time. */
  slotTime?: InputMaybe<Scalars['time']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate sum on columns */
export type NutritionLogMeals_Sum_Fields = {
  __typename?: 'nutritionLogMeals_sum_fields';
  position?: Maybe<Scalars['Int']['output']>;
};

/** order by sum() on columns of table "nutrition_log_meals" */
export type NutritionLogMeals_Sum_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** update columns of table "nutrition_log_meals" */
export enum NutritionLogMeals_Update_Column {
  /** column name */
  Name = 'name',
  /** column name */
  Position = 'position',
  /** Client-supplied logged time-of-day for the meal group. For planned meals this defaults to now, not the template slot time. */
  SlotTime = 'slotTime'
}

export type NutritionLogMeals_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<NutritionLogMeals_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<NutritionLogMeals_Set_Input>;
  /** filter the rows which have to be updated */
  where: NutritionLogMeals_Bool_Exp;
};

/** aggregate var_pop on columns */
export type NutritionLogMeals_Var_Pop_Fields = {
  __typename?: 'nutritionLogMeals_var_pop_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "nutrition_log_meals" */
export type NutritionLogMeals_Var_Pop_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type NutritionLogMeals_Var_Samp_Fields = {
  __typename?: 'nutritionLogMeals_var_samp_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "nutrition_log_meals" */
export type NutritionLogMeals_Var_Samp_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type NutritionLogMeals_Variance_Fields = {
  __typename?: 'nutritionLogMeals_variance_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "nutrition_log_meals" */
export type NutritionLogMeals_Variance_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** Direct food entries in reusable nutrition plan templates. Mixed meal/food plan ordering is client-managed with slot_time plus a global per-slot position across nutrition_plan_meals and nutrition_plan_foods. */
export type NutritionPlanFoods = {
  __typename?: 'nutritionPlanFoods';
  createdAt: Scalars['timestamptz']['output'];
  /** An object relationship */
  food: Foods;
  foodId: Scalars['uuid']['output'];
  grams: Scalars['numeric']['output'];
  id: Scalars['uuid']['output'];
  label?: Maybe<Scalars['String']['output']>;
  /** An array relationship */
  nutritionLogEntries: Array<NutritionLogEntries>;
  /** An aggregate relationship */
  nutritionLogEntries_aggregate: NutritionLogEntries_Aggregate;
  /** An object relationship */
  nutritionPlan: NutritionPlans;
  nutritionPlanId: Scalars['uuid']['output'];
  position: Scalars['Int']['output'];
  /** Template suggestion time. Logging from this entry should default the actual consumed time to now and keep this only as provenance/suggestion. */
  slotTime: Scalars['time']['output'];
  updatedAt: Scalars['timestamptz']['output'];
};


/** Direct food entries in reusable nutrition plan templates. Mixed meal/food plan ordering is client-managed with slot_time plus a global per-slot position across nutrition_plan_meals and nutrition_plan_foods. */
export type NutritionPlanFoodsNutritionLogEntriesArgs = {
  distinct_on?: InputMaybe<Array<NutritionLogEntries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionLogEntries_Order_By>>;
  where?: InputMaybe<NutritionLogEntries_Bool_Exp>;
};


/** Direct food entries in reusable nutrition plan templates. Mixed meal/food plan ordering is client-managed with slot_time plus a global per-slot position across nutrition_plan_meals and nutrition_plan_foods. */
export type NutritionPlanFoodsNutritionLogEntries_AggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionLogEntries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionLogEntries_Order_By>>;
  where?: InputMaybe<NutritionLogEntries_Bool_Exp>;
};

/** aggregated selection of "nutrition_plan_foods" */
export type NutritionPlanFoods_Aggregate = {
  __typename?: 'nutritionPlanFoods_aggregate';
  aggregate?: Maybe<NutritionPlanFoods_Aggregate_Fields>;
  nodes: Array<NutritionPlanFoods>;
};

export type NutritionPlanFoods_Aggregate_Bool_Exp = {
  count?: InputMaybe<NutritionPlanFoods_Aggregate_Bool_Exp_Count>;
};

export type NutritionPlanFoods_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<NutritionPlanFoods_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<NutritionPlanFoods_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "nutrition_plan_foods" */
export type NutritionPlanFoods_Aggregate_Fields = {
  __typename?: 'nutritionPlanFoods_aggregate_fields';
  avg?: Maybe<NutritionPlanFoods_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<NutritionPlanFoods_Max_Fields>;
  min?: Maybe<NutritionPlanFoods_Min_Fields>;
  stddev?: Maybe<NutritionPlanFoods_Stddev_Fields>;
  stddev_pop?: Maybe<NutritionPlanFoods_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<NutritionPlanFoods_Stddev_Samp_Fields>;
  sum?: Maybe<NutritionPlanFoods_Sum_Fields>;
  var_pop?: Maybe<NutritionPlanFoods_Var_Pop_Fields>;
  var_samp?: Maybe<NutritionPlanFoods_Var_Samp_Fields>;
  variance?: Maybe<NutritionPlanFoods_Variance_Fields>;
};


/** aggregate fields of "nutrition_plan_foods" */
export type NutritionPlanFoods_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<NutritionPlanFoods_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "nutrition_plan_foods" */
export type NutritionPlanFoods_Aggregate_Order_By = {
  avg?: InputMaybe<NutritionPlanFoods_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<NutritionPlanFoods_Max_Order_By>;
  min?: InputMaybe<NutritionPlanFoods_Min_Order_By>;
  stddev?: InputMaybe<NutritionPlanFoods_Stddev_Order_By>;
  stddev_pop?: InputMaybe<NutritionPlanFoods_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<NutritionPlanFoods_Stddev_Samp_Order_By>;
  sum?: InputMaybe<NutritionPlanFoods_Sum_Order_By>;
  var_pop?: InputMaybe<NutritionPlanFoods_Var_Pop_Order_By>;
  var_samp?: InputMaybe<NutritionPlanFoods_Var_Samp_Order_By>;
  variance?: InputMaybe<NutritionPlanFoods_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "nutrition_plan_foods" */
export type NutritionPlanFoods_Arr_Rel_Insert_Input = {
  data: Array<NutritionPlanFoods_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<NutritionPlanFoods_On_Conflict>;
};

/** aggregate avg on columns */
export type NutritionPlanFoods_Avg_Fields = {
  __typename?: 'nutritionPlanFoods_avg_fields';
  grams?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "nutrition_plan_foods" */
export type NutritionPlanFoods_Avg_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "nutrition_plan_foods". All fields are combined with a logical 'AND'. */
export type NutritionPlanFoods_Bool_Exp = {
  _and?: InputMaybe<Array<NutritionPlanFoods_Bool_Exp>>;
  _not?: InputMaybe<NutritionPlanFoods_Bool_Exp>;
  _or?: InputMaybe<Array<NutritionPlanFoods_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  food?: InputMaybe<Foods_Bool_Exp>;
  foodId?: InputMaybe<Uuid_Comparison_Exp>;
  grams?: InputMaybe<Numeric_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  label?: InputMaybe<String_Comparison_Exp>;
  nutritionLogEntries?: InputMaybe<NutritionLogEntries_Bool_Exp>;
  nutritionLogEntries_aggregate?: InputMaybe<NutritionLogEntries_Aggregate_Bool_Exp>;
  nutritionPlan?: InputMaybe<NutritionPlans_Bool_Exp>;
  nutritionPlanId?: InputMaybe<Uuid_Comparison_Exp>;
  position?: InputMaybe<Int_Comparison_Exp>;
  /** Template suggestion time. Logging from this entry should default the actual consumed time to now and keep this only as provenance/suggestion. */
  slotTime?: InputMaybe<Time_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "nutrition_plan_foods" */
export enum NutritionPlanFoods_Constraint {
  /** unique or primary key constraint on columns "id" */
  NutritionPlanFoodsPkey = 'nutrition_plan_foods_pkey'
}

/** input type for incrementing numeric columns in table "nutrition_plan_foods" */
export type NutritionPlanFoods_Inc_Input = {
  grams?: InputMaybe<Scalars['numeric']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "nutrition_plan_foods" */
export type NutritionPlanFoods_Insert_Input = {
  food?: InputMaybe<Foods_Obj_Rel_Insert_Input>;
  foodId?: InputMaybe<Scalars['uuid']['input']>;
  grams?: InputMaybe<Scalars['numeric']['input']>;
  label?: InputMaybe<Scalars['String']['input']>;
  nutritionLogEntries?: InputMaybe<NutritionLogEntries_Arr_Rel_Insert_Input>;
  nutritionPlan?: InputMaybe<NutritionPlans_Obj_Rel_Insert_Input>;
  nutritionPlanId?: InputMaybe<Scalars['uuid']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  /** Template suggestion time. Logging from this entry should default the actual consumed time to now and keep this only as provenance/suggestion. */
  slotTime?: InputMaybe<Scalars['time']['input']>;
};

/** aggregate max on columns */
export type NutritionPlanFoods_Max_Fields = {
  __typename?: 'nutritionPlanFoods_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  foodId?: Maybe<Scalars['uuid']['output']>;
  grams?: Maybe<Scalars['numeric']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  nutritionPlanId?: Maybe<Scalars['uuid']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  /** Template suggestion time. Logging from this entry should default the actual consumed time to now and keep this only as provenance/suggestion. */
  slotTime?: Maybe<Scalars['time']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by max() on columns of table "nutrition_plan_foods" */
export type NutritionPlanFoods_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  foodId?: InputMaybe<Order_By>;
  grams?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  label?: InputMaybe<Order_By>;
  nutritionPlanId?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  /** Template suggestion time. Logging from this entry should default the actual consumed time to now and keep this only as provenance/suggestion. */
  slotTime?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type NutritionPlanFoods_Min_Fields = {
  __typename?: 'nutritionPlanFoods_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  foodId?: Maybe<Scalars['uuid']['output']>;
  grams?: Maybe<Scalars['numeric']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  nutritionPlanId?: Maybe<Scalars['uuid']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  /** Template suggestion time. Logging from this entry should default the actual consumed time to now and keep this only as provenance/suggestion. */
  slotTime?: Maybe<Scalars['time']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by min() on columns of table "nutrition_plan_foods" */
export type NutritionPlanFoods_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  foodId?: InputMaybe<Order_By>;
  grams?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  label?: InputMaybe<Order_By>;
  nutritionPlanId?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  /** Template suggestion time. Logging from this entry should default the actual consumed time to now and keep this only as provenance/suggestion. */
  slotTime?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "nutrition_plan_foods" */
export type NutritionPlanFoods_Mutation_Response = {
  __typename?: 'nutritionPlanFoods_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<NutritionPlanFoods>;
};

/** input type for inserting object relation for remote table "nutrition_plan_foods" */
export type NutritionPlanFoods_Obj_Rel_Insert_Input = {
  data: NutritionPlanFoods_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<NutritionPlanFoods_On_Conflict>;
};

/** on_conflict condition type for table "nutrition_plan_foods" */
export type NutritionPlanFoods_On_Conflict = {
  constraint: NutritionPlanFoods_Constraint;
  update_columns?: Array<NutritionPlanFoods_Update_Column>;
  where?: InputMaybe<NutritionPlanFoods_Bool_Exp>;
};

/** Ordering options when selecting data from "nutrition_plan_foods". */
export type NutritionPlanFoods_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  food?: InputMaybe<Foods_Order_By>;
  foodId?: InputMaybe<Order_By>;
  grams?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  label?: InputMaybe<Order_By>;
  nutritionLogEntries_aggregate?: InputMaybe<NutritionLogEntries_Aggregate_Order_By>;
  nutritionPlan?: InputMaybe<NutritionPlans_Order_By>;
  nutritionPlanId?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  /** Template suggestion time. Logging from this entry should default the actual consumed time to now and keep this only as provenance/suggestion. */
  slotTime?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** primary key columns input for table: nutrition_plan_foods */
export type NutritionPlanFoods_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "nutrition_plan_foods" */
export enum NutritionPlanFoods_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  FoodId = 'foodId',
  /** column name */
  Grams = 'grams',
  /** column name */
  Id = 'id',
  /** column name */
  Label = 'label',
  /** column name */
  NutritionPlanId = 'nutritionPlanId',
  /** column name */
  Position = 'position',
  /** Template suggestion time. Logging from this entry should default the actual consumed time to now and keep this only as provenance/suggestion. */
  SlotTime = 'slotTime',
  /** column name */
  UpdatedAt = 'updatedAt'
}

/** input type for updating data in table "nutrition_plan_foods" */
export type NutritionPlanFoods_Set_Input = {
  grams?: InputMaybe<Scalars['numeric']['input']>;
  label?: InputMaybe<Scalars['String']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  /** Template suggestion time. Logging from this entry should default the actual consumed time to now and keep this only as provenance/suggestion. */
  slotTime?: InputMaybe<Scalars['time']['input']>;
};

/** aggregate stddev on columns */
export type NutritionPlanFoods_Stddev_Fields = {
  __typename?: 'nutritionPlanFoods_stddev_fields';
  grams?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "nutrition_plan_foods" */
export type NutritionPlanFoods_Stddev_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type NutritionPlanFoods_Stddev_Pop_Fields = {
  __typename?: 'nutritionPlanFoods_stddev_pop_fields';
  grams?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "nutrition_plan_foods" */
export type NutritionPlanFoods_Stddev_Pop_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type NutritionPlanFoods_Stddev_Samp_Fields = {
  __typename?: 'nutritionPlanFoods_stddev_samp_fields';
  grams?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "nutrition_plan_foods" */
export type NutritionPlanFoods_Stddev_Samp_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "nutritionPlanFoods" */
export type NutritionPlanFoods_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: NutritionPlanFoods_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type NutritionPlanFoods_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  foodId?: InputMaybe<Scalars['uuid']['input']>;
  grams?: InputMaybe<Scalars['numeric']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  label?: InputMaybe<Scalars['String']['input']>;
  nutritionPlanId?: InputMaybe<Scalars['uuid']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  /** Template suggestion time. Logging from this entry should default the actual consumed time to now and keep this only as provenance/suggestion. */
  slotTime?: InputMaybe<Scalars['time']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate sum on columns */
export type NutritionPlanFoods_Sum_Fields = {
  __typename?: 'nutritionPlanFoods_sum_fields';
  grams?: Maybe<Scalars['numeric']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
};

/** order by sum() on columns of table "nutrition_plan_foods" */
export type NutritionPlanFoods_Sum_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
};

/** update columns of table "nutrition_plan_foods" */
export enum NutritionPlanFoods_Update_Column {
  /** column name */
  Grams = 'grams',
  /** column name */
  Label = 'label',
  /** column name */
  Position = 'position',
  /** Template suggestion time. Logging from this entry should default the actual consumed time to now and keep this only as provenance/suggestion. */
  SlotTime = 'slotTime'
}

export type NutritionPlanFoods_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<NutritionPlanFoods_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<NutritionPlanFoods_Set_Input>;
  /** filter the rows which have to be updated */
  where: NutritionPlanFoods_Bool_Exp;
};

/** aggregate var_pop on columns */
export type NutritionPlanFoods_Var_Pop_Fields = {
  __typename?: 'nutritionPlanFoods_var_pop_fields';
  grams?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "nutrition_plan_foods" */
export type NutritionPlanFoods_Var_Pop_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type NutritionPlanFoods_Var_Samp_Fields = {
  __typename?: 'nutritionPlanFoods_var_samp_fields';
  grams?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "nutrition_plan_foods" */
export type NutritionPlanFoods_Var_Samp_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type NutritionPlanFoods_Variance_Fields = {
  __typename?: 'nutritionPlanFoods_variance_fields';
  grams?: Maybe<Scalars['Float']['output']>;
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "nutrition_plan_foods" */
export type NutritionPlanFoods_Variance_Order_By = {
  grams?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
};

/** columns and relationships of "nutrition_plan_meals" */
export type NutritionPlanMeals = {
  __typename?: 'nutritionPlanMeals';
  createdAt: Scalars['timestamptz']['output'];
  id: Scalars['uuid']['output'];
  label?: Maybe<Scalars['String']['output']>;
  /** An object relationship */
  meal: Meals;
  mealId: Scalars['uuid']['output'];
  /** An array relationship */
  nutritionLogMeals: Array<NutritionLogMeals>;
  /** An aggregate relationship */
  nutritionLogMeals_aggregate: NutritionLogMeals_Aggregate;
  /** An object relationship */
  nutritionPlan: NutritionPlans;
  nutritionPlanId: Scalars['uuid']['output'];
  position: Scalars['Int']['output'];
  slotTime: Scalars['time']['output'];
  updatedAt: Scalars['timestamptz']['output'];
};


/** columns and relationships of "nutrition_plan_meals" */
export type NutritionPlanMealsNutritionLogMealsArgs = {
  distinct_on?: InputMaybe<Array<NutritionLogMeals_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionLogMeals_Order_By>>;
  where?: InputMaybe<NutritionLogMeals_Bool_Exp>;
};


/** columns and relationships of "nutrition_plan_meals" */
export type NutritionPlanMealsNutritionLogMeals_AggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionLogMeals_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionLogMeals_Order_By>>;
  where?: InputMaybe<NutritionLogMeals_Bool_Exp>;
};

/** aggregated selection of "nutrition_plan_meals" */
export type NutritionPlanMeals_Aggregate = {
  __typename?: 'nutritionPlanMeals_aggregate';
  aggregate?: Maybe<NutritionPlanMeals_Aggregate_Fields>;
  nodes: Array<NutritionPlanMeals>;
};

export type NutritionPlanMeals_Aggregate_Bool_Exp = {
  count?: InputMaybe<NutritionPlanMeals_Aggregate_Bool_Exp_Count>;
};

export type NutritionPlanMeals_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<NutritionPlanMeals_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<NutritionPlanMeals_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "nutrition_plan_meals" */
export type NutritionPlanMeals_Aggregate_Fields = {
  __typename?: 'nutritionPlanMeals_aggregate_fields';
  avg?: Maybe<NutritionPlanMeals_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<NutritionPlanMeals_Max_Fields>;
  min?: Maybe<NutritionPlanMeals_Min_Fields>;
  stddev?: Maybe<NutritionPlanMeals_Stddev_Fields>;
  stddev_pop?: Maybe<NutritionPlanMeals_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<NutritionPlanMeals_Stddev_Samp_Fields>;
  sum?: Maybe<NutritionPlanMeals_Sum_Fields>;
  var_pop?: Maybe<NutritionPlanMeals_Var_Pop_Fields>;
  var_samp?: Maybe<NutritionPlanMeals_Var_Samp_Fields>;
  variance?: Maybe<NutritionPlanMeals_Variance_Fields>;
};


/** aggregate fields of "nutrition_plan_meals" */
export type NutritionPlanMeals_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<NutritionPlanMeals_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "nutrition_plan_meals" */
export type NutritionPlanMeals_Aggregate_Order_By = {
  avg?: InputMaybe<NutritionPlanMeals_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<NutritionPlanMeals_Max_Order_By>;
  min?: InputMaybe<NutritionPlanMeals_Min_Order_By>;
  stddev?: InputMaybe<NutritionPlanMeals_Stddev_Order_By>;
  stddev_pop?: InputMaybe<NutritionPlanMeals_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<NutritionPlanMeals_Stddev_Samp_Order_By>;
  sum?: InputMaybe<NutritionPlanMeals_Sum_Order_By>;
  var_pop?: InputMaybe<NutritionPlanMeals_Var_Pop_Order_By>;
  var_samp?: InputMaybe<NutritionPlanMeals_Var_Samp_Order_By>;
  variance?: InputMaybe<NutritionPlanMeals_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "nutrition_plan_meals" */
export type NutritionPlanMeals_Arr_Rel_Insert_Input = {
  data: Array<NutritionPlanMeals_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<NutritionPlanMeals_On_Conflict>;
};

/** aggregate avg on columns */
export type NutritionPlanMeals_Avg_Fields = {
  __typename?: 'nutritionPlanMeals_avg_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "nutrition_plan_meals" */
export type NutritionPlanMeals_Avg_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "nutrition_plan_meals". All fields are combined with a logical 'AND'. */
export type NutritionPlanMeals_Bool_Exp = {
  _and?: InputMaybe<Array<NutritionPlanMeals_Bool_Exp>>;
  _not?: InputMaybe<NutritionPlanMeals_Bool_Exp>;
  _or?: InputMaybe<Array<NutritionPlanMeals_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  label?: InputMaybe<String_Comparison_Exp>;
  meal?: InputMaybe<Meals_Bool_Exp>;
  mealId?: InputMaybe<Uuid_Comparison_Exp>;
  nutritionLogMeals?: InputMaybe<NutritionLogMeals_Bool_Exp>;
  nutritionLogMeals_aggregate?: InputMaybe<NutritionLogMeals_Aggregate_Bool_Exp>;
  nutritionPlan?: InputMaybe<NutritionPlans_Bool_Exp>;
  nutritionPlanId?: InputMaybe<Uuid_Comparison_Exp>;
  position?: InputMaybe<Int_Comparison_Exp>;
  slotTime?: InputMaybe<Time_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
};

/** unique or primary key constraints on table "nutrition_plan_meals" */
export enum NutritionPlanMeals_Constraint {
  /** unique or primary key constraint on columns "id" */
  NutritionPlanMealsPkey = 'nutrition_plan_meals_pkey'
}

/** input type for incrementing numeric columns in table "nutrition_plan_meals" */
export type NutritionPlanMeals_Inc_Input = {
  position?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "nutrition_plan_meals" */
export type NutritionPlanMeals_Insert_Input = {
  label?: InputMaybe<Scalars['String']['input']>;
  meal?: InputMaybe<Meals_Obj_Rel_Insert_Input>;
  mealId?: InputMaybe<Scalars['uuid']['input']>;
  nutritionLogMeals?: InputMaybe<NutritionLogMeals_Arr_Rel_Insert_Input>;
  nutritionPlan?: InputMaybe<NutritionPlans_Obj_Rel_Insert_Input>;
  nutritionPlanId?: InputMaybe<Scalars['uuid']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  slotTime?: InputMaybe<Scalars['time']['input']>;
};

/** aggregate max on columns */
export type NutritionPlanMeals_Max_Fields = {
  __typename?: 'nutritionPlanMeals_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  mealId?: Maybe<Scalars['uuid']['output']>;
  nutritionPlanId?: Maybe<Scalars['uuid']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  slotTime?: Maybe<Scalars['time']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by max() on columns of table "nutrition_plan_meals" */
export type NutritionPlanMeals_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  label?: InputMaybe<Order_By>;
  mealId?: InputMaybe<Order_By>;
  nutritionPlanId?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  slotTime?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type NutritionPlanMeals_Min_Fields = {
  __typename?: 'nutritionPlanMeals_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  mealId?: Maybe<Scalars['uuid']['output']>;
  nutritionPlanId?: Maybe<Scalars['uuid']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  slotTime?: Maybe<Scalars['time']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
};

/** order by min() on columns of table "nutrition_plan_meals" */
export type NutritionPlanMeals_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  label?: InputMaybe<Order_By>;
  mealId?: InputMaybe<Order_By>;
  nutritionPlanId?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  slotTime?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "nutrition_plan_meals" */
export type NutritionPlanMeals_Mutation_Response = {
  __typename?: 'nutritionPlanMeals_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<NutritionPlanMeals>;
};

/** input type for inserting object relation for remote table "nutrition_plan_meals" */
export type NutritionPlanMeals_Obj_Rel_Insert_Input = {
  data: NutritionPlanMeals_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<NutritionPlanMeals_On_Conflict>;
};

/** on_conflict condition type for table "nutrition_plan_meals" */
export type NutritionPlanMeals_On_Conflict = {
  constraint: NutritionPlanMeals_Constraint;
  update_columns?: Array<NutritionPlanMeals_Update_Column>;
  where?: InputMaybe<NutritionPlanMeals_Bool_Exp>;
};

/** Ordering options when selecting data from "nutrition_plan_meals". */
export type NutritionPlanMeals_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  label?: InputMaybe<Order_By>;
  meal?: InputMaybe<Meals_Order_By>;
  mealId?: InputMaybe<Order_By>;
  nutritionLogMeals_aggregate?: InputMaybe<NutritionLogMeals_Aggregate_Order_By>;
  nutritionPlan?: InputMaybe<NutritionPlans_Order_By>;
  nutritionPlanId?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  slotTime?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
};

/** primary key columns input for table: nutrition_plan_meals */
export type NutritionPlanMeals_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "nutrition_plan_meals" */
export enum NutritionPlanMeals_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Id = 'id',
  /** column name */
  Label = 'label',
  /** column name */
  MealId = 'mealId',
  /** column name */
  NutritionPlanId = 'nutritionPlanId',
  /** column name */
  Position = 'position',
  /** column name */
  SlotTime = 'slotTime',
  /** column name */
  UpdatedAt = 'updatedAt'
}

/** input type for updating data in table "nutrition_plan_meals" */
export type NutritionPlanMeals_Set_Input = {
  label?: InputMaybe<Scalars['String']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  slotTime?: InputMaybe<Scalars['time']['input']>;
};

/** aggregate stddev on columns */
export type NutritionPlanMeals_Stddev_Fields = {
  __typename?: 'nutritionPlanMeals_stddev_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "nutrition_plan_meals" */
export type NutritionPlanMeals_Stddev_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type NutritionPlanMeals_Stddev_Pop_Fields = {
  __typename?: 'nutritionPlanMeals_stddev_pop_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "nutrition_plan_meals" */
export type NutritionPlanMeals_Stddev_Pop_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type NutritionPlanMeals_Stddev_Samp_Fields = {
  __typename?: 'nutritionPlanMeals_stddev_samp_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "nutrition_plan_meals" */
export type NutritionPlanMeals_Stddev_Samp_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "nutritionPlanMeals" */
export type NutritionPlanMeals_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: NutritionPlanMeals_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type NutritionPlanMeals_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  label?: InputMaybe<Scalars['String']['input']>;
  mealId?: InputMaybe<Scalars['uuid']['input']>;
  nutritionPlanId?: InputMaybe<Scalars['uuid']['input']>;
  position?: InputMaybe<Scalars['Int']['input']>;
  slotTime?: InputMaybe<Scalars['time']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
};

/** aggregate sum on columns */
export type NutritionPlanMeals_Sum_Fields = {
  __typename?: 'nutritionPlanMeals_sum_fields';
  position?: Maybe<Scalars['Int']['output']>;
};

/** order by sum() on columns of table "nutrition_plan_meals" */
export type NutritionPlanMeals_Sum_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** update columns of table "nutrition_plan_meals" */
export enum NutritionPlanMeals_Update_Column {
  /** column name */
  Label = 'label',
  /** column name */
  Position = 'position',
  /** column name */
  SlotTime = 'slotTime'
}

export type NutritionPlanMeals_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<NutritionPlanMeals_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<NutritionPlanMeals_Set_Input>;
  /** filter the rows which have to be updated */
  where: NutritionPlanMeals_Bool_Exp;
};

/** aggregate var_pop on columns */
export type NutritionPlanMeals_Var_Pop_Fields = {
  __typename?: 'nutritionPlanMeals_var_pop_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "nutrition_plan_meals" */
export type NutritionPlanMeals_Var_Pop_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type NutritionPlanMeals_Var_Samp_Fields = {
  __typename?: 'nutritionPlanMeals_var_samp_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "nutrition_plan_meals" */
export type NutritionPlanMeals_Var_Samp_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type NutritionPlanMeals_Variance_Fields = {
  __typename?: 'nutritionPlanMeals_variance_fields';
  position?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "nutrition_plan_meals" */
export type NutritionPlanMeals_Variance_Order_By = {
  position?: InputMaybe<Order_By>;
};

/** columns and relationships of "nutrition_plans" */
export type NutritionPlans = {
  __typename?: 'nutritionPlans';
  createdAt: Scalars['timestamptz']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['uuid']['output'];
  name: Scalars['String']['output'];
  /** An array relationship */
  nutritionDays: Array<NutritionDays>;
  /** An aggregate relationship */
  nutritionDays_aggregate: NutritionDays_Aggregate;
  /** An array relationship */
  nutritionPlanFoods: Array<NutritionPlanFoods>;
  /** An aggregate relationship */
  nutritionPlanFoods_aggregate: NutritionPlanFoods_Aggregate;
  /** An array relationship */
  nutritionPlanMeals: Array<NutritionPlanMeals>;
  /** An aggregate relationship */
  nutritionPlanMeals_aggregate: NutritionPlanMeals_Aggregate;
  updatedAt: Scalars['timestamptz']['output'];
  userId: Scalars['uuid']['output'];
};


/** columns and relationships of "nutrition_plans" */
export type NutritionPlansNutritionDaysArgs = {
  distinct_on?: InputMaybe<Array<NutritionDays_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionDays_Order_By>>;
  where?: InputMaybe<NutritionDays_Bool_Exp>;
};


/** columns and relationships of "nutrition_plans" */
export type NutritionPlansNutritionDays_AggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionDays_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionDays_Order_By>>;
  where?: InputMaybe<NutritionDays_Bool_Exp>;
};


/** columns and relationships of "nutrition_plans" */
export type NutritionPlansNutritionPlanFoodsArgs = {
  distinct_on?: InputMaybe<Array<NutritionPlanFoods_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionPlanFoods_Order_By>>;
  where?: InputMaybe<NutritionPlanFoods_Bool_Exp>;
};


/** columns and relationships of "nutrition_plans" */
export type NutritionPlansNutritionPlanFoods_AggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionPlanFoods_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionPlanFoods_Order_By>>;
  where?: InputMaybe<NutritionPlanFoods_Bool_Exp>;
};


/** columns and relationships of "nutrition_plans" */
export type NutritionPlansNutritionPlanMealsArgs = {
  distinct_on?: InputMaybe<Array<NutritionPlanMeals_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionPlanMeals_Order_By>>;
  where?: InputMaybe<NutritionPlanMeals_Bool_Exp>;
};


/** columns and relationships of "nutrition_plans" */
export type NutritionPlansNutritionPlanMeals_AggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionPlanMeals_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionPlanMeals_Order_By>>;
  where?: InputMaybe<NutritionPlanMeals_Bool_Exp>;
};

/** aggregated selection of "nutrition_plans" */
export type NutritionPlans_Aggregate = {
  __typename?: 'nutritionPlans_aggregate';
  aggregate?: Maybe<NutritionPlans_Aggregate_Fields>;
  nodes: Array<NutritionPlans>;
};

/** aggregate fields of "nutrition_plans" */
export type NutritionPlans_Aggregate_Fields = {
  __typename?: 'nutritionPlans_aggregate_fields';
  count: Scalars['Int']['output'];
  max?: Maybe<NutritionPlans_Max_Fields>;
  min?: Maybe<NutritionPlans_Min_Fields>;
};


/** aggregate fields of "nutrition_plans" */
export type NutritionPlans_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<NutritionPlans_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** Boolean expression to filter rows from the table "nutrition_plans". All fields are combined with a logical 'AND'. */
export type NutritionPlans_Bool_Exp = {
  _and?: InputMaybe<Array<NutritionPlans_Bool_Exp>>;
  _not?: InputMaybe<NutritionPlans_Bool_Exp>;
  _or?: InputMaybe<Array<NutritionPlans_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  description?: InputMaybe<String_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  name?: InputMaybe<String_Comparison_Exp>;
  nutritionDays?: InputMaybe<NutritionDays_Bool_Exp>;
  nutritionDays_aggregate?: InputMaybe<NutritionDays_Aggregate_Bool_Exp>;
  nutritionPlanFoods?: InputMaybe<NutritionPlanFoods_Bool_Exp>;
  nutritionPlanFoods_aggregate?: InputMaybe<NutritionPlanFoods_Aggregate_Bool_Exp>;
  nutritionPlanMeals?: InputMaybe<NutritionPlanMeals_Bool_Exp>;
  nutritionPlanMeals_aggregate?: InputMaybe<NutritionPlanMeals_Aggregate_Bool_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  userId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "nutrition_plans" */
export enum NutritionPlans_Constraint {
  /** unique or primary key constraint on columns "id" */
  NutritionPlansPkey = 'nutrition_plans_pkey',
  /** unique or primary key constraint on columns "user_id", "name" */
  NutritionPlansUserNameUq = 'nutrition_plans_user_name_uq'
}

/** input type for inserting data into table "nutrition_plans" */
export type NutritionPlans_Insert_Input = {
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  nutritionDays?: InputMaybe<NutritionDays_Arr_Rel_Insert_Input>;
  nutritionPlanFoods?: InputMaybe<NutritionPlanFoods_Arr_Rel_Insert_Input>;
  nutritionPlanMeals?: InputMaybe<NutritionPlanMeals_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type NutritionPlans_Max_Fields = {
  __typename?: 'nutritionPlans_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
};

/** aggregate min on columns */
export type NutritionPlans_Min_Fields = {
  __typename?: 'nutritionPlans_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  userId?: Maybe<Scalars['uuid']['output']>;
};

/** response of any mutation on the table "nutrition_plans" */
export type NutritionPlans_Mutation_Response = {
  __typename?: 'nutritionPlans_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<NutritionPlans>;
};

/** input type for inserting object relation for remote table "nutrition_plans" */
export type NutritionPlans_Obj_Rel_Insert_Input = {
  data: NutritionPlans_Insert_Input;
  /** upsert condition */
  on_conflict?: InputMaybe<NutritionPlans_On_Conflict>;
};

/** on_conflict condition type for table "nutrition_plans" */
export type NutritionPlans_On_Conflict = {
  constraint: NutritionPlans_Constraint;
  update_columns?: Array<NutritionPlans_Update_Column>;
  where?: InputMaybe<NutritionPlans_Bool_Exp>;
};

/** Ordering options when selecting data from "nutrition_plans". */
export type NutritionPlans_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  description?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  name?: InputMaybe<Order_By>;
  nutritionDays_aggregate?: InputMaybe<NutritionDays_Aggregate_Order_By>;
  nutritionPlanFoods_aggregate?: InputMaybe<NutritionPlanFoods_Aggregate_Order_By>;
  nutritionPlanMeals_aggregate?: InputMaybe<NutritionPlanMeals_Aggregate_Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: nutrition_plans */
export type NutritionPlans_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "nutrition_plans" */
export enum NutritionPlans_Select_Column {
  /** column name */
  CreatedAt = 'createdAt',
  /** column name */
  Description = 'description',
  /** column name */
  Id = 'id',
  /** column name */
  Name = 'name',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  UserId = 'userId'
}

/** input type for updating data in table "nutrition_plans" */
export type NutritionPlans_Set_Input = {
  description?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

/** Streaming cursor of the table "nutritionPlans" */
export type NutritionPlans_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: NutritionPlans_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type NutritionPlans_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
  userId?: InputMaybe<Scalars['uuid']['input']>;
};

/** update columns of table "nutrition_plans" */
export enum NutritionPlans_Update_Column {
  /** column name */
  Description = 'description',
  /** column name */
  Name = 'name'
}

export type NutritionPlans_Updates = {
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<NutritionPlans_Set_Input>;
  /** filter the rows which have to be updated */
  where: NutritionPlans_Bool_Exp;
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
  /** fetch data from the table: "daily_energy" */
  dailyEnergyEntries: Array<DailyEnergy>;
  /** fetch aggregated fields from the table: "daily_energy" */
  dailyEnergyEntriesAggregate: DailyEnergy_Aggregate;
  /** fetch data from the table: "daily_energy" using primary key columns */
  dailyEnergyEntry?: Maybe<DailyEnergy>;
  /** fetch data from the table: "exercises" using primary key columns */
  exercise?: Maybe<Exercises>;
  /** fetch data from the table: "exercises_cardio" using primary key columns */
  exerciseCardio?: Maybe<ExercisesCardio>;
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
  /** fetch data from the table: "exercise_secondary_muscle_groups" */
  exerciseSecondaryMuscleGroups: Array<ExerciseSecondaryMuscleGroups>;
  /** fetch aggregated fields from the table: "exercise_secondary_muscle_groups" */
  exerciseSecondaryMuscleGroupsAggregate: ExerciseSecondaryMuscleGroups_Aggregate;
  /** fetch data from the table: "exercises_strength" using primary key columns */
  exerciseStrength?: Maybe<ExercisesStrength>;
  /** fetch data from the table: "exercises" */
  exercises: Array<Exercises>;
  /** fetch aggregated fields from the table: "exercises" */
  exercisesAggregate: Exercises_Aggregate;
  /** fetch data from the table: "exercises_cardio" */
  exercisesCardio: Array<ExercisesCardio>;
  /** fetch aggregated fields from the table: "exercises_cardio" */
  exercisesCardioAggregate: ExercisesCardio_Aggregate;
  /** fetch data from the table: "exercises_strength" */
  exercisesStrength: Array<ExercisesStrength>;
  /** fetch aggregated fields from the table: "exercises_strength" */
  exercisesStrengthAggregate: ExercisesStrength_Aggregate;
  /** fetch data from the table: "storage.files" using primary key columns */
  file?: Maybe<Files>;
  /** fetch data from the table: "storage.files" */
  files: Array<Files>;
  /** fetch data from the table: "foods" using primary key columns */
  food?: Maybe<Foods>;
  /** fetch data from the table: "foods" */
  foods: Array<Foods>;
  /** fetch aggregated fields from the table: "foods" */
  foodsAggregate: Foods_Aggregate;
  /** fetch data from the table: "journal_entries" */
  journalEntries: Array<JournalEntries>;
  /** fetch aggregated fields from the table: "journal_entries" */
  journalEntriesAggregate: JournalEntries_Aggregate;
  /** fetch data from the table: "journal_entries" using primary key columns */
  journalEntry?: Maybe<JournalEntries>;
  /** fetch data from the table: "journal_entry_labels" using primary key columns */
  journalEntryLabel?: Maybe<JournalEntryLabels>;
  /** fetch data from the table: "journal_entry_labels" */
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
  /** fetch data from the table: "meals" using primary key columns */
  meal?: Maybe<Meals>;
  /** fetch data from the table: "meal_ingredients" using primary key columns */
  mealIngredient?: Maybe<MealIngredients>;
  /** fetch data from the table: "meal_ingredients" */
  mealIngredients: Array<MealIngredients>;
  /** fetch aggregated fields from the table: "meal_ingredients" */
  mealIngredientsAggregate: MealIngredients_Aggregate;
  /** fetch data from the table: "meals" */
  meals: Array<Meals>;
  /** fetch aggregated fields from the table: "meals" */
  mealsAggregate: Meals_Aggregate;
  /** fetch data from the table: "muscle_groups" using primary key columns */
  muscleGroup?: Maybe<MuscleGroups>;
  /** fetch data from the table: "muscle_groups" */
  muscleGroups: Array<MuscleGroups>;
  /** fetch aggregated fields from the table: "muscle_groups" */
  muscleGroupsAggregate: MuscleGroups_Aggregate;
  /** fetch data from the table: "nutrition_days" using primary key columns */
  nutritionDay?: Maybe<NutritionDays>;
  /** fetch data from the table: "nutrition_days" */
  nutritionDays: Array<NutritionDays>;
  /** fetch aggregated fields from the table: "nutrition_days" */
  nutritionDaysAggregate: NutritionDays_Aggregate;
  /** fetch data from the table: "nutrition_log_entries" */
  nutritionLogEntries: Array<NutritionLogEntries>;
  /** fetch aggregated fields from the table: "nutrition_log_entries" */
  nutritionLogEntriesAggregate: NutritionLogEntries_Aggregate;
  /** fetch data from the table: "nutrition_log_entries" using primary key columns */
  nutritionLogEntry?: Maybe<NutritionLogEntries>;
  /** fetch data from the table: "nutrition_log_meals" using primary key columns */
  nutritionLogMeal?: Maybe<NutritionLogMeals>;
  /** fetch data from the table: "nutrition_log_meals" */
  nutritionLogMeals: Array<NutritionLogMeals>;
  /** fetch aggregated fields from the table: "nutrition_log_meals" */
  nutritionLogMealsAggregate: NutritionLogMeals_Aggregate;
  /** fetch data from the table: "nutrition_plans" using primary key columns */
  nutritionPlan?: Maybe<NutritionPlans>;
  /** fetch data from the table: "nutrition_plan_foods" using primary key columns */
  nutritionPlanFood?: Maybe<NutritionPlanFoods>;
  /** fetch data from the table: "nutrition_plan_foods" */
  nutritionPlanFoods: Array<NutritionPlanFoods>;
  /** fetch aggregated fields from the table: "nutrition_plan_foods" */
  nutritionPlanFoodsAggregate: NutritionPlanFoods_Aggregate;
  /** fetch data from the table: "nutrition_plan_meals" using primary key columns */
  nutritionPlanMeal?: Maybe<NutritionPlanMeals>;
  /** fetch data from the table: "nutrition_plan_meals" */
  nutritionPlanMeals: Array<NutritionPlanMeals>;
  /** fetch aggregated fields from the table: "nutrition_plan_meals" */
  nutritionPlanMealsAggregate: NutritionPlanMeals_Aggregate;
  /** fetch data from the table: "nutrition_plans" */
  nutritionPlans: Array<NutritionPlans>;
  /** fetch aggregated fields from the table: "nutrition_plans" */
  nutritionPlansAggregate: NutritionPlans_Aggregate;
  /** fetch data from the table: "workouts" using primary key columns */
  workout?: Maybe<Workouts>;
  /** fetch data from the table: "workout_exercises" using primary key columns */
  workoutExercise?: Maybe<WorkoutExercises>;
  /** fetch data from the table: "workout_exercises" */
  workoutExercises: Array<WorkoutExercises>;
  /** fetch aggregated fields from the table: "workout_exercises" */
  workoutExercisesAggregate: WorkoutExercises_Aggregate;
  /** fetch data from the table: "workout_labels" using primary key columns */
  workoutLabel?: Maybe<WorkoutLabels>;
  /** fetch data from the table: "workout_labels" */
  workoutLabels: Array<WorkoutLabels>;
  /** fetch aggregated fields from the table: "workout_labels" */
  workoutLabelsAggregate: WorkoutLabels_Aggregate;
  /** fetch data from the table: "workout_sessions" using primary key columns */
  workoutSession?: Maybe<WorkoutSessions>;
  /** fetch data from the table: "workout_session_cardio_entries" */
  workoutSessionCardioEntries: Array<WorkoutSessionCardioEntries>;
  /** fetch aggregated fields from the table: "workout_session_cardio_entries" */
  workoutSessionCardioEntriesAggregate: WorkoutSessionCardioEntries_Aggregate;
  /** fetch data from the table: "workout_session_cardio_entries" using primary key columns */
  workoutSessionCardioEntry?: Maybe<WorkoutSessionCardioEntries>;
  /** fetch data from the table: "workout_session_exercises" using primary key columns */
  workoutSessionExercise?: Maybe<WorkoutSessionExercises>;
  /** fetch data from the table: "workout_session_exercises" */
  workoutSessionExercises: Array<WorkoutSessionExercises>;
  /** fetch aggregated fields from the table: "workout_session_exercises" */
  workoutSessionExercisesAggregate: WorkoutSessionExercises_Aggregate;
  /** fetch data from the table: "workout_session_strength_sets" using primary key columns */
  workoutSessionStrengthSet?: Maybe<WorkoutSessionStrengthSets>;
  /** fetch data from the table: "workout_session_strength_sets" */
  workoutSessionStrengthSets: Array<WorkoutSessionStrengthSets>;
  /** fetch aggregated fields from the table: "workout_session_strength_sets" */
  workoutSessionStrengthSetsAggregate: WorkoutSessionStrengthSets_Aggregate;
  /** fetch data from the table: "workout_sessions" */
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


export type Query_RootDailyEnergyEntriesArgs = {
  distinct_on?: InputMaybe<Array<DailyEnergy_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<DailyEnergy_Order_By>>;
  where?: InputMaybe<DailyEnergy_Bool_Exp>;
};


export type Query_RootDailyEnergyEntriesAggregateArgs = {
  distinct_on?: InputMaybe<Array<DailyEnergy_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<DailyEnergy_Order_By>>;
  where?: InputMaybe<DailyEnergy_Bool_Exp>;
};


export type Query_RootDailyEnergyEntryArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootExerciseArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootExerciseCardioArgs = {
  exerciseId: Scalars['uuid']['input'];
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


export type Query_RootExerciseStrengthArgs = {
  exerciseId: Scalars['uuid']['input'];
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


export type Query_RootExercisesCardioArgs = {
  distinct_on?: InputMaybe<Array<ExercisesCardio_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExercisesCardio_Order_By>>;
  where?: InputMaybe<ExercisesCardio_Bool_Exp>;
};


export type Query_RootExercisesCardioAggregateArgs = {
  distinct_on?: InputMaybe<Array<ExercisesCardio_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExercisesCardio_Order_By>>;
  where?: InputMaybe<ExercisesCardio_Bool_Exp>;
};


export type Query_RootExercisesStrengthArgs = {
  distinct_on?: InputMaybe<Array<ExercisesStrength_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExercisesStrength_Order_By>>;
  where?: InputMaybe<ExercisesStrength_Bool_Exp>;
};


export type Query_RootExercisesStrengthAggregateArgs = {
  distinct_on?: InputMaybe<Array<ExercisesStrength_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExercisesStrength_Order_By>>;
  where?: InputMaybe<ExercisesStrength_Bool_Exp>;
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


export type Query_RootFoodArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootFoodsArgs = {
  distinct_on?: InputMaybe<Array<Foods_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Foods_Order_By>>;
  where?: InputMaybe<Foods_Bool_Exp>;
};


export type Query_RootFoodsAggregateArgs = {
  distinct_on?: InputMaybe<Array<Foods_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Foods_Order_By>>;
  where?: InputMaybe<Foods_Bool_Exp>;
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


export type Query_RootMealArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootMealIngredientArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootMealIngredientsArgs = {
  distinct_on?: InputMaybe<Array<MealIngredients_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<MealIngredients_Order_By>>;
  where?: InputMaybe<MealIngredients_Bool_Exp>;
};


export type Query_RootMealIngredientsAggregateArgs = {
  distinct_on?: InputMaybe<Array<MealIngredients_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<MealIngredients_Order_By>>;
  where?: InputMaybe<MealIngredients_Bool_Exp>;
};


export type Query_RootMealsArgs = {
  distinct_on?: InputMaybe<Array<Meals_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Meals_Order_By>>;
  where?: InputMaybe<Meals_Bool_Exp>;
};


export type Query_RootMealsAggregateArgs = {
  distinct_on?: InputMaybe<Array<Meals_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Meals_Order_By>>;
  where?: InputMaybe<Meals_Bool_Exp>;
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


export type Query_RootNutritionDayArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootNutritionDaysArgs = {
  distinct_on?: InputMaybe<Array<NutritionDays_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionDays_Order_By>>;
  where?: InputMaybe<NutritionDays_Bool_Exp>;
};


export type Query_RootNutritionDaysAggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionDays_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionDays_Order_By>>;
  where?: InputMaybe<NutritionDays_Bool_Exp>;
};


export type Query_RootNutritionLogEntriesArgs = {
  distinct_on?: InputMaybe<Array<NutritionLogEntries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionLogEntries_Order_By>>;
  where?: InputMaybe<NutritionLogEntries_Bool_Exp>;
};


export type Query_RootNutritionLogEntriesAggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionLogEntries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionLogEntries_Order_By>>;
  where?: InputMaybe<NutritionLogEntries_Bool_Exp>;
};


export type Query_RootNutritionLogEntryArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootNutritionLogMealArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootNutritionLogMealsArgs = {
  distinct_on?: InputMaybe<Array<NutritionLogMeals_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionLogMeals_Order_By>>;
  where?: InputMaybe<NutritionLogMeals_Bool_Exp>;
};


export type Query_RootNutritionLogMealsAggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionLogMeals_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionLogMeals_Order_By>>;
  where?: InputMaybe<NutritionLogMeals_Bool_Exp>;
};


export type Query_RootNutritionPlanArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootNutritionPlanFoodArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootNutritionPlanFoodsArgs = {
  distinct_on?: InputMaybe<Array<NutritionPlanFoods_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionPlanFoods_Order_By>>;
  where?: InputMaybe<NutritionPlanFoods_Bool_Exp>;
};


export type Query_RootNutritionPlanFoodsAggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionPlanFoods_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionPlanFoods_Order_By>>;
  where?: InputMaybe<NutritionPlanFoods_Bool_Exp>;
};


export type Query_RootNutritionPlanMealArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootNutritionPlanMealsArgs = {
  distinct_on?: InputMaybe<Array<NutritionPlanMeals_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionPlanMeals_Order_By>>;
  where?: InputMaybe<NutritionPlanMeals_Bool_Exp>;
};


export type Query_RootNutritionPlanMealsAggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionPlanMeals_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionPlanMeals_Order_By>>;
  where?: InputMaybe<NutritionPlanMeals_Bool_Exp>;
};


export type Query_RootNutritionPlansArgs = {
  distinct_on?: InputMaybe<Array<NutritionPlans_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionPlans_Order_By>>;
  where?: InputMaybe<NutritionPlans_Bool_Exp>;
};


export type Query_RootNutritionPlansAggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionPlans_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionPlans_Order_By>>;
  where?: InputMaybe<NutritionPlans_Bool_Exp>;
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


export type Query_RootWorkoutSessionStrengthSetArgs = {
  id: Scalars['uuid']['input'];
};


export type Query_RootWorkoutSessionStrengthSetsArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionStrengthSets_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionStrengthSets_Order_By>>;
  where?: InputMaybe<WorkoutSessionStrengthSets_Bool_Exp>;
};


export type Query_RootWorkoutSessionStrengthSetsAggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionStrengthSets_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionStrengthSets_Order_By>>;
  where?: InputMaybe<WorkoutSessionStrengthSets_Bool_Exp>;
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
  /** fetch data from the table: "daily_energy" */
  dailyEnergyEntries: Array<DailyEnergy>;
  /** fetch aggregated fields from the table: "daily_energy" */
  dailyEnergyEntriesAggregate: DailyEnergy_Aggregate;
  /** fetch data from the table: "daily_energy" using primary key columns */
  dailyEnergyEntry?: Maybe<DailyEnergy>;
  /** fetch data from the table in a streaming manner: "daily_energy" */
  dailyEnergy_stream: Array<DailyEnergy>;
  /** fetch data from the table: "exercises" using primary key columns */
  exercise?: Maybe<Exercises>;
  /** fetch data from the table: "exercises_cardio" using primary key columns */
  exerciseCardio?: Maybe<ExercisesCardio>;
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
  /** fetch data from the table: "exercise_secondary_muscle_groups" */
  exerciseSecondaryMuscleGroups: Array<ExerciseSecondaryMuscleGroups>;
  /** fetch aggregated fields from the table: "exercise_secondary_muscle_groups" */
  exerciseSecondaryMuscleGroupsAggregate: ExerciseSecondaryMuscleGroups_Aggregate;
  /** fetch data from the table in a streaming manner: "exercise_secondary_muscle_groups" */
  exerciseSecondaryMuscleGroups_stream: Array<ExerciseSecondaryMuscleGroups>;
  /** fetch data from the table: "exercises_strength" using primary key columns */
  exerciseStrength?: Maybe<ExercisesStrength>;
  /** fetch data from the table: "exercises" */
  exercises: Array<Exercises>;
  /** fetch aggregated fields from the table: "exercises" */
  exercisesAggregate: Exercises_Aggregate;
  /** fetch data from the table: "exercises_cardio" */
  exercisesCardio: Array<ExercisesCardio>;
  /** fetch aggregated fields from the table: "exercises_cardio" */
  exercisesCardioAggregate: ExercisesCardio_Aggregate;
  /** fetch data from the table in a streaming manner: "exercises_cardio" */
  exercisesCardio_stream: Array<ExercisesCardio>;
  /** fetch data from the table: "exercises_strength" */
  exercisesStrength: Array<ExercisesStrength>;
  /** fetch aggregated fields from the table: "exercises_strength" */
  exercisesStrengthAggregate: ExercisesStrength_Aggregate;
  /** fetch data from the table in a streaming manner: "exercises_strength" */
  exercisesStrength_stream: Array<ExercisesStrength>;
  /** fetch data from the table in a streaming manner: "exercises" */
  exercises_stream: Array<Exercises>;
  /** fetch data from the table: "storage.files" using primary key columns */
  file?: Maybe<Files>;
  /** fetch data from the table: "storage.files" */
  files: Array<Files>;
  /** fetch data from the table in a streaming manner: "storage.files" */
  files_stream: Array<Files>;
  /** fetch data from the table: "foods" using primary key columns */
  food?: Maybe<Foods>;
  /** fetch data from the table: "foods" */
  foods: Array<Foods>;
  /** fetch aggregated fields from the table: "foods" */
  foodsAggregate: Foods_Aggregate;
  /** fetch data from the table in a streaming manner: "foods" */
  foods_stream: Array<Foods>;
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
  /** fetch data from the table: "journal_entry_labels" */
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
  /** fetch data from the table: "meals" using primary key columns */
  meal?: Maybe<Meals>;
  /** fetch data from the table: "meal_ingredients" using primary key columns */
  mealIngredient?: Maybe<MealIngredients>;
  /** fetch data from the table: "meal_ingredients" */
  mealIngredients: Array<MealIngredients>;
  /** fetch aggregated fields from the table: "meal_ingredients" */
  mealIngredientsAggregate: MealIngredients_Aggregate;
  /** fetch data from the table in a streaming manner: "meal_ingredients" */
  mealIngredients_stream: Array<MealIngredients>;
  /** fetch data from the table: "meals" */
  meals: Array<Meals>;
  /** fetch aggregated fields from the table: "meals" */
  mealsAggregate: Meals_Aggregate;
  /** fetch data from the table in a streaming manner: "meals" */
  meals_stream: Array<Meals>;
  /** fetch data from the table: "muscle_groups" using primary key columns */
  muscleGroup?: Maybe<MuscleGroups>;
  /** fetch data from the table: "muscle_groups" */
  muscleGroups: Array<MuscleGroups>;
  /** fetch aggregated fields from the table: "muscle_groups" */
  muscleGroupsAggregate: MuscleGroups_Aggregate;
  /** fetch data from the table in a streaming manner: "muscle_groups" */
  muscleGroups_stream: Array<MuscleGroups>;
  /** fetch data from the table: "nutrition_days" using primary key columns */
  nutritionDay?: Maybe<NutritionDays>;
  /** fetch data from the table: "nutrition_days" */
  nutritionDays: Array<NutritionDays>;
  /** fetch aggregated fields from the table: "nutrition_days" */
  nutritionDaysAggregate: NutritionDays_Aggregate;
  /** fetch data from the table in a streaming manner: "nutrition_days" */
  nutritionDays_stream: Array<NutritionDays>;
  /** fetch data from the table: "nutrition_log_entries" */
  nutritionLogEntries: Array<NutritionLogEntries>;
  /** fetch aggregated fields from the table: "nutrition_log_entries" */
  nutritionLogEntriesAggregate: NutritionLogEntries_Aggregate;
  /** fetch data from the table in a streaming manner: "nutrition_log_entries" */
  nutritionLogEntries_stream: Array<NutritionLogEntries>;
  /** fetch data from the table: "nutrition_log_entries" using primary key columns */
  nutritionLogEntry?: Maybe<NutritionLogEntries>;
  /** fetch data from the table: "nutrition_log_meals" using primary key columns */
  nutritionLogMeal?: Maybe<NutritionLogMeals>;
  /** fetch data from the table: "nutrition_log_meals" */
  nutritionLogMeals: Array<NutritionLogMeals>;
  /** fetch aggregated fields from the table: "nutrition_log_meals" */
  nutritionLogMealsAggregate: NutritionLogMeals_Aggregate;
  /** fetch data from the table in a streaming manner: "nutrition_log_meals" */
  nutritionLogMeals_stream: Array<NutritionLogMeals>;
  /** fetch data from the table: "nutrition_plans" using primary key columns */
  nutritionPlan?: Maybe<NutritionPlans>;
  /** fetch data from the table: "nutrition_plan_foods" using primary key columns */
  nutritionPlanFood?: Maybe<NutritionPlanFoods>;
  /** fetch data from the table: "nutrition_plan_foods" */
  nutritionPlanFoods: Array<NutritionPlanFoods>;
  /** fetch aggregated fields from the table: "nutrition_plan_foods" */
  nutritionPlanFoodsAggregate: NutritionPlanFoods_Aggregate;
  /** fetch data from the table in a streaming manner: "nutrition_plan_foods" */
  nutritionPlanFoods_stream: Array<NutritionPlanFoods>;
  /** fetch data from the table: "nutrition_plan_meals" using primary key columns */
  nutritionPlanMeal?: Maybe<NutritionPlanMeals>;
  /** fetch data from the table: "nutrition_plan_meals" */
  nutritionPlanMeals: Array<NutritionPlanMeals>;
  /** fetch aggregated fields from the table: "nutrition_plan_meals" */
  nutritionPlanMealsAggregate: NutritionPlanMeals_Aggregate;
  /** fetch data from the table in a streaming manner: "nutrition_plan_meals" */
  nutritionPlanMeals_stream: Array<NutritionPlanMeals>;
  /** fetch data from the table: "nutrition_plans" */
  nutritionPlans: Array<NutritionPlans>;
  /** fetch aggregated fields from the table: "nutrition_plans" */
  nutritionPlansAggregate: NutritionPlans_Aggregate;
  /** fetch data from the table in a streaming manner: "nutrition_plans" */
  nutritionPlans_stream: Array<NutritionPlans>;
  /** fetch data from the table: "workouts" using primary key columns */
  workout?: Maybe<Workouts>;
  /** fetch data from the table: "workout_exercises" using primary key columns */
  workoutExercise?: Maybe<WorkoutExercises>;
  /** fetch data from the table: "workout_exercises" */
  workoutExercises: Array<WorkoutExercises>;
  /** fetch aggregated fields from the table: "workout_exercises" */
  workoutExercisesAggregate: WorkoutExercises_Aggregate;
  /** fetch data from the table in a streaming manner: "workout_exercises" */
  workoutExercises_stream: Array<WorkoutExercises>;
  /** fetch data from the table: "workout_labels" using primary key columns */
  workoutLabel?: Maybe<WorkoutLabels>;
  /** fetch data from the table: "workout_labels" */
  workoutLabels: Array<WorkoutLabels>;
  /** fetch aggregated fields from the table: "workout_labels" */
  workoutLabelsAggregate: WorkoutLabels_Aggregate;
  /** fetch data from the table in a streaming manner: "workout_labels" */
  workoutLabels_stream: Array<WorkoutLabels>;
  /** fetch data from the table: "workout_sessions" using primary key columns */
  workoutSession?: Maybe<WorkoutSessions>;
  /** fetch data from the table: "workout_session_cardio_entries" */
  workoutSessionCardioEntries: Array<WorkoutSessionCardioEntries>;
  /** fetch aggregated fields from the table: "workout_session_cardio_entries" */
  workoutSessionCardioEntriesAggregate: WorkoutSessionCardioEntries_Aggregate;
  /** fetch data from the table in a streaming manner: "workout_session_cardio_entries" */
  workoutSessionCardioEntries_stream: Array<WorkoutSessionCardioEntries>;
  /** fetch data from the table: "workout_session_cardio_entries" using primary key columns */
  workoutSessionCardioEntry?: Maybe<WorkoutSessionCardioEntries>;
  /** fetch data from the table: "workout_session_exercises" using primary key columns */
  workoutSessionExercise?: Maybe<WorkoutSessionExercises>;
  /** fetch data from the table: "workout_session_exercises" */
  workoutSessionExercises: Array<WorkoutSessionExercises>;
  /** fetch aggregated fields from the table: "workout_session_exercises" */
  workoutSessionExercisesAggregate: WorkoutSessionExercises_Aggregate;
  /** fetch data from the table in a streaming manner: "workout_session_exercises" */
  workoutSessionExercises_stream: Array<WorkoutSessionExercises>;
  /** fetch data from the table: "workout_session_strength_sets" using primary key columns */
  workoutSessionStrengthSet?: Maybe<WorkoutSessionStrengthSets>;
  /** fetch data from the table: "workout_session_strength_sets" */
  workoutSessionStrengthSets: Array<WorkoutSessionStrengthSets>;
  /** fetch aggregated fields from the table: "workout_session_strength_sets" */
  workoutSessionStrengthSetsAggregate: WorkoutSessionStrengthSets_Aggregate;
  /** fetch data from the table in a streaming manner: "workout_session_strength_sets" */
  workoutSessionStrengthSets_stream: Array<WorkoutSessionStrengthSets>;
  /** fetch data from the table: "workout_sessions" */
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


export type Subscription_RootDailyEnergyEntriesArgs = {
  distinct_on?: InputMaybe<Array<DailyEnergy_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<DailyEnergy_Order_By>>;
  where?: InputMaybe<DailyEnergy_Bool_Exp>;
};


export type Subscription_RootDailyEnergyEntriesAggregateArgs = {
  distinct_on?: InputMaybe<Array<DailyEnergy_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<DailyEnergy_Order_By>>;
  where?: InputMaybe<DailyEnergy_Bool_Exp>;
};


export type Subscription_RootDailyEnergyEntryArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootDailyEnergy_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<DailyEnergy_Stream_Cursor_Input>>;
  where?: InputMaybe<DailyEnergy_Bool_Exp>;
};


export type Subscription_RootExerciseArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootExerciseCardioArgs = {
  exerciseId: Scalars['uuid']['input'];
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


export type Subscription_RootExerciseStrengthArgs = {
  exerciseId: Scalars['uuid']['input'];
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


export type Subscription_RootExercisesCardioArgs = {
  distinct_on?: InputMaybe<Array<ExercisesCardio_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExercisesCardio_Order_By>>;
  where?: InputMaybe<ExercisesCardio_Bool_Exp>;
};


export type Subscription_RootExercisesCardioAggregateArgs = {
  distinct_on?: InputMaybe<Array<ExercisesCardio_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExercisesCardio_Order_By>>;
  where?: InputMaybe<ExercisesCardio_Bool_Exp>;
};


export type Subscription_RootExercisesCardio_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<ExercisesCardio_Stream_Cursor_Input>>;
  where?: InputMaybe<ExercisesCardio_Bool_Exp>;
};


export type Subscription_RootExercisesStrengthArgs = {
  distinct_on?: InputMaybe<Array<ExercisesStrength_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExercisesStrength_Order_By>>;
  where?: InputMaybe<ExercisesStrength_Bool_Exp>;
};


export type Subscription_RootExercisesStrengthAggregateArgs = {
  distinct_on?: InputMaybe<Array<ExercisesStrength_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<ExercisesStrength_Order_By>>;
  where?: InputMaybe<ExercisesStrength_Bool_Exp>;
};


export type Subscription_RootExercisesStrength_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<ExercisesStrength_Stream_Cursor_Input>>;
  where?: InputMaybe<ExercisesStrength_Bool_Exp>;
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


export type Subscription_RootFoodArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootFoodsArgs = {
  distinct_on?: InputMaybe<Array<Foods_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Foods_Order_By>>;
  where?: InputMaybe<Foods_Bool_Exp>;
};


export type Subscription_RootFoodsAggregateArgs = {
  distinct_on?: InputMaybe<Array<Foods_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Foods_Order_By>>;
  where?: InputMaybe<Foods_Bool_Exp>;
};


export type Subscription_RootFoods_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Foods_Stream_Cursor_Input>>;
  where?: InputMaybe<Foods_Bool_Exp>;
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


export type Subscription_RootMealArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootMealIngredientArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootMealIngredientsArgs = {
  distinct_on?: InputMaybe<Array<MealIngredients_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<MealIngredients_Order_By>>;
  where?: InputMaybe<MealIngredients_Bool_Exp>;
};


export type Subscription_RootMealIngredientsAggregateArgs = {
  distinct_on?: InputMaybe<Array<MealIngredients_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<MealIngredients_Order_By>>;
  where?: InputMaybe<MealIngredients_Bool_Exp>;
};


export type Subscription_RootMealIngredients_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<MealIngredients_Stream_Cursor_Input>>;
  where?: InputMaybe<MealIngredients_Bool_Exp>;
};


export type Subscription_RootMealsArgs = {
  distinct_on?: InputMaybe<Array<Meals_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Meals_Order_By>>;
  where?: InputMaybe<Meals_Bool_Exp>;
};


export type Subscription_RootMealsAggregateArgs = {
  distinct_on?: InputMaybe<Array<Meals_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<Meals_Order_By>>;
  where?: InputMaybe<Meals_Bool_Exp>;
};


export type Subscription_RootMeals_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<Meals_Stream_Cursor_Input>>;
  where?: InputMaybe<Meals_Bool_Exp>;
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


export type Subscription_RootNutritionDayArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootNutritionDaysArgs = {
  distinct_on?: InputMaybe<Array<NutritionDays_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionDays_Order_By>>;
  where?: InputMaybe<NutritionDays_Bool_Exp>;
};


export type Subscription_RootNutritionDaysAggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionDays_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionDays_Order_By>>;
  where?: InputMaybe<NutritionDays_Bool_Exp>;
};


export type Subscription_RootNutritionDays_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<NutritionDays_Stream_Cursor_Input>>;
  where?: InputMaybe<NutritionDays_Bool_Exp>;
};


export type Subscription_RootNutritionLogEntriesArgs = {
  distinct_on?: InputMaybe<Array<NutritionLogEntries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionLogEntries_Order_By>>;
  where?: InputMaybe<NutritionLogEntries_Bool_Exp>;
};


export type Subscription_RootNutritionLogEntriesAggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionLogEntries_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionLogEntries_Order_By>>;
  where?: InputMaybe<NutritionLogEntries_Bool_Exp>;
};


export type Subscription_RootNutritionLogEntries_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<NutritionLogEntries_Stream_Cursor_Input>>;
  where?: InputMaybe<NutritionLogEntries_Bool_Exp>;
};


export type Subscription_RootNutritionLogEntryArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootNutritionLogMealArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootNutritionLogMealsArgs = {
  distinct_on?: InputMaybe<Array<NutritionLogMeals_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionLogMeals_Order_By>>;
  where?: InputMaybe<NutritionLogMeals_Bool_Exp>;
};


export type Subscription_RootNutritionLogMealsAggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionLogMeals_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionLogMeals_Order_By>>;
  where?: InputMaybe<NutritionLogMeals_Bool_Exp>;
};


export type Subscription_RootNutritionLogMeals_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<NutritionLogMeals_Stream_Cursor_Input>>;
  where?: InputMaybe<NutritionLogMeals_Bool_Exp>;
};


export type Subscription_RootNutritionPlanArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootNutritionPlanFoodArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootNutritionPlanFoodsArgs = {
  distinct_on?: InputMaybe<Array<NutritionPlanFoods_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionPlanFoods_Order_By>>;
  where?: InputMaybe<NutritionPlanFoods_Bool_Exp>;
};


export type Subscription_RootNutritionPlanFoodsAggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionPlanFoods_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionPlanFoods_Order_By>>;
  where?: InputMaybe<NutritionPlanFoods_Bool_Exp>;
};


export type Subscription_RootNutritionPlanFoods_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<NutritionPlanFoods_Stream_Cursor_Input>>;
  where?: InputMaybe<NutritionPlanFoods_Bool_Exp>;
};


export type Subscription_RootNutritionPlanMealArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootNutritionPlanMealsArgs = {
  distinct_on?: InputMaybe<Array<NutritionPlanMeals_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionPlanMeals_Order_By>>;
  where?: InputMaybe<NutritionPlanMeals_Bool_Exp>;
};


export type Subscription_RootNutritionPlanMealsAggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionPlanMeals_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionPlanMeals_Order_By>>;
  where?: InputMaybe<NutritionPlanMeals_Bool_Exp>;
};


export type Subscription_RootNutritionPlanMeals_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<NutritionPlanMeals_Stream_Cursor_Input>>;
  where?: InputMaybe<NutritionPlanMeals_Bool_Exp>;
};


export type Subscription_RootNutritionPlansArgs = {
  distinct_on?: InputMaybe<Array<NutritionPlans_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionPlans_Order_By>>;
  where?: InputMaybe<NutritionPlans_Bool_Exp>;
};


export type Subscription_RootNutritionPlansAggregateArgs = {
  distinct_on?: InputMaybe<Array<NutritionPlans_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<NutritionPlans_Order_By>>;
  where?: InputMaybe<NutritionPlans_Bool_Exp>;
};


export type Subscription_RootNutritionPlans_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<NutritionPlans_Stream_Cursor_Input>>;
  where?: InputMaybe<NutritionPlans_Bool_Exp>;
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


export type Subscription_RootWorkoutSessionStrengthSetArgs = {
  id: Scalars['uuid']['input'];
};


export type Subscription_RootWorkoutSessionStrengthSetsArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionStrengthSets_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionStrengthSets_Order_By>>;
  where?: InputMaybe<WorkoutSessionStrengthSets_Bool_Exp>;
};


export type Subscription_RootWorkoutSessionStrengthSetsAggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionStrengthSets_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionStrengthSets_Order_By>>;
  where?: InputMaybe<WorkoutSessionStrengthSets_Bool_Exp>;
};


export type Subscription_RootWorkoutSessionStrengthSets_StreamArgs = {
  batch_size: Scalars['Int']['input'];
  cursor: Array<InputMaybe<WorkoutSessionStrengthSets_Stream_Cursor_Input>>;
  where?: InputMaybe<WorkoutSessionStrengthSets_Bool_Exp>;
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

/** Boolean expression to compare columns of type "time". All fields are combined with logical 'AND'. */
export type Time_Comparison_Exp = {
  _eq?: InputMaybe<Scalars['time']['input']>;
  _gt?: InputMaybe<Scalars['time']['input']>;
  _gte?: InputMaybe<Scalars['time']['input']>;
  _in?: InputMaybe<Array<Scalars['time']['input']>>;
  _is_null?: InputMaybe<Scalars['Boolean']['input']>;
  _lt?: InputMaybe<Scalars['time']['input']>;
  _lte?: InputMaybe<Scalars['time']['input']>;
  _neq?: InputMaybe<Scalars['time']['input']>;
  _nin?: InputMaybe<Array<Scalars['time']['input']>>;
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
  /** Mirror of parent exercises.kind, kept in sync by the BEFORE INSERT/UPDATE sync_workout_exercise_kind trigger. Clients don't pass this; the trigger overwrites any client-supplied value. */
  kind: Scalars['String']['output'];
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
  /** Mirror of parent exercises.kind, kept in sync by the BEFORE INSERT/UPDATE sync_workout_exercise_kind trigger. Clients don't pass this; the trigger overwrites any client-supplied value. */
  kind?: InputMaybe<String_Comparison_Exp>;
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
  /** Mirror of parent exercises.kind, kept in sync by the BEFORE INSERT/UPDATE sync_workout_exercise_kind trigger. Clients don't pass this; the trigger overwrites any client-supplied value. */
  kind?: Maybe<Scalars['String']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  workoutId?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "workout_exercises" */
export type WorkoutExercises_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  exerciseId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  /** Mirror of parent exercises.kind, kept in sync by the BEFORE INSERT/UPDATE sync_workout_exercise_kind trigger. Clients don't pass this; the trigger overwrites any client-supplied value. */
  kind?: InputMaybe<Order_By>;
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
  /** Mirror of parent exercises.kind, kept in sync by the BEFORE INSERT/UPDATE sync_workout_exercise_kind trigger. Clients don't pass this; the trigger overwrites any client-supplied value. */
  kind?: Maybe<Scalars['String']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  workoutId?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "workout_exercises" */
export type WorkoutExercises_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  exerciseId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  /** Mirror of parent exercises.kind, kept in sync by the BEFORE INSERT/UPDATE sync_workout_exercise_kind trigger. Clients don't pass this; the trigger overwrites any client-supplied value. */
  kind?: InputMaybe<Order_By>;
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
  /** Mirror of parent exercises.kind, kept in sync by the BEFORE INSERT/UPDATE sync_workout_exercise_kind trigger. Clients don't pass this; the trigger overwrites any client-supplied value. */
  kind?: InputMaybe<Order_By>;
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
  /** Mirror of parent exercises.kind, kept in sync by the BEFORE INSERT/UPDATE sync_workout_exercise_kind trigger. Clients don't pass this; the trigger overwrites any client-supplied value. */
  Kind = 'kind',
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
  /** Mirror of parent exercises.kind, kept in sync by the BEFORE INSERT/UPDATE sync_workout_exercise_kind trigger. Clients don't pass this; the trigger overwrites any client-supplied value. */
  kind?: InputMaybe<Scalars['String']['input']>;
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

/** Per-entry metric blobs logged for a cardio session-exercise. parent_kind is pinned to 'cardio' (composite FK to workout_session_exercises(id, kind)), so this table can only attach to cardio session-exercises by construction — strength session-exercises cannot accept cardio entries, no trigger needed. The metrics jsonb shape is validated against the parent exercise's exercises_cardio.metrics_schema by validate_workout_session_cardio_entry() at write time only. */
export type WorkoutSessionCardioEntries = {
  __typename?: 'workoutSessionCardioEntries';
  createdAt: Scalars['timestamptz']['output'];
  entryNumber: Scalars['Int']['output'];
  id: Scalars['uuid']['output'];
  /** Per-entry metric values. Shape validated against the parent exercise's exercises_cardio.metrics_schema at INSERT/UPDATE time by validate_workout_session_cardio_entry(). Schema changes are NOT retroactive — historical entries stay as-is even if the owner later edits metrics_schema. */
  metrics: Scalars['jsonb']['output'];
  updatedAt: Scalars['timestamptz']['output'];
  /** An object relationship */
  workoutSessionExercise: WorkoutSessionExercises;
  workoutSessionExerciseId: Scalars['uuid']['output'];
};


/** Per-entry metric blobs logged for a cardio session-exercise. parent_kind is pinned to 'cardio' (composite FK to workout_session_exercises(id, kind)), so this table can only attach to cardio session-exercises by construction — strength session-exercises cannot accept cardio entries, no trigger needed. The metrics jsonb shape is validated against the parent exercise's exercises_cardio.metrics_schema by validate_workout_session_cardio_entry() at write time only. */
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
  /** Per-entry metric values. Shape validated against the parent exercise's exercises_cardio.metrics_schema at INSERT/UPDATE time by validate_workout_session_cardio_entry(). Schema changes are NOT retroactive — historical entries stay as-is even if the owner later edits metrics_schema. */
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
  /** Per-entry metric values. Shape validated against the parent exercise's exercises_cardio.metrics_schema at INSERT/UPDATE time by validate_workout_session_cardio_entry(). Schema changes are NOT retroactive — historical entries stay as-is even if the owner later edits metrics_schema. */
  metrics?: InputMaybe<Jsonb_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  workoutSessionExercise?: InputMaybe<WorkoutSessionExercises_Bool_Exp>;
  workoutSessionExerciseId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "workout_session_cardio_entries" */
export enum WorkoutSessionCardioEntries_Constraint {
  /** unique or primary key constraint on columns "id" */
  WorkoutSessionCardioEntriesPkey = 'workout_session_cardio_entries_pkey',
  /** unique or primary key constraint on columns "workout_session_exercise_id", "entry_number" */
  WorkoutSessionCardioEntriesWseIdEntryNumberKey = 'workout_session_cardio_entries_wse_id_entry_number_key'
}

/** delete the field or element with specified path (for JSON arrays, negative integers count from the end) */
export type WorkoutSessionCardioEntries_Delete_At_Path_Input = {
  /** Per-entry metric values. Shape validated against the parent exercise's exercises_cardio.metrics_schema at INSERT/UPDATE time by validate_workout_session_cardio_entry(). Schema changes are NOT retroactive — historical entries stay as-is even if the owner later edits metrics_schema. */
  metrics?: InputMaybe<Array<Scalars['String']['input']>>;
};

/** delete the array element with specified index (negative integers count from the end). throws an error if top level container is not an array */
export type WorkoutSessionCardioEntries_Delete_Elem_Input = {
  /** Per-entry metric values. Shape validated against the parent exercise's exercises_cardio.metrics_schema at INSERT/UPDATE time by validate_workout_session_cardio_entry(). Schema changes are NOT retroactive — historical entries stay as-is even if the owner later edits metrics_schema. */
  metrics?: InputMaybe<Scalars['Int']['input']>;
};

/** delete key/value pair or string element. key/value pairs are matched based on their key value */
export type WorkoutSessionCardioEntries_Delete_Key_Input = {
  /** Per-entry metric values. Shape validated against the parent exercise's exercises_cardio.metrics_schema at INSERT/UPDATE time by validate_workout_session_cardio_entry(). Schema changes are NOT retroactive — historical entries stay as-is even if the owner later edits metrics_schema. */
  metrics?: InputMaybe<Scalars['String']['input']>;
};

/** input type for incrementing numeric columns in table "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Inc_Input = {
  entryNumber?: InputMaybe<Scalars['Int']['input']>;
};

/** input type for inserting data into table "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Insert_Input = {
  entryNumber?: InputMaybe<Scalars['Int']['input']>;
  /** Per-entry metric values. Shape validated against the parent exercise's exercises_cardio.metrics_schema at INSERT/UPDATE time by validate_workout_session_cardio_entry(). Schema changes are NOT retroactive — historical entries stay as-is even if the owner later edits metrics_schema. */
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
  /** Per-entry metric values. Shape validated against the parent exercise's exercises_cardio.metrics_schema at INSERT/UPDATE time by validate_workout_session_cardio_entry(). Schema changes are NOT retroactive — historical entries stay as-is even if the owner later edits metrics_schema. */
  metrics?: Maybe<Scalars['jsonb']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  workoutSessionExerciseId?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  entryNumber?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  /** Per-entry metric values. Shape validated against the parent exercise's exercises_cardio.metrics_schema at INSERT/UPDATE time by validate_workout_session_cardio_entry(). Schema changes are NOT retroactive — historical entries stay as-is even if the owner later edits metrics_schema. */
  metrics?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  workoutSessionExerciseId?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type WorkoutSessionCardioEntries_Min_Fields = {
  __typename?: 'workoutSessionCardioEntries_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  entryNumber?: Maybe<Scalars['Int']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  /** Per-entry metric values. Shape validated against the parent exercise's exercises_cardio.metrics_schema at INSERT/UPDATE time by validate_workout_session_cardio_entry(). Schema changes are NOT retroactive — historical entries stay as-is even if the owner later edits metrics_schema. */
  metrics?: Maybe<Scalars['jsonb']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  workoutSessionExerciseId?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  entryNumber?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  /** Per-entry metric values. Shape validated against the parent exercise's exercises_cardio.metrics_schema at INSERT/UPDATE time by validate_workout_session_cardio_entry(). Schema changes are NOT retroactive — historical entries stay as-is even if the owner later edits metrics_schema. */
  metrics?: InputMaybe<Order_By>;
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
  /** Per-entry metric values. Shape validated against the parent exercise's exercises_cardio.metrics_schema at INSERT/UPDATE time by validate_workout_session_cardio_entry(). Schema changes are NOT retroactive — historical entries stay as-is even if the owner later edits metrics_schema. */
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
  /** Per-entry metric values. Shape validated against the parent exercise's exercises_cardio.metrics_schema at INSERT/UPDATE time by validate_workout_session_cardio_entry(). Schema changes are NOT retroactive — historical entries stay as-is even if the owner later edits metrics_schema. */
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
  /** Per-entry metric values. Shape validated against the parent exercise's exercises_cardio.metrics_schema at INSERT/UPDATE time by validate_workout_session_cardio_entry(). Schema changes are NOT retroactive — historical entries stay as-is even if the owner later edits metrics_schema. */
  Metrics = 'metrics',
  /** column name */
  UpdatedAt = 'updatedAt',
  /** column name */
  WorkoutSessionExerciseId = 'workoutSessionExerciseId'
}

/** input type for updating data in table "workout_session_cardio_entries" */
export type WorkoutSessionCardioEntries_Set_Input = {
  entryNumber?: InputMaybe<Scalars['Int']['input']>;
  /** Per-entry metric values. Shape validated against the parent exercise's exercises_cardio.metrics_schema at INSERT/UPDATE time by validate_workout_session_cardio_entry(). Schema changes are NOT retroactive — historical entries stay as-is even if the owner later edits metrics_schema. */
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
  /** Per-entry metric values. Shape validated against the parent exercise's exercises_cardio.metrics_schema at INSERT/UPDATE time by validate_workout_session_cardio_entry(). Schema changes are NOT retroactive — historical entries stay as-is even if the owner later edits metrics_schema. */
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
  /** Per-entry metric values. Shape validated against the parent exercise's exercises_cardio.metrics_schema at INSERT/UPDATE time by validate_workout_session_cardio_entry(). Schema changes are NOT retroactive — historical entries stay as-is even if the owner later edits metrics_schema. */
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
  /** Mirror of parent exercises.kind, kept in sync by the BEFORE INSERT/UPDATE sync_workout_exercise_kind trigger. Clients don't pass this. The (id, kind) pair is itself a UNIQUE anchor for the per-kind entry tables (workout_session_strength_sets, workout_session_cardio_entries). */
  kind: Scalars['String']['output'];
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
  workoutSessionStrengthSets: Array<WorkoutSessionStrengthSets>;
  /** An aggregate relationship */
  workoutSessionStrengthSets_aggregate: WorkoutSessionStrengthSets_Aggregate;
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
export type WorkoutSessionExercisesWorkoutSessionStrengthSetsArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionStrengthSets_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionStrengthSets_Order_By>>;
  where?: InputMaybe<WorkoutSessionStrengthSets_Bool_Exp>;
};


/** columns and relationships of "workout_session_exercises" */
export type WorkoutSessionExercisesWorkoutSessionStrengthSets_AggregateArgs = {
  distinct_on?: InputMaybe<Array<WorkoutSessionStrengthSets_Select_Column>>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  order_by?: InputMaybe<Array<WorkoutSessionStrengthSets_Order_By>>;
  where?: InputMaybe<WorkoutSessionStrengthSets_Bool_Exp>;
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
  /** Mirror of parent exercises.kind, kept in sync by the BEFORE INSERT/UPDATE sync_workout_exercise_kind trigger. Clients don't pass this. The (id, kind) pair is itself a UNIQUE anchor for the per-kind entry tables (workout_session_strength_sets, workout_session_cardio_entries). */
  kind?: InputMaybe<String_Comparison_Exp>;
  position?: InputMaybe<Int_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  workoutSession?: InputMaybe<WorkoutSessions_Bool_Exp>;
  workoutSessionCardioEntries?: InputMaybe<WorkoutSessionCardioEntries_Bool_Exp>;
  workoutSessionCardioEntries_aggregate?: InputMaybe<WorkoutSessionCardioEntries_Aggregate_Bool_Exp>;
  workoutSessionId?: InputMaybe<Uuid_Comparison_Exp>;
  workoutSessionStrengthSets?: InputMaybe<WorkoutSessionStrengthSets_Bool_Exp>;
  workoutSessionStrengthSets_aggregate?: InputMaybe<WorkoutSessionStrengthSets_Aggregate_Bool_Exp>;
};

/** unique or primary key constraints on table "workout_session_exercises" */
export enum WorkoutSessionExercises_Constraint {
  /** unique or primary key constraint on columns "id", "kind" */
  WorkoutSessionExercisesIdKindUq = 'workout_session_exercises_id_kind_uq',
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
  workoutSessionStrengthSets?: InputMaybe<WorkoutSessionStrengthSets_Arr_Rel_Insert_Input>;
};

/** aggregate max on columns */
export type WorkoutSessionExercises_Max_Fields = {
  __typename?: 'workoutSessionExercises_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  exerciseId?: Maybe<Scalars['uuid']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  /** Mirror of parent exercises.kind, kept in sync by the BEFORE INSERT/UPDATE sync_workout_exercise_kind trigger. Clients don't pass this. The (id, kind) pair is itself a UNIQUE anchor for the per-kind entry tables (workout_session_strength_sets, workout_session_cardio_entries). */
  kind?: Maybe<Scalars['String']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  workoutSessionId?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "workout_session_exercises" */
export type WorkoutSessionExercises_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  exerciseId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  /** Mirror of parent exercises.kind, kept in sync by the BEFORE INSERT/UPDATE sync_workout_exercise_kind trigger. Clients don't pass this. The (id, kind) pair is itself a UNIQUE anchor for the per-kind entry tables (workout_session_strength_sets, workout_session_cardio_entries). */
  kind?: InputMaybe<Order_By>;
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
  /** Mirror of parent exercises.kind, kept in sync by the BEFORE INSERT/UPDATE sync_workout_exercise_kind trigger. Clients don't pass this. The (id, kind) pair is itself a UNIQUE anchor for the per-kind entry tables (workout_session_strength_sets, workout_session_cardio_entries). */
  kind?: Maybe<Scalars['String']['output']>;
  position?: Maybe<Scalars['Int']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  workoutSessionId?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "workout_session_exercises" */
export type WorkoutSessionExercises_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  exerciseId?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  /** Mirror of parent exercises.kind, kept in sync by the BEFORE INSERT/UPDATE sync_workout_exercise_kind trigger. Clients don't pass this. The (id, kind) pair is itself a UNIQUE anchor for the per-kind entry tables (workout_session_strength_sets, workout_session_cardio_entries). */
  kind?: InputMaybe<Order_By>;
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
  /** Mirror of parent exercises.kind, kept in sync by the BEFORE INSERT/UPDATE sync_workout_exercise_kind trigger. Clients don't pass this. The (id, kind) pair is itself a UNIQUE anchor for the per-kind entry tables (workout_session_strength_sets, workout_session_cardio_entries). */
  kind?: InputMaybe<Order_By>;
  position?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  workoutSession?: InputMaybe<WorkoutSessions_Order_By>;
  workoutSessionCardioEntries_aggregate?: InputMaybe<WorkoutSessionCardioEntries_Aggregate_Order_By>;
  workoutSessionId?: InputMaybe<Order_By>;
  workoutSessionStrengthSets_aggregate?: InputMaybe<WorkoutSessionStrengthSets_Aggregate_Order_By>;
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
  /** Mirror of parent exercises.kind, kept in sync by the BEFORE INSERT/UPDATE sync_workout_exercise_kind trigger. Clients don't pass this. The (id, kind) pair is itself a UNIQUE anchor for the per-kind entry tables (workout_session_strength_sets, workout_session_cardio_entries). */
  Kind = 'kind',
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
  /** Mirror of parent exercises.kind, kept in sync by the BEFORE INSERT/UPDATE sync_workout_exercise_kind trigger. Clients don't pass this. The (id, kind) pair is itself a UNIQUE anchor for the per-kind entry tables (workout_session_strength_sets, workout_session_cardio_entries). */
  kind?: InputMaybe<Scalars['String']['input']>;
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

/** columns and relationships of "workout_session_strength_sets" */
export type WorkoutSessionStrengthSets = {
  __typename?: 'workoutSessionStrengthSets';
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

/** aggregated selection of "workout_session_strength_sets" */
export type WorkoutSessionStrengthSets_Aggregate = {
  __typename?: 'workoutSessionStrengthSets_aggregate';
  aggregate?: Maybe<WorkoutSessionStrengthSets_Aggregate_Fields>;
  nodes: Array<WorkoutSessionStrengthSets>;
};

export type WorkoutSessionStrengthSets_Aggregate_Bool_Exp = {
  count?: InputMaybe<WorkoutSessionStrengthSets_Aggregate_Bool_Exp_Count>;
};

export type WorkoutSessionStrengthSets_Aggregate_Bool_Exp_Count = {
  arguments?: InputMaybe<Array<WorkoutSessionStrengthSets_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
  filter?: InputMaybe<WorkoutSessionStrengthSets_Bool_Exp>;
  predicate: Int_Comparison_Exp;
};

/** aggregate fields of "workout_session_strength_sets" */
export type WorkoutSessionStrengthSets_Aggregate_Fields = {
  __typename?: 'workoutSessionStrengthSets_aggregate_fields';
  avg?: Maybe<WorkoutSessionStrengthSets_Avg_Fields>;
  count: Scalars['Int']['output'];
  max?: Maybe<WorkoutSessionStrengthSets_Max_Fields>;
  min?: Maybe<WorkoutSessionStrengthSets_Min_Fields>;
  stddev?: Maybe<WorkoutSessionStrengthSets_Stddev_Fields>;
  stddev_pop?: Maybe<WorkoutSessionStrengthSets_Stddev_Pop_Fields>;
  stddev_samp?: Maybe<WorkoutSessionStrengthSets_Stddev_Samp_Fields>;
  sum?: Maybe<WorkoutSessionStrengthSets_Sum_Fields>;
  var_pop?: Maybe<WorkoutSessionStrengthSets_Var_Pop_Fields>;
  var_samp?: Maybe<WorkoutSessionStrengthSets_Var_Samp_Fields>;
  variance?: Maybe<WorkoutSessionStrengthSets_Variance_Fields>;
};


/** aggregate fields of "workout_session_strength_sets" */
export type WorkoutSessionStrengthSets_Aggregate_FieldsCountArgs = {
  columns?: InputMaybe<Array<WorkoutSessionStrengthSets_Select_Column>>;
  distinct?: InputMaybe<Scalars['Boolean']['input']>;
};

/** order by aggregate values of table "workout_session_strength_sets" */
export type WorkoutSessionStrengthSets_Aggregate_Order_By = {
  avg?: InputMaybe<WorkoutSessionStrengthSets_Avg_Order_By>;
  count?: InputMaybe<Order_By>;
  max?: InputMaybe<WorkoutSessionStrengthSets_Max_Order_By>;
  min?: InputMaybe<WorkoutSessionStrengthSets_Min_Order_By>;
  stddev?: InputMaybe<WorkoutSessionStrengthSets_Stddev_Order_By>;
  stddev_pop?: InputMaybe<WorkoutSessionStrengthSets_Stddev_Pop_Order_By>;
  stddev_samp?: InputMaybe<WorkoutSessionStrengthSets_Stddev_Samp_Order_By>;
  sum?: InputMaybe<WorkoutSessionStrengthSets_Sum_Order_By>;
  var_pop?: InputMaybe<WorkoutSessionStrengthSets_Var_Pop_Order_By>;
  var_samp?: InputMaybe<WorkoutSessionStrengthSets_Var_Samp_Order_By>;
  variance?: InputMaybe<WorkoutSessionStrengthSets_Variance_Order_By>;
};

/** input type for inserting array relation for remote table "workout_session_strength_sets" */
export type WorkoutSessionStrengthSets_Arr_Rel_Insert_Input = {
  data: Array<WorkoutSessionStrengthSets_Insert_Input>;
  /** upsert condition */
  on_conflict?: InputMaybe<WorkoutSessionStrengthSets_On_Conflict>;
};

/** aggregate avg on columns */
export type WorkoutSessionStrengthSets_Avg_Fields = {
  __typename?: 'workoutSessionStrengthSets_avg_fields';
  reps?: Maybe<Scalars['Float']['output']>;
  setNumber?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by avg() on columns of table "workout_session_strength_sets" */
export type WorkoutSessionStrengthSets_Avg_Order_By = {
  reps?: InputMaybe<Order_By>;
  setNumber?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** Boolean expression to filter rows from the table "workout_session_strength_sets". All fields are combined with a logical 'AND'. */
export type WorkoutSessionStrengthSets_Bool_Exp = {
  _and?: InputMaybe<Array<WorkoutSessionStrengthSets_Bool_Exp>>;
  _not?: InputMaybe<WorkoutSessionStrengthSets_Bool_Exp>;
  _or?: InputMaybe<Array<WorkoutSessionStrengthSets_Bool_Exp>>;
  createdAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  id?: InputMaybe<Uuid_Comparison_Exp>;
  reps?: InputMaybe<Int_Comparison_Exp>;
  setNumber?: InputMaybe<Int_Comparison_Exp>;
  updatedAt?: InputMaybe<Timestamptz_Comparison_Exp>;
  weight?: InputMaybe<Numeric_Comparison_Exp>;
  workoutSessionExercise?: InputMaybe<WorkoutSessionExercises_Bool_Exp>;
  workoutSessionExerciseId?: InputMaybe<Uuid_Comparison_Exp>;
};

/** unique or primary key constraints on table "workout_session_strength_sets" */
export enum WorkoutSessionStrengthSets_Constraint {
  /** unique or primary key constraint on columns "id" */
  WorkoutSessionStrengthSetsPkey = 'workout_session_strength_sets_pkey',
  /** unique or primary key constraint on columns "workout_session_exercise_id", "set_number" */
  WorkoutSessionStrengthSetsWseIdSetNumberKey = 'workout_session_strength_sets_wse_id_set_number_key'
}

/** input type for incrementing numeric columns in table "workout_session_strength_sets" */
export type WorkoutSessionStrengthSets_Inc_Input = {
  reps?: InputMaybe<Scalars['Int']['input']>;
  setNumber?: InputMaybe<Scalars['Int']['input']>;
  weight?: InputMaybe<Scalars['numeric']['input']>;
};

/** input type for inserting data into table "workout_session_strength_sets" */
export type WorkoutSessionStrengthSets_Insert_Input = {
  reps?: InputMaybe<Scalars['Int']['input']>;
  setNumber?: InputMaybe<Scalars['Int']['input']>;
  weight?: InputMaybe<Scalars['numeric']['input']>;
  workoutSessionExercise?: InputMaybe<WorkoutSessionExercises_Obj_Rel_Insert_Input>;
  workoutSessionExerciseId?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate max on columns */
export type WorkoutSessionStrengthSets_Max_Fields = {
  __typename?: 'workoutSessionStrengthSets_max_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  reps?: Maybe<Scalars['Int']['output']>;
  setNumber?: Maybe<Scalars['Int']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  weight?: Maybe<Scalars['numeric']['output']>;
  workoutSessionExerciseId?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "workout_session_strength_sets" */
export type WorkoutSessionStrengthSets_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  reps?: InputMaybe<Order_By>;
  setNumber?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
  workoutSessionExerciseId?: InputMaybe<Order_By>;
};

/** aggregate min on columns */
export type WorkoutSessionStrengthSets_Min_Fields = {
  __typename?: 'workoutSessionStrengthSets_min_fields';
  createdAt?: Maybe<Scalars['timestamptz']['output']>;
  id?: Maybe<Scalars['uuid']['output']>;
  reps?: Maybe<Scalars['Int']['output']>;
  setNumber?: Maybe<Scalars['Int']['output']>;
  updatedAt?: Maybe<Scalars['timestamptz']['output']>;
  weight?: Maybe<Scalars['numeric']['output']>;
  workoutSessionExerciseId?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "workout_session_strength_sets" */
export type WorkoutSessionStrengthSets_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  reps?: InputMaybe<Order_By>;
  setNumber?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
  workoutSessionExerciseId?: InputMaybe<Order_By>;
};

/** response of any mutation on the table "workout_session_strength_sets" */
export type WorkoutSessionStrengthSets_Mutation_Response = {
  __typename?: 'workoutSessionStrengthSets_mutation_response';
  /** number of rows affected by the mutation */
  affected_rows: Scalars['Int']['output'];
  /** data from the rows affected by the mutation */
  returning: Array<WorkoutSessionStrengthSets>;
};

/** on_conflict condition type for table "workout_session_strength_sets" */
export type WorkoutSessionStrengthSets_On_Conflict = {
  constraint: WorkoutSessionStrengthSets_Constraint;
  update_columns?: Array<WorkoutSessionStrengthSets_Update_Column>;
  where?: InputMaybe<WorkoutSessionStrengthSets_Bool_Exp>;
};

/** Ordering options when selecting data from "workout_session_strength_sets". */
export type WorkoutSessionStrengthSets_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  reps?: InputMaybe<Order_By>;
  setNumber?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
  workoutSessionExercise?: InputMaybe<WorkoutSessionExercises_Order_By>;
  workoutSessionExerciseId?: InputMaybe<Order_By>;
};

/** primary key columns input for table: workout_session_strength_sets */
export type WorkoutSessionStrengthSets_Pk_Columns_Input = {
  id: Scalars['uuid']['input'];
};

/** select columns of table "workout_session_strength_sets" */
export enum WorkoutSessionStrengthSets_Select_Column {
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

/** input type for updating data in table "workout_session_strength_sets" */
export type WorkoutSessionStrengthSets_Set_Input = {
  reps?: InputMaybe<Scalars['Int']['input']>;
  setNumber?: InputMaybe<Scalars['Int']['input']>;
  weight?: InputMaybe<Scalars['numeric']['input']>;
};

/** aggregate stddev on columns */
export type WorkoutSessionStrengthSets_Stddev_Fields = {
  __typename?: 'workoutSessionStrengthSets_stddev_fields';
  reps?: Maybe<Scalars['Float']['output']>;
  setNumber?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev() on columns of table "workout_session_strength_sets" */
export type WorkoutSessionStrengthSets_Stddev_Order_By = {
  reps?: InputMaybe<Order_By>;
  setNumber?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** aggregate stddev_pop on columns */
export type WorkoutSessionStrengthSets_Stddev_Pop_Fields = {
  __typename?: 'workoutSessionStrengthSets_stddev_pop_fields';
  reps?: Maybe<Scalars['Float']['output']>;
  setNumber?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_pop() on columns of table "workout_session_strength_sets" */
export type WorkoutSessionStrengthSets_Stddev_Pop_Order_By = {
  reps?: InputMaybe<Order_By>;
  setNumber?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** aggregate stddev_samp on columns */
export type WorkoutSessionStrengthSets_Stddev_Samp_Fields = {
  __typename?: 'workoutSessionStrengthSets_stddev_samp_fields';
  reps?: Maybe<Scalars['Float']['output']>;
  setNumber?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by stddev_samp() on columns of table "workout_session_strength_sets" */
export type WorkoutSessionStrengthSets_Stddev_Samp_Order_By = {
  reps?: InputMaybe<Order_By>;
  setNumber?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** Streaming cursor of the table "workoutSessionStrengthSets" */
export type WorkoutSessionStrengthSets_Stream_Cursor_Input = {
  /** Stream column input with initial value */
  initial_value: WorkoutSessionStrengthSets_Stream_Cursor_Value_Input;
  /** cursor ordering */
  ordering?: InputMaybe<Cursor_Ordering>;
};

/** Initial value of the column from where the streaming should start */
export type WorkoutSessionStrengthSets_Stream_Cursor_Value_Input = {
  createdAt?: InputMaybe<Scalars['timestamptz']['input']>;
  id?: InputMaybe<Scalars['uuid']['input']>;
  reps?: InputMaybe<Scalars['Int']['input']>;
  setNumber?: InputMaybe<Scalars['Int']['input']>;
  updatedAt?: InputMaybe<Scalars['timestamptz']['input']>;
  weight?: InputMaybe<Scalars['numeric']['input']>;
  workoutSessionExerciseId?: InputMaybe<Scalars['uuid']['input']>;
};

/** aggregate sum on columns */
export type WorkoutSessionStrengthSets_Sum_Fields = {
  __typename?: 'workoutSessionStrengthSets_sum_fields';
  reps?: Maybe<Scalars['Int']['output']>;
  setNumber?: Maybe<Scalars['Int']['output']>;
  weight?: Maybe<Scalars['numeric']['output']>;
};

/** order by sum() on columns of table "workout_session_strength_sets" */
export type WorkoutSessionStrengthSets_Sum_Order_By = {
  reps?: InputMaybe<Order_By>;
  setNumber?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** update columns of table "workout_session_strength_sets" */
export enum WorkoutSessionStrengthSets_Update_Column {
  /** column name */
  Reps = 'reps',
  /** column name */
  SetNumber = 'setNumber',
  /** column name */
  Weight = 'weight'
}

export type WorkoutSessionStrengthSets_Updates = {
  /** increments the numeric columns with given value of the filtered values */
  _inc?: InputMaybe<WorkoutSessionStrengthSets_Inc_Input>;
  /** sets the columns of the filtered rows to the given values */
  _set?: InputMaybe<WorkoutSessionStrengthSets_Set_Input>;
  /** filter the rows which have to be updated */
  where: WorkoutSessionStrengthSets_Bool_Exp;
};

/** aggregate var_pop on columns */
export type WorkoutSessionStrengthSets_Var_Pop_Fields = {
  __typename?: 'workoutSessionStrengthSets_var_pop_fields';
  reps?: Maybe<Scalars['Float']['output']>;
  setNumber?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by var_pop() on columns of table "workout_session_strength_sets" */
export type WorkoutSessionStrengthSets_Var_Pop_Order_By = {
  reps?: InputMaybe<Order_By>;
  setNumber?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** aggregate var_samp on columns */
export type WorkoutSessionStrengthSets_Var_Samp_Fields = {
  __typename?: 'workoutSessionStrengthSets_var_samp_fields';
  reps?: Maybe<Scalars['Float']['output']>;
  setNumber?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by var_samp() on columns of table "workout_session_strength_sets" */
export type WorkoutSessionStrengthSets_Var_Samp_Order_By = {
  reps?: InputMaybe<Order_By>;
  setNumber?: InputMaybe<Order_By>;
  weight?: InputMaybe<Order_By>;
};

/** aggregate variance on columns */
export type WorkoutSessionStrengthSets_Variance_Fields = {
  __typename?: 'workoutSessionStrengthSets_variance_fields';
  reps?: Maybe<Scalars['Float']['output']>;
  setNumber?: Maybe<Scalars['Float']['output']>;
  weight?: Maybe<Scalars['Float']['output']>;
};

/** order by variance() on columns of table "workout_session_strength_sets" */
export type WorkoutSessionStrengthSets_Variance_Order_By = {
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
  /** NULL = ad-hoc session (no parent workout template, e.g. quick cardio logging). Non-NULL = session was started from a workout, but this is a template link, not a contract: the session's exercises don't have to match the workout's, and workout_id can be changed or cleared after creation. Workout deletion detaches sessions to ad-hoc (ON DELETE SET NULL, migration 1790000460000). */
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
  /** NULL = ad-hoc session (no parent workout template, e.g. quick cardio logging). Non-NULL = session was started from a workout, but this is a template link, not a contract: the session's exercises don't have to match the workout's, and workout_id can be changed or cleared after creation. Workout deletion detaches sessions to ad-hoc (ON DELETE SET NULL, migration 1790000460000). */
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
  /** NULL = ad-hoc session (no parent workout template, e.g. quick cardio logging). Non-NULL = session was started from a workout, but this is a template link, not a contract: the session's exercises don't have to match the workout's, and workout_id can be changed or cleared after creation. Workout deletion detaches sessions to ad-hoc (ON DELETE SET NULL, migration 1790000460000). */
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
  /** NULL = ad-hoc session (no parent workout template, e.g. quick cardio logging). Non-NULL = session was started from a workout, but this is a template link, not a contract: the session's exercises don't have to match the workout's, and workout_id can be changed or cleared after creation. Workout deletion detaches sessions to ad-hoc (ON DELETE SET NULL, migration 1790000460000). */
  workoutId?: Maybe<Scalars['uuid']['output']>;
};

/** order by max() on columns of table "workout_sessions" */
export type WorkoutSessions_Max_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  startedAt?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
  /** NULL = ad-hoc session (no parent workout template, e.g. quick cardio logging). Non-NULL = session was started from a workout, but this is a template link, not a contract: the session's exercises don't have to match the workout's, and workout_id can be changed or cleared after creation. Workout deletion detaches sessions to ad-hoc (ON DELETE SET NULL, migration 1790000460000). */
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
  /** NULL = ad-hoc session (no parent workout template, e.g. quick cardio logging). Non-NULL = session was started from a workout, but this is a template link, not a contract: the session's exercises don't have to match the workout's, and workout_id can be changed or cleared after creation. Workout deletion detaches sessions to ad-hoc (ON DELETE SET NULL, migration 1790000460000). */
  workoutId?: Maybe<Scalars['uuid']['output']>;
};

/** order by min() on columns of table "workout_sessions" */
export type WorkoutSessions_Min_Order_By = {
  createdAt?: InputMaybe<Order_By>;
  id?: InputMaybe<Order_By>;
  startedAt?: InputMaybe<Order_By>;
  updatedAt?: InputMaybe<Order_By>;
  userId?: InputMaybe<Order_By>;
  /** NULL = ad-hoc session (no parent workout template, e.g. quick cardio logging). Non-NULL = session was started from a workout, but this is a template link, not a contract: the session's exercises don't have to match the workout's, and workout_id can be changed or cleared after creation. Workout deletion detaches sessions to ad-hoc (ON DELETE SET NULL, migration 1790000460000). */
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
  /** NULL = ad-hoc session (no parent workout template, e.g. quick cardio logging). Non-NULL = session was started from a workout, but this is a template link, not a contract: the session's exercises don't have to match the workout's, and workout_id can be changed or cleared after creation. Workout deletion detaches sessions to ad-hoc (ON DELETE SET NULL, migration 1790000460000). */
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
  /** NULL = ad-hoc session (no parent workout template, e.g. quick cardio logging). Non-NULL = session was started from a workout, but this is a template link, not a contract: the session's exercises don't have to match the workout's, and workout_id can be changed or cleared after creation. Workout deletion detaches sessions to ad-hoc (ON DELETE SET NULL, migration 1790000460000). */
  WorkoutId = 'workoutId'
}

/** input type for updating data in table "workout_sessions" */
export type WorkoutSessions_Set_Input = {
  startedAt?: InputMaybe<Scalars['timestamptz']['input']>;
  /** NULL = ad-hoc session (no parent workout template, e.g. quick cardio logging). Non-NULL = session was started from a workout, but this is a template link, not a contract: the session's exercises don't have to match the workout's, and workout_id can be changed or cleared after creation. Workout deletion detaches sessions to ad-hoc (ON DELETE SET NULL, migration 1790000460000). */
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
  /** NULL = ad-hoc session (no parent workout template, e.g. quick cardio logging). Non-NULL = session was started from a workout, but this is a template link, not a contract: the session's exercises don't have to match the workout's, and workout_id can be changed or cleared after creation. Workout deletion detaches sessions to ad-hoc (ON DELETE SET NULL, migration 1790000460000). */
  workoutId?: InputMaybe<Scalars['uuid']['input']>;
};

/** update columns of table "workout_sessions" */
export enum WorkoutSessions_Update_Column {
  /** column name */
  StartedAt = 'startedAt',
  /** NULL = ad-hoc session (no parent workout template, e.g. quick cardio logging). Non-NULL = session was started from a workout, but this is a template link, not a contract: the session's exercises don't have to match the workout's, and workout_id can be changed or cleared after creation. Workout deletion detaches sessions to ad-hoc (ON DELETE SET NULL, migration 1790000460000). */
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
  isPublic?: Maybe<Scalars['Boolean']['output']>;
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
  isPublic?: Maybe<Scalars['Boolean']['output']>;
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

export type BreadcrumbFoodQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type BreadcrumbFoodQuery = { __typename?: 'query_root', food?: { __typename?: 'foods', id: any, name: string } | null };

export type BreadcrumbMealQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type BreadcrumbMealQuery = { __typename?: 'query_root', meal?: { __typename?: 'meals', id: any, name: string } | null };

export type BreadcrumbNutritionPlanQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type BreadcrumbNutritionPlanQuery = { __typename?: 'query_root', nutritionPlan?: { __typename?: 'nutritionPlans', id: any, name: string } | null };

export type DailyIntakeLogQueryVariables = Exact<{
  date: Scalars['date']['input'];
}>;


export type DailyIntakeLogQuery = { __typename?: 'query_root', nutritionDays: Array<{ __typename?: 'nutritionDays', id: any, logDate: any, nutritionPlanId?: any | null, nutritionLogMeals: Array<{ __typename?: 'nutritionLogMeals', id: any, mealId?: any | null, nutritionPlanMealId?: any | null, name: string, slotTime?: any | null, position: number, nutritionLogEntries: Array<{ __typename?: 'nutritionLogEntries', id: any, source: string, nutritionLogMealId?: any | null, foodId?: any | null, grams: any, position: number, slotTime?: any | null, snapshotFoodName: string, snapshotKcalPer100g: any, snapshotFatPer100g: any, snapshotCarbsPer100g: any, snapshotProteinPer100g: any, snapshotFiberPer100g: any, snapshotSugarPer100g: any }> }>, nutritionLogEntries: Array<{ __typename?: 'nutritionLogEntries', id: any, source: string, nutritionLogMealId?: any | null, foodId?: any | null, grams: any, position: number, slotTime?: any | null, snapshotFoodName: string, snapshotKcalPer100g: any, snapshotFatPer100g: any, snapshotCarbsPer100g: any, snapshotProteinPer100g: any, snapshotFiberPer100g: any, snapshotSugarPer100g: any }> }>, nutritionPlans: Array<{ __typename?: 'nutritionPlans', id: any, name: string, description?: string | null, nutritionPlanMeals: Array<{ __typename?: 'nutritionPlanMeals', id: any, slotTime: any, label?: string | null, position: number, meal: { __typename?: 'meals', id: any, name: string, description?: string | null, mealIngredients: Array<{ __typename?: 'mealIngredients', id: any, grams: any, position: number, food: { __typename?: 'foods', id: any, name: string, kcalPer100g: any, fatPer100g: any, carbsPer100g: any, proteinPer100g: any, fiberPer100g: any, sugarPer100g: any } }> } }>, nutritionPlanFoods: Array<{ __typename?: 'nutritionPlanFoods', id: any, slotTime: any, label?: string | null, position: number, grams: any, food: { __typename?: 'foods', id: any, name: string, userId?: any | null, isPublic: boolean, kcalPer100g: any, fatPer100g: any, carbsPer100g: any, proteinPer100g: any, fiberPer100g: any, sugarPer100g: any } }> }>, meals: Array<{ __typename?: 'meals', id: any, name: string, description?: string | null, mealIngredients: Array<{ __typename?: 'mealIngredients', id: any, grams: any, position: number, food: { __typename?: 'foods', id: any, name: string, kcalPer100g: any, fatPer100g: any, carbsPer100g: any, proteinPer100g: any, fiberPer100g: any, sugarPer100g: any } }> }>, foods: Array<{ __typename?: 'foods', id: any, name: string, userId?: any | null, isPublic: boolean, kcalPer100g: any, fatPer100g: any, carbsPer100g: any, proteinPer100g: any, fiberPer100g: any, sugarPer100g: any }> };

export type CreateNutritionDayMutationVariables = Exact<{
  object: NutritionDays_Insert_Input;
}>;


export type CreateNutritionDayMutation = { __typename?: 'mutation_root', insertNutritionDay?: { __typename?: 'nutritionDays', id: any } | null };

export type UpdateNutritionDayPlanMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
  nutritionPlanId?: InputMaybe<Scalars['uuid']['input']>;
}>;


export type UpdateNutritionDayPlanMutation = { __typename?: 'mutation_root', updateNutritionDay?: { __typename?: 'nutritionDays', id: any, nutritionPlanId?: any | null } | null };

export type UpdateNutritionLogEntryMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
  set: NutritionLogEntries_Set_Input;
}>;


export type UpdateNutritionLogEntryMutation = { __typename?: 'mutation_root', updateNutritionLogEntry?: { __typename?: 'nutritionLogEntries', id: any } | null };

export type DeleteNutritionLogEntryMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type DeleteNutritionLogEntryMutation = { __typename?: 'mutation_root', deleteNutritionLogEntry?: { __typename?: 'nutritionLogEntries', id: any } | null };

export type DeleteNutritionLogMealMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type DeleteNutritionLogMealMutation = { __typename?: 'mutation_root', deleteNutritionLogMeal?: { __typename?: 'nutritionLogMeals', id: any } | null };

export type DeleteNutritionDayMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type DeleteNutritionDayMutation = { __typename?: 'mutation_root', deleteNutritionDay?: { __typename?: 'nutritionDays', id: any } | null };

export type ExerciseDetailQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type ExerciseDetailQuery = { __typename?: 'query_root', exercise?: { __typename?: 'exercises', id: any, name: string, instructions: Array<string>, image1FileId?: any | null, image2FileId?: any | null, level?: ExerciseLevels_Enum | null, category: ExerciseCategories_Enum, kind?: string | null, equipment?: ExerciseEquipments_Enum | null, primaryMuscleGroup: MuscleGroups_Enum, strength?: { __typename?: 'exercisesStrength', doubleWeight: boolean, force?: ExerciseForces_Enum | null, mechanic?: ExerciseMechanics_Enum | null } | null, cardio?: { __typename?: 'exercisesCardio', metricsSchema: any } | null, secondaryMuscleGroups: Array<{ __typename?: 'exerciseSecondaryMuscleGroups', muscleGroup: MuscleGroups_Enum }>, workoutSessionExercises: Array<{ __typename?: 'workoutSessionExercises', id: any, workoutSession: { __typename?: 'workoutSessions', id: any, startedAt: any, workout?: { __typename?: 'workouts', id: any, name: string } | null }, workoutSessionStrengthSets: Array<{ __typename?: 'workoutSessionStrengthSets', id: any, setNumber: number, reps: number, weight: any }>, workoutSessionCardioEntries: Array<{ __typename?: 'workoutSessionCardioEntries', id: any, entryNumber: number, metrics: any }> }> } | null };

export type ExercisePickerExercisesQueryVariables = Exact<{ [key: string]: never; }>;


export type ExercisePickerExercisesQuery = { __typename?: 'query_root', exercises: Array<{ __typename?: 'exercises', id: any, name: string, primaryMuscleGroup: MuscleGroups_Enum, strength?: { __typename?: 'exercisesStrength', doubleWeight: boolean } | null }> };

export type LogFoodMutationVariables = Exact<{
  object: NutritionLogEntries_Insert_Input;
}>;


export type LogFoodMutation = { __typename?: 'mutation_root', insertNutritionLogEntry?: { __typename?: 'nutritionLogEntries', id: any } | null };

export type LogMealMutationVariables = Exact<{
  object: NutritionLogMeals_Insert_Input;
}>;


export type LogMealMutation = { __typename?: 'mutation_root', insertNutritionLogMeal?: { __typename?: 'nutritionLogMeals', id: any } | null };

export type MealFormFoodsQueryVariables = Exact<{ [key: string]: never; }>;


export type MealFormFoodsQuery = { __typename?: 'query_root', foods: Array<{ __typename?: 'foods', id: any, name: string, userId?: any | null, isPublic: boolean, kcalPer100g: any, fatPer100g: any, carbsPer100g: any, proteinPer100g: any, fiberPer100g: any, sugarPer100g: any }> };

export type NutritionPlanFormPickersQueryVariables = Exact<{ [key: string]: never; }>;


export type NutritionPlanFormPickersQuery = { __typename?: 'query_root', meals: Array<{ __typename?: 'meals', id: any, name: string, description?: string | null, mealIngredients: Array<{ __typename?: 'mealIngredients', id: any, grams: any, position: number, food: { __typename?: 'foods', id: any, name: string, kcalPer100g: any, fatPer100g: any, carbsPer100g: any, proteinPer100g: any, fiberPer100g: any, sugarPer100g: any } }> }>, foods: Array<{ __typename?: 'foods', id: any, name: string, userId?: any | null, isPublic: boolean, kcalPer100g: any, fatPer100g: any, carbsPer100g: any, proteinPer100g: any, fiberPer100g: any, sugarPer100g: any }> };

export type InlineCreateFoodMutationVariables = Exact<{
  object: Foods_Insert_Input;
}>;


export type InlineCreateFoodMutation = { __typename?: 'mutation_root', insertFood?: { __typename?: 'foods', id: any, name: string, userId?: any | null, isPublic: boolean, kcalPer100g: any, fatPer100g: any, carbsPer100g: any, proteinPer100g: any, fiberPer100g: any, sugarPer100g: any } | null };

export type InlineSaveFoodMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
  set: Foods_Set_Input;
}>;


export type InlineSaveFoodMutation = { __typename?: 'mutation_root', updateFood?: { __typename?: 'foods', id: any, name: string, userId?: any | null, isPublic: boolean, kcalPer100g: any, fatPer100g: any, carbsPer100g: any, proteinPer100g: any, fiberPer100g: any, sugarPer100g: any } | null };

export type InlineCreateMealMutationVariables = Exact<{
  object: Meals_Insert_Input;
}>;


export type InlineCreateMealMutation = { __typename?: 'mutation_root', insertMeal?: { __typename?: 'meals', id: any, name: string, description?: string | null, mealIngredients: Array<{ __typename?: 'mealIngredients', id: any, grams: any, position: number, food: { __typename?: 'foods', id: any, name: string, kcalPer100g: any, fatPer100g: any, carbsPer100g: any, proteinPer100g: any, fiberPer100g: any, sugarPer100g: any } }> } | null };

export type InlineSaveMealMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
  set: Meals_Set_Input;
  deleteIngredientIds: Array<Scalars['uuid']['input']> | Scalars['uuid']['input'];
  hasDeleteIngredients: Scalars['Boolean']['input'];
  insertIngredients: Array<MealIngredients_Insert_Input> | MealIngredients_Insert_Input;
  hasInsertIngredients: Scalars['Boolean']['input'];
  ingredientUpdates: Array<MealIngredients_Updates> | MealIngredients_Updates;
  hasIngredientUpdates: Scalars['Boolean']['input'];
}>;


export type InlineSaveMealMutation = { __typename?: 'mutation_root', deleteMealIngredients?: { __typename?: 'mealIngredients_mutation_response', affected_rows: number } | null, insertMealIngredients?: { __typename?: 'mealIngredients_mutation_response', affected_rows: number } | null, update_mealIngredients_many?: Array<{ __typename?: 'mealIngredients_mutation_response', affected_rows: number } | null> | null, updateMeal?: { __typename?: 'meals', id: any, name: string, description?: string | null, mealIngredients: Array<{ __typename?: 'mealIngredients', id: any, grams: any, position: number, food: { __typename?: 'foods', id: any, name: string, kcalPer100g: any, fatPer100g: any, carbsPer100g: any, proteinPer100g: any, fiberPer100g: any, sugarPer100g: any } }> } | null };

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


export type ExercisesIndexQuery = { __typename?: 'query_root', exercises: Array<{ __typename?: 'exercises', id: any, name: string, primaryMuscleGroup: MuscleGroups_Enum, category: ExerciseCategories_Enum, equipment?: ExerciseEquipments_Enum | null, level?: ExerciseLevels_Enum | null, isPublic: boolean, strength?: { __typename?: 'exercisesStrength', doubleWeight: boolean } | null, secondaryMuscleGroups: Array<{ __typename?: 'exerciseSecondaryMuscleGroups', muscleGroup: MuscleGroups_Enum }> }> };

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
  hasDeleteLabels: Scalars['Boolean']['input'];
  insertLabels: Array<JournalEntryLabels_Insert_Input> | JournalEntryLabels_Insert_Input;
  hasInsertLabels: Scalars['Boolean']['input'];
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

export type NutritionDaysIndexQueryVariables = Exact<{ [key: string]: never; }>;


export type NutritionDaysIndexQuery = { __typename?: 'query_root', nutritionDays: Array<{ __typename?: 'nutritionDays', id: any, logDate: any, nutritionPlan?: { __typename?: 'nutritionPlans', id: any, name: string } | null, nutritionLogMeals: Array<{ __typename?: 'nutritionLogMeals', id: any, nutritionLogEntries: Array<{ __typename?: 'nutritionLogEntries', id: any, grams: any, snapshotKcalPer100g: any, snapshotFatPer100g: any, snapshotCarbsPer100g: any, snapshotProteinPer100g: any, snapshotFiberPer100g: any, snapshotSugarPer100g: any }> }>, nutritionLogEntries: Array<{ __typename?: 'nutritionLogEntries', id: any, grams: any, snapshotKcalPer100g: any, snapshotFatPer100g: any, snapshotCarbsPer100g: any, snapshotProteinPer100g: any, snapshotFiberPer100g: any, snapshotSugarPer100g: any }> }> };

export type FoodDetailQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type FoodDetailQuery = { __typename?: 'query_root', food?: { __typename?: 'foods', id: any, name: string, userId?: any | null, isPublic: boolean, kcalPer100g: any, fatPer100g: any, carbsPer100g: any, proteinPer100g: any, fiberPer100g: any, sugarPer100g: any, createdAt: any, updatedAt: any } | null };

export type EditFoodQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type EditFoodQuery = { __typename?: 'query_root', food?: { __typename?: 'foods', id: any, name: string, userId?: any | null, isPublic: boolean, kcalPer100g: any, fatPer100g: any, carbsPer100g: any, proteinPer100g: any, fiberPer100g: any, sugarPer100g: any } | null };

export type SaveFoodMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
  set: Foods_Set_Input;
}>;


export type SaveFoodMutation = { __typename?: 'mutation_root', updateFood?: { __typename?: 'foods', id: any } | null };

export type DeleteFoodMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type DeleteFoodMutation = { __typename?: 'mutation_root', deleteFood?: { __typename?: 'foods', id: any } | null };

export type FoodsIndexQueryVariables = Exact<{ [key: string]: never; }>;


export type FoodsIndexQuery = { __typename?: 'query_root', foods: Array<{ __typename?: 'foods', id: any, name: string, userId?: any | null, isPublic: boolean, kcalPer100g: any, fatPer100g: any, carbsPer100g: any, proteinPer100g: any, fiberPer100g: any, sugarPer100g: any }> };

export type CreateFoodMutationVariables = Exact<{
  object: Foods_Insert_Input;
}>;


export type CreateFoodMutation = { __typename?: 'mutation_root', insertFood?: { __typename?: 'foods', id: any } | null };

export type MealDetailQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type MealDetailQuery = { __typename?: 'query_root', meal?: { __typename?: 'meals', id: any, name: string, description?: string | null, createdAt: any, updatedAt: any, mealIngredients: Array<{ __typename?: 'mealIngredients', id: any, grams: any, position: number, food: { __typename?: 'foods', id: any, name: string, isPublic: boolean, kcalPer100g: any, fatPer100g: any, carbsPer100g: any, proteinPer100g: any, fiberPer100g: any, sugarPer100g: any } }> } | null };

export type EditMealQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type EditMealQuery = { __typename?: 'query_root', meal?: { __typename?: 'meals', id: any, name: string, description?: string | null, mealIngredients: Array<{ __typename?: 'mealIngredients', id: any, foodId: any, grams: any, position: number }> } | null };

export type SaveMealMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
  set: Meals_Set_Input;
  deleteIngredientIds: Array<Scalars['uuid']['input']> | Scalars['uuid']['input'];
  hasDeleteIngredients: Scalars['Boolean']['input'];
  insertIngredients: Array<MealIngredients_Insert_Input> | MealIngredients_Insert_Input;
  hasInsertIngredients: Scalars['Boolean']['input'];
  ingredientUpdates: Array<MealIngredients_Updates> | MealIngredients_Updates;
  hasIngredientUpdates: Scalars['Boolean']['input'];
}>;


export type SaveMealMutation = { __typename?: 'mutation_root', updateMeal?: { __typename?: 'meals', id: any } | null, deleteMealIngredients?: { __typename?: 'mealIngredients_mutation_response', affected_rows: number } | null, insertMealIngredients?: { __typename?: 'mealIngredients_mutation_response', affected_rows: number } | null, update_mealIngredients_many?: Array<{ __typename?: 'mealIngredients_mutation_response', affected_rows: number } | null> | null };

export type DeleteMealMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type DeleteMealMutation = { __typename?: 'mutation_root', deleteMeal?: { __typename?: 'meals', id: any } | null };

export type MealsIndexQueryVariables = Exact<{ [key: string]: never; }>;


export type MealsIndexQuery = { __typename?: 'query_root', meals: Array<{ __typename?: 'meals', id: any, name: string, description?: string | null, updatedAt: any, mealIngredients: Array<{ __typename?: 'mealIngredients', id: any, grams: any, position: number, food: { __typename?: 'foods', id: any, name: string, kcalPer100g: any, fatPer100g: any, carbsPer100g: any, proteinPer100g: any, fiberPer100g: any, sugarPer100g: any } }> }> };

export type CreateMealMutationVariables = Exact<{
  object: Meals_Insert_Input;
}>;


export type CreateMealMutation = { __typename?: 'mutation_root', insertMeal?: { __typename?: 'meals', id: any } | null };

export type NutritionPlanDetailQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type NutritionPlanDetailQuery = { __typename?: 'query_root', nutritionPlan?: { __typename?: 'nutritionPlans', id: any, name: string, description?: string | null, createdAt: any, updatedAt: any, nutritionPlanMeals: Array<{ __typename?: 'nutritionPlanMeals', id: any, mealId: any, slotTime: any, label?: string | null, position: number, meal: { __typename?: 'meals', id: any, name: string, description?: string | null, mealIngredients: Array<{ __typename?: 'mealIngredients', id: any, grams: any, position: number, food: { __typename?: 'foods', id: any, name: string, kcalPer100g: any, fatPer100g: any, carbsPer100g: any, proteinPer100g: any, fiberPer100g: any, sugarPer100g: any } }> } }>, nutritionPlanFoods: Array<{ __typename?: 'nutritionPlanFoods', id: any, foodId: any, grams: any, slotTime: any, label?: string | null, position: number, food: { __typename?: 'foods', id: any, name: string, kcalPer100g: any, fatPer100g: any, carbsPer100g: any, proteinPer100g: any, fiberPer100g: any, sugarPer100g: any } }> } | null };

export type EditNutritionPlanQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type EditNutritionPlanQuery = { __typename?: 'query_root', nutritionPlan?: { __typename?: 'nutritionPlans', id: any, name: string, description?: string | null, nutritionPlanMeals: Array<{ __typename?: 'nutritionPlanMeals', id: any, mealId: any, slotTime: any, label?: string | null, position: number }>, nutritionPlanFoods: Array<{ __typename?: 'nutritionPlanFoods', id: any, foodId: any, grams: any, slotTime: any, label?: string | null, position: number }> } | null };

export type SaveNutritionPlanMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
  set: NutritionPlans_Set_Input;
  deleteMealIds: Array<Scalars['uuid']['input']> | Scalars['uuid']['input'];
  hasDeleteMeals: Scalars['Boolean']['input'];
  deleteFoodIds: Array<Scalars['uuid']['input']> | Scalars['uuid']['input'];
  hasDeleteFoods: Scalars['Boolean']['input'];
  insertMeals: Array<NutritionPlanMeals_Insert_Input> | NutritionPlanMeals_Insert_Input;
  hasInsertMeals: Scalars['Boolean']['input'];
  insertFoods: Array<NutritionPlanFoods_Insert_Input> | NutritionPlanFoods_Insert_Input;
  hasInsertFoods: Scalars['Boolean']['input'];
  mealUpdates: Array<NutritionPlanMeals_Updates> | NutritionPlanMeals_Updates;
  hasMealUpdates: Scalars['Boolean']['input'];
  foodUpdates: Array<NutritionPlanFoods_Updates> | NutritionPlanFoods_Updates;
  hasFoodUpdates: Scalars['Boolean']['input'];
}>;


export type SaveNutritionPlanMutation = { __typename?: 'mutation_root', updateNutritionPlan?: { __typename?: 'nutritionPlans', id: any } | null, deleteNutritionPlanMeals?: { __typename?: 'nutritionPlanMeals_mutation_response', affected_rows: number } | null, deleteNutritionPlanFoods?: { __typename?: 'nutritionPlanFoods_mutation_response', affected_rows: number } | null, insertNutritionPlanMeals?: { __typename?: 'nutritionPlanMeals_mutation_response', affected_rows: number } | null, insertNutritionPlanFoods?: { __typename?: 'nutritionPlanFoods_mutation_response', affected_rows: number } | null, update_nutritionPlanMeals_many?: Array<{ __typename?: 'nutritionPlanMeals_mutation_response', affected_rows: number } | null> | null, update_nutritionPlanFoods_many?: Array<{ __typename?: 'nutritionPlanFoods_mutation_response', affected_rows: number } | null> | null };

export type DeleteNutritionPlanMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type DeleteNutritionPlanMutation = { __typename?: 'mutation_root', deleteNutritionPlan?: { __typename?: 'nutritionPlans', id: any } | null };

export type PlansIndexQueryVariables = Exact<{ [key: string]: never; }>;


export type PlansIndexQuery = { __typename?: 'query_root', nutritionPlans: Array<{ __typename?: 'nutritionPlans', id: any, name: string, description?: string | null, nutritionPlanMeals: Array<{ __typename?: 'nutritionPlanMeals', id: any, slotTime: any, label?: string | null, position: number, meal: { __typename?: 'meals', id: any, name: string, description?: string | null, mealIngredients: Array<{ __typename?: 'mealIngredients', id: any, grams: any, position: number, food: { __typename?: 'foods', id: any, name: string, kcalPer100g: any, fatPer100g: any, carbsPer100g: any, proteinPer100g: any, fiberPer100g: any, sugarPer100g: any } }> } }>, nutritionPlanFoods: Array<{ __typename?: 'nutritionPlanFoods', id: any, slotTime: any, label?: string | null, position: number, grams: any, food: { __typename?: 'foods', id: any, name: string, kcalPer100g: any, fatPer100g: any, carbsPer100g: any, proteinPer100g: any, fiberPer100g: any, sugarPer100g: any } }> }> };

export type CreateNutritionPlanMutationVariables = Exact<{
  object: NutritionPlans_Insert_Input;
}>;


export type CreateNutritionPlanMutation = { __typename?: 'mutation_root', insertNutritionPlan?: { __typename?: 'nutritionPlans', id: any } | null };

export type SessionDetailQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type SessionDetailQuery = { __typename?: 'query_root', workoutSession?: { __typename?: 'workoutSessions', id: any, startedAt: any, workout?: { __typename?: 'workouts', id: any, name: string } | null, workoutSessionExercises: Array<{ __typename?: 'workoutSessionExercises', id: any, position: number, exercise: { __typename?: 'exercises', id: any, name: string, kind?: string | null, primaryMuscleGroup: MuscleGroups_Enum, image1FileId?: any | null, image2FileId?: any | null, strength?: { __typename?: 'exercisesStrength', doubleWeight: boolean } | null, cardio?: { __typename?: 'exercisesCardio', metricsSchema: any } | null }, workoutSessionStrengthSets: Array<{ __typename?: 'workoutSessionStrengthSets', id: any, setNumber: number, reps: number, weight: any }>, workoutSessionCardioEntries: Array<{ __typename?: 'workoutSessionCardioEntries', id: any, entryNumber: number, metrics: any }> }> } | null };

export type PriorSessionsPerExerciseQueryVariables = Exact<{
  exerciseIds: Array<Scalars['uuid']['input']> | Scalars['uuid']['input'];
  excludeSessionId: Scalars['uuid']['input'];
}>;


export type PriorSessionsPerExerciseQuery = { __typename?: 'query_root', exercises: Array<{ __typename?: 'exercises', id: any, workoutSessionExercises: Array<{ __typename?: 'workoutSessionExercises', id: any, workoutSession: { __typename?: 'workoutSessions', id: any, startedAt: any }, workoutSessionStrengthSets: Array<{ __typename?: 'workoutSessionStrengthSets', id: any, setNumber: number, reps: number, weight: any }>, workoutSessionCardioEntries: Array<{ __typename?: 'workoutSessionCardioEntries', id: any, entryNumber: number, metrics: any }> }> }> };

export type InsertWorkoutSessionStrengthSetMutationVariables = Exact<{
  obj: WorkoutSessionStrengthSets_Insert_Input;
}>;


export type InsertWorkoutSessionStrengthSetMutation = { __typename?: 'mutation_root', insertWorkoutSessionStrengthSet?: { __typename?: 'workoutSessionStrengthSets', id: any } | null };

export type UpdateWorkoutSessionStrengthSetMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
  set: WorkoutSessionStrengthSets_Set_Input;
}>;


export type UpdateWorkoutSessionStrengthSetMutation = { __typename?: 'mutation_root', updateWorkoutSessionStrengthSet?: { __typename?: 'workoutSessionStrengthSets', id: any } | null };

export type DeleteWorkoutSessionStrengthSetMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type DeleteWorkoutSessionStrengthSetMutation = { __typename?: 'mutation_root', deleteWorkoutSessionStrengthSet?: { __typename?: 'workoutSessionStrengthSets', id: any } | null };

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


export type SessionsIndexQuery = { __typename?: 'query_root', workoutSessions: Array<{ __typename?: 'workoutSessions', id: any, startedAt: any, workout?: { __typename?: 'workouts', id: any, name: string } | null, workoutSessionExercises_aggregate: { __typename?: 'workoutSessionExercises_aggregate', aggregate?: { __typename?: 'workoutSessionExercises_aggregate_fields', count: number } | null }, workoutSessionExercises: Array<{ __typename?: 'workoutSessionExercises', exercise: { __typename?: 'exercises', id: any, name: string }, workoutSessionStrengthSets_aggregate: { __typename?: 'workoutSessionStrengthSets_aggregate', aggregate?: { __typename?: 'workoutSessionStrengthSets_aggregate_fields', count: number, sum?: { __typename?: 'workoutSessionStrengthSets_sum_fields', reps?: number | null } | null } | null }, workoutSessionCardioEntries_aggregate: { __typename?: 'workoutSessionCardioEntries_aggregate', aggregate?: { __typename?: 'workoutSessionCardioEntries_aggregate_fields', count: number } | null } }> }> };

export type WorkoutDetailQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type WorkoutDetailQuery = { __typename?: 'query_root', workout?: { __typename?: 'workouts', id: any, name: string, description?: string | null, isPublic: boolean, userId?: any | null, workoutExercises: Array<{ __typename?: 'workoutExercises', id: any, position: number, exercise: { __typename?: 'exercises', id: any, name: string, primaryMuscleGroup: MuscleGroups_Enum, image1FileId?: any | null, image2FileId?: any | null, strength?: { __typename?: 'exercisesStrength', doubleWeight: boolean } | null } }>, workoutLabels: Array<{ __typename?: 'workoutLabels', labelId: any, label: { __typename?: 'labels', id: any, name: string } }> } | null };

export type EditWorkoutQueryVariables = Exact<{
  id: Scalars['uuid']['input'];
}>;


export type EditWorkoutQuery = { __typename?: 'query_root', workout?: { __typename?: 'workouts', id: any, name: string, description?: string | null, isPublic: boolean, userId?: any | null, workoutExercises: Array<{ __typename?: 'workoutExercises', id: any, position: number, exercise: { __typename?: 'exercises', id: any, name: string, primaryMuscleGroup: MuscleGroups_Enum, strength?: { __typename?: 'exercisesStrength', doubleWeight: boolean } | null } }>, workoutLabels: Array<{ __typename?: 'workoutLabels', labelId: any, label: { __typename?: 'labels', id: any, name: string } }> } | null, labels: Array<{ __typename?: 'labels', id: any, name: string }> };

export type SaveWorkoutMutationVariables = Exact<{
  id: Scalars['uuid']['input'];
  set: Workouts_Set_Input;
  deleteRowIds: Array<Scalars['uuid']['input']> | Scalars['uuid']['input'];
  hasDeleteRows: Scalars['Boolean']['input'];
  insertRows: Array<WorkoutExercises_Insert_Input> | WorkoutExercises_Insert_Input;
  hasInsertRows: Scalars['Boolean']['input'];
  positionUpdates: Array<WorkoutExercises_Updates> | WorkoutExercises_Updates;
  hasPositionUpdates: Scalars['Boolean']['input'];
  deleteLabelIds: Array<Scalars['uuid']['input']> | Scalars['uuid']['input'];
  hasDeleteLabels: Scalars['Boolean']['input'];
  insertLabels: Array<WorkoutLabels_Insert_Input> | WorkoutLabels_Insert_Input;
  hasInsertLabels: Scalars['Boolean']['input'];
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
export const BreadcrumbFoodDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BreadcrumbFood"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"food"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<BreadcrumbFoodQuery, BreadcrumbFoodQueryVariables>;
export const BreadcrumbMealDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BreadcrumbMeal"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"meal"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<BreadcrumbMealQuery, BreadcrumbMealQueryVariables>;
export const BreadcrumbNutritionPlanDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BreadcrumbNutritionPlan"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nutritionPlan"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<BreadcrumbNutritionPlanQuery, BreadcrumbNutritionPlanQueryVariables>;
export const DailyIntakeLogDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DailyIntakeLog"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"date"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"date"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nutritionDays"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"logDate"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"date"}}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"1"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"logDate"}},{"kind":"Field","name":{"kind":"Name","value":"nutritionPlanId"}},{"kind":"Field","name":{"kind":"Name","value":"nutritionLogMeals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"slotTime"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"createdAt"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"mealId"}},{"kind":"Field","name":{"kind":"Name","value":"nutritionPlanMealId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"slotTime"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"nutritionLogEntries"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"createdAt"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"nutritionLogMealId"}},{"kind":"Field","name":{"kind":"Name","value":"foodId"}},{"kind":"Field","name":{"kind":"Name","value":"grams"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"slotTime"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotFoodName"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotKcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotFatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotCarbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotProteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotFiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotSugarPer100g"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"nutritionLogEntries"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"nutritionLogMealId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_is_null"},"value":{"kind":"BooleanValue","value":true}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"slotTime"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"createdAt"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"source"}},{"kind":"Field","name":{"kind":"Name","value":"nutritionLogMealId"}},{"kind":"Field","name":{"kind":"Name","value":"foodId"}},{"kind":"Field","name":{"kind":"Name","value":"grams"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"slotTime"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotFoodName"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotKcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotFatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotCarbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotProteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotFiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotSugarPer100g"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"nutritionPlans"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"nutritionPlanMeals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"slotTime"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slotTime"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"meal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"mealIngredients"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"grams"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"food"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"kcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"carbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"proteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"sugarPer100g"}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"nutritionPlanFoods"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"slotTime"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slotTime"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"grams"}},{"kind":"Field","name":{"kind":"Name","value":"food"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"kcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"carbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"proteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"sugarPer100g"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"meals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"mealIngredients"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"grams"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"food"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"kcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"carbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"proteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"sugarPer100g"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"foods"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isPublic"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"kcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"carbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"proteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"sugarPer100g"}}]}}]}}]} as unknown as DocumentNode<DailyIntakeLogQuery, DailyIntakeLogQueryVariables>;
export const CreateNutritionDayDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateNutritionDay"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"object"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"nutritionDays_insert_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insertNutritionDay"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"object"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreateNutritionDayMutation, CreateNutritionDayMutationVariables>;
export const UpdateNutritionDayPlanDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateNutritionDayPlan"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"nutritionPlanId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateNutritionDay"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"nutritionPlanId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"nutritionPlanId"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nutritionPlanId"}}]}}]}}]} as unknown as DocumentNode<UpdateNutritionDayPlanMutation, UpdateNutritionDayPlanMutationVariables>;
export const UpdateNutritionLogEntryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateNutritionLogEntry"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"nutritionLogEntries_set_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateNutritionLogEntry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UpdateNutritionLogEntryMutation, UpdateNutritionLogEntryMutationVariables>;
export const DeleteNutritionLogEntryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteNutritionLogEntry"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteNutritionLogEntry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteNutritionLogEntryMutation, DeleteNutritionLogEntryMutationVariables>;
export const DeleteNutritionLogMealDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteNutritionLogMeal"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteNutritionLogMeal"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteNutritionLogMealMutation, DeleteNutritionLogMealMutationVariables>;
export const DeleteNutritionDayDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteNutritionDay"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteNutritionDay"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteNutritionDayMutation, DeleteNutritionDayMutationVariables>;
export const ExerciseDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExerciseDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exercise"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"instructions"}},{"kind":"Field","name":{"kind":"Name","value":"image1FileId"}},{"kind":"Field","name":{"kind":"Name","value":"image2FileId"}},{"kind":"Field","name":{"kind":"Name","value":"level"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"equipment"}},{"kind":"Field","name":{"kind":"Name","value":"primaryMuscleGroup"}},{"kind":"Field","name":{"kind":"Name","value":"strength"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"doubleWeight"}},{"kind":"Field","name":{"kind":"Name","value":"force"}},{"kind":"Field","name":{"kind":"Name","value":"mechanic"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cardio"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metricsSchema"}}]}},{"kind":"Field","name":{"kind":"Name","value":"secondaryMuscleGroups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"muscleGroup"}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionExercises"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"workoutSession"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"workout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionStrengthSets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"setNumber"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"setNumber"}},{"kind":"Field","name":{"kind":"Name","value":"reps"}},{"kind":"Field","name":{"kind":"Name","value":"weight"}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionCardioEntries"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"entryNumber"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"entryNumber"}},{"kind":"Field","name":{"kind":"Name","value":"metrics"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ExerciseDetailQuery, ExerciseDetailQueryVariables>;
export const ExercisePickerExercisesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExercisePickerExercises"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exercises"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"primaryMuscleGroup"}},{"kind":"Field","name":{"kind":"Name","value":"strength"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"doubleWeight"}}]}}]}}]}}]} as unknown as DocumentNode<ExercisePickerExercisesQuery, ExercisePickerExercisesQueryVariables>;
export const LogFoodDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LogFood"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"object"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"nutritionLogEntries_insert_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insertNutritionLogEntry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"object"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<LogFoodMutation, LogFoodMutationVariables>;
export const LogMealDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LogMeal"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"object"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"nutritionLogMeals_insert_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insertNutritionLogMeal"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"object"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<LogMealMutation, LogMealMutationVariables>;
export const MealFormFoodsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MealFormFoods"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"foods"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isPublic"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"kcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"carbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"proteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"sugarPer100g"}}]}}]}}]} as unknown as DocumentNode<MealFormFoodsQuery, MealFormFoodsQueryVariables>;
export const NutritionPlanFormPickersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"NutritionPlanFormPickers"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"meals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"mealIngredients"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"grams"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"food"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"kcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"carbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"proteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"sugarPer100g"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"foods"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isPublic"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"kcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"carbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"proteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"sugarPer100g"}}]}}]}}]} as unknown as DocumentNode<NutritionPlanFormPickersQuery, NutritionPlanFormPickersQueryVariables>;
export const InlineCreateFoodDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InlineCreateFood"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"object"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"foods_insert_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insertFood"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"object"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"kcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"carbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"proteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"sugarPer100g"}}]}}]}}]} as unknown as DocumentNode<InlineCreateFoodMutation, InlineCreateFoodMutationVariables>;
export const InlineSaveFoodDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InlineSaveFood"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"foods_set_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateFood"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"kcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"carbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"proteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"sugarPer100g"}}]}}]}}]} as unknown as DocumentNode<InlineSaveFoodMutation, InlineSaveFoodMutationVariables>;
export const InlineCreateMealDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InlineCreateMeal"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"object"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"meals_insert_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insertMeal"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"object"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"mealIngredients"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"grams"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"food"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"kcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"carbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"proteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"sugarPer100g"}}]}}]}}]}}]}}]} as unknown as DocumentNode<InlineCreateMealMutation, InlineCreateMealMutationVariables>;
export const InlineSaveMealDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InlineSaveMeal"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"meals_set_input"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"deleteIngredientIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasDeleteIngredients"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"insertIngredients"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"mealIngredients_insert_input"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasInsertIngredients"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ingredientUpdates"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"mealIngredients_updates"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasIngredientUpdates"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteMealIngredients"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_in"},"value":{"kind":"Variable","name":{"kind":"Name","value":"deleteIngredientIds"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasDeleteIngredients"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}},{"kind":"Field","name":{"kind":"Name","value":"insertMealIngredients"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"objects"},"value":{"kind":"Variable","name":{"kind":"Name","value":"insertIngredients"}}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasInsertIngredients"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}},{"kind":"Field","name":{"kind":"Name","value":"update_mealIngredients_many"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"updates"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ingredientUpdates"}}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasIngredientUpdates"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}},{"kind":"Field","name":{"kind":"Name","value":"updateMeal"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"mealIngredients"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"grams"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"food"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"kcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"carbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"proteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"sugarPer100g"}}]}}]}}]}}]}}]} as unknown as DocumentNode<InlineSaveMealMutation, InlineSaveMealMutationVariables>;
export const StartSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"obj"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"workoutSessions_insert_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insertWorkoutSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"obj"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<StartSessionMutation, StartSessionMutationVariables>;
export const BodyMeasurementByIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BodyMeasurementById"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"bodyMeasurement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"measuredOn"}},{"kind":"Field","name":{"kind":"Name","value":"weightKg"}},{"kind":"Field","name":{"kind":"Name","value":"bodyFatPct"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<BodyMeasurementByIdQuery, BodyMeasurementByIdQueryVariables>;
export const EditBodyMeasurementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EditBodyMeasurement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"bodyMeasurement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"measuredOn"}},{"kind":"Field","name":{"kind":"Name","value":"weightKg"}},{"kind":"Field","name":{"kind":"Name","value":"bodyFatPct"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}}]}}]}}]} as unknown as DocumentNode<EditBodyMeasurementQuery, EditBodyMeasurementQueryVariables>;
export const UpdateBodyMeasurementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateBodyMeasurement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"bodyMeasurements_set_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateBodyMeasurement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UpdateBodyMeasurementMutation, UpdateBodyMeasurementMutationVariables>;
export const DeleteBodyMeasurementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteBodyMeasurement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteBodyMeasurement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteBodyMeasurementMutation, DeleteBodyMeasurementMutationVariables>;
export const BodyMeasurementsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"BodyMeasurements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"bodyMeasurements"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"measuredOn"},"value":{"kind":"EnumValue","value":"desc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"measuredOn"}},{"kind":"Field","name":{"kind":"Name","value":"weightKg"}},{"kind":"Field","name":{"kind":"Name","value":"bodyFatPct"}},{"kind":"Field","name":{"kind":"Name","value":"notes"}}]}}]}}]} as unknown as DocumentNode<BodyMeasurementsQuery, BodyMeasurementsQueryVariables>;
export const InsertBodyMeasurementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InsertBodyMeasurement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"obj"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"bodyMeasurements_insert_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insertBodyMeasurement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"obj"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<InsertBodyMeasurementMutation, InsertBodyMeasurementMutationVariables>;
export const ExercisesIndexDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ExercisesIndex"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exercises"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"strength"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"doubleWeight"}}]}},{"kind":"Field","name":{"kind":"Name","value":"primaryMuscleGroup"}},{"kind":"Field","name":{"kind":"Name","value":"category"}},{"kind":"Field","name":{"kind":"Name","value":"equipment"}},{"kind":"Field","name":{"kind":"Name","value":"level"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"secondaryMuscleGroups"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"muscleGroup"}}]}}]}}]}}]} as unknown as DocumentNode<ExercisesIndexQuery, ExercisesIndexQueryVariables>;
export const JournalEntryByIdDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"JournalEntryById"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"journalEntry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"entryDate"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"journalEntryLabels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"labelId"}},{"kind":"Field","name":{"kind":"Name","value":"label"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<JournalEntryByIdQuery, JournalEntryByIdQueryVariables>;
export const EditJournalEntryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EditJournalEntry"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"journalEntry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"entryDate"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"journalEntryLabels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"labelId"}},{"kind":"Field","name":{"kind":"Name","value":"label"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"journalLabels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<EditJournalEntryQuery, EditJournalEntryQueryVariables>;
export const SaveJournalEntryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveJournalEntry"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"journalEntries_set_input"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"deleteLabelIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasDeleteLabels"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"insertLabels"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"journalEntryLabels_insert_input"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasInsertLabels"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateJournalEntry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"deleteJournalEntryLabels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"journalEntryId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"labelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_in"},"value":{"kind":"Variable","name":{"kind":"Name","value":"deleteLabelIds"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasDeleteLabels"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}},{"kind":"Field","name":{"kind":"Name","value":"insertJournalEntryLabels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"objects"},"value":{"kind":"Variable","name":{"kind":"Name","value":"insertLabels"}}},{"kind":"Argument","name":{"kind":"Name","value":"on_conflict"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"constraint"},"value":{"kind":"EnumValue","value":"journal_entry_labels_pkey"}},{"kind":"ObjectField","name":{"kind":"Name","value":"update_columns"},"value":{"kind":"ListValue","values":[]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasInsertLabels"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}}]}}]} as unknown as DocumentNode<SaveJournalEntryMutation, SaveJournalEntryMutationVariables>;
export const DeleteJournalEntryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteJournalEntry"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteJournalEntry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteJournalEntryMutation, DeleteJournalEntryMutationVariables>;
export const JournalEntriesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"JournalEntries"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"where"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"journalEntries_bool_exp"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"journalEntries"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"Variable","name":{"kind":"Name","value":"where"}}},{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"entryDate"},"value":{"kind":"EnumValue","value":"desc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"createdAt"},"value":{"kind":"EnumValue","value":"desc"}}]}]}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"entryDate"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"body"}},{"kind":"Field","name":{"kind":"Name","value":"journalEntryLabels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"labelId"}},{"kind":"Field","name":{"kind":"Name","value":"label"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<JournalEntriesQuery, JournalEntriesQueryVariables>;
export const JournalLabelsFilterDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"JournalLabelsFilter"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"journalLabels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<JournalLabelsFilterQuery, JournalLabelsFilterQueryVariables>;
export const JournalLabelsForFormDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"JournalLabelsForForm"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"journalLabels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<JournalLabelsForFormQuery, JournalLabelsForFormQueryVariables>;
export const InsertJournalEntryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InsertJournalEntry"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"obj"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"journalEntries_insert_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insertJournalEntry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"obj"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<InsertJournalEntryMutation, InsertJournalEntryMutationVariables>;
export const NutritionDaysIndexDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"NutritionDaysIndex"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nutritionDays"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"logDate"},"value":{"kind":"EnumValue","value":"desc"}}]}]}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"14"}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"logDate"}},{"kind":"Field","name":{"kind":"Name","value":"nutritionPlan"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nutritionLogMeals"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"nutritionLogEntries"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"grams"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotKcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotFatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotCarbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotProteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotFiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotSugarPer100g"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"nutritionLogEntries"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"nutritionLogMealId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_is_null"},"value":{"kind":"BooleanValue","value":true}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"grams"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotKcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotFatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotCarbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotProteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotFiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"snapshotSugarPer100g"}}]}}]}}]}}]} as unknown as DocumentNode<NutritionDaysIndexQuery, NutritionDaysIndexQueryVariables>;
export const FoodDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"FoodDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"food"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"kcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"carbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"proteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"sugarPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<FoodDetailQuery, FoodDetailQueryVariables>;
export const EditFoodDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EditFood"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"food"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"kcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"carbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"proteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"sugarPer100g"}}]}}]}}]} as unknown as DocumentNode<EditFoodQuery, EditFoodQueryVariables>;
export const SaveFoodDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveFood"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"foods_set_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateFood"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<SaveFoodMutation, SaveFoodMutationVariables>;
export const DeleteFoodDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteFood"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteFood"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteFoodMutation, DeleteFoodMutationVariables>;
export const FoodsIndexDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"FoodsIndex"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"foods"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isPublic"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"kcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"carbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"proteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"sugarPer100g"}}]}}]}}]} as unknown as DocumentNode<FoodsIndexQuery, FoodsIndexQueryVariables>;
export const CreateFoodDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateFood"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"object"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"foods_insert_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insertFood"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"object"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreateFoodMutation, CreateFoodMutationVariables>;
export const MealDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MealDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"meal"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"mealIngredients"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"grams"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"food"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"kcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"carbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"proteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"sugarPer100g"}}]}}]}}]}}]}}]} as unknown as DocumentNode<MealDetailQuery, MealDetailQueryVariables>;
export const EditMealDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EditMeal"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"meal"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"mealIngredients"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"foodId"}},{"kind":"Field","name":{"kind":"Name","value":"grams"}},{"kind":"Field","name":{"kind":"Name","value":"position"}}]}}]}}]}}]} as unknown as DocumentNode<EditMealQuery, EditMealQueryVariables>;
export const SaveMealDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveMeal"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"meals_set_input"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"deleteIngredientIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasDeleteIngredients"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"insertIngredients"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"mealIngredients_insert_input"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasInsertIngredients"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"ingredientUpdates"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"mealIngredients_updates"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasIngredientUpdates"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateMeal"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"deleteMealIngredients"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_in"},"value":{"kind":"Variable","name":{"kind":"Name","value":"deleteIngredientIds"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasDeleteIngredients"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}},{"kind":"Field","name":{"kind":"Name","value":"insertMealIngredients"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"objects"},"value":{"kind":"Variable","name":{"kind":"Name","value":"insertIngredients"}}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasInsertIngredients"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}},{"kind":"Field","name":{"kind":"Name","value":"update_mealIngredients_many"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"updates"},"value":{"kind":"Variable","name":{"kind":"Name","value":"ingredientUpdates"}}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasIngredientUpdates"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}}]}}]} as unknown as DocumentNode<SaveMealMutation, SaveMealMutationVariables>;
export const DeleteMealDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteMeal"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteMeal"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteMealMutation, DeleteMealMutationVariables>;
export const MealsIndexDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"MealsIndex"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"meals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"updatedAt"},"value":{"kind":"EnumValue","value":"desc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"mealIngredients"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"grams"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"food"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"kcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"carbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"proteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"sugarPer100g"}}]}}]}}]}}]}}]} as unknown as DocumentNode<MealsIndexQuery, MealsIndexQueryVariables>;
export const CreateMealDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateMeal"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"object"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"meals_insert_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insertMeal"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"object"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreateMealMutation, CreateMealMutationVariables>;
export const NutritionPlanDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"NutritionPlanDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nutritionPlan"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"nutritionPlanMeals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"slotTime"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"mealId"}},{"kind":"Field","name":{"kind":"Name","value":"slotTime"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"meal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"mealIngredients"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"grams"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"food"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"kcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"carbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"proteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"sugarPer100g"}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"nutritionPlanFoods"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"slotTime"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"foodId"}},{"kind":"Field","name":{"kind":"Name","value":"grams"}},{"kind":"Field","name":{"kind":"Name","value":"slotTime"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"food"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"kcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"carbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"proteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"sugarPer100g"}}]}}]}}]}}]}}]} as unknown as DocumentNode<NutritionPlanDetailQuery, NutritionPlanDetailQueryVariables>;
export const EditNutritionPlanDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EditNutritionPlan"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nutritionPlan"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"nutritionPlanMeals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"slotTime"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"mealId"}},{"kind":"Field","name":{"kind":"Name","value":"slotTime"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"position"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nutritionPlanFoods"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"slotTime"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"foodId"}},{"kind":"Field","name":{"kind":"Name","value":"grams"}},{"kind":"Field","name":{"kind":"Name","value":"slotTime"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"position"}}]}}]}}]}}]} as unknown as DocumentNode<EditNutritionPlanQuery, EditNutritionPlanQueryVariables>;
export const SaveNutritionPlanDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveNutritionPlan"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"nutritionPlans_set_input"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"deleteMealIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasDeleteMeals"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"deleteFoodIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasDeleteFoods"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"insertMeals"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"nutritionPlanMeals_insert_input"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasInsertMeals"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"insertFoods"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"nutritionPlanFoods_insert_input"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasInsertFoods"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"mealUpdates"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"nutritionPlanMeals_updates"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasMealUpdates"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"foodUpdates"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"nutritionPlanFoods_updates"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasFoodUpdates"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateNutritionPlan"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"deleteNutritionPlanMeals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_in"},"value":{"kind":"Variable","name":{"kind":"Name","value":"deleteMealIds"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasDeleteMeals"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}},{"kind":"Field","name":{"kind":"Name","value":"deleteNutritionPlanFoods"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_in"},"value":{"kind":"Variable","name":{"kind":"Name","value":"deleteFoodIds"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasDeleteFoods"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}},{"kind":"Field","name":{"kind":"Name","value":"insertNutritionPlanMeals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"objects"},"value":{"kind":"Variable","name":{"kind":"Name","value":"insertMeals"}}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasInsertMeals"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}},{"kind":"Field","name":{"kind":"Name","value":"insertNutritionPlanFoods"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"objects"},"value":{"kind":"Variable","name":{"kind":"Name","value":"insertFoods"}}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasInsertFoods"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}},{"kind":"Field","name":{"kind":"Name","value":"update_nutritionPlanMeals_many"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"updates"},"value":{"kind":"Variable","name":{"kind":"Name","value":"mealUpdates"}}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasMealUpdates"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}},{"kind":"Field","name":{"kind":"Name","value":"update_nutritionPlanFoods_many"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"updates"},"value":{"kind":"Variable","name":{"kind":"Name","value":"foodUpdates"}}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasFoodUpdates"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}}]}}]} as unknown as DocumentNode<SaveNutritionPlanMutation, SaveNutritionPlanMutationVariables>;
export const DeleteNutritionPlanDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteNutritionPlan"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteNutritionPlan"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteNutritionPlanMutation, DeleteNutritionPlanMutationVariables>;
export const PlansIndexDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PlansIndex"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"nutritionPlans"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"updatedAt"},"value":{"kind":"EnumValue","value":"desc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"nutritionPlanMeals"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"slotTime"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slotTime"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"meal"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"mealIngredients"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"grams"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"food"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"kcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"carbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"proteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"sugarPer100g"}}]}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"nutritionPlanFoods"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"slotTime"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"slotTime"}},{"kind":"Field","name":{"kind":"Name","value":"label"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"grams"}},{"kind":"Field","name":{"kind":"Name","value":"food"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"kcalPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fatPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"carbsPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"proteinPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"fiberPer100g"}},{"kind":"Field","name":{"kind":"Name","value":"sugarPer100g"}}]}}]}}]}}]}}]} as unknown as DocumentNode<PlansIndexQuery, PlansIndexQueryVariables>;
export const CreateNutritionPlanDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateNutritionPlan"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"object"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"nutritionPlans_insert_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insertNutritionPlan"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"object"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreateNutritionPlanMutation, CreateNutritionPlanMutationVariables>;
export const SessionDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SessionDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"workoutSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"workout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionExercises"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"exercise"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"primaryMuscleGroup"}},{"kind":"Field","name":{"kind":"Name","value":"image1FileId"}},{"kind":"Field","name":{"kind":"Name","value":"image2FileId"}},{"kind":"Field","name":{"kind":"Name","value":"strength"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"doubleWeight"}}]}},{"kind":"Field","name":{"kind":"Name","value":"cardio"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"metricsSchema"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionStrengthSets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"setNumber"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"setNumber"}},{"kind":"Field","name":{"kind":"Name","value":"reps"}},{"kind":"Field","name":{"kind":"Name","value":"weight"}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionCardioEntries"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"entryNumber"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"entryNumber"}},{"kind":"Field","name":{"kind":"Name","value":"metrics"}}]}}]}}]}}]}}]} as unknown as DocumentNode<SessionDetailQuery, SessionDetailQueryVariables>;
export const PriorSessionsPerExerciseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PriorSessionsPerExercise"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"exerciseIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"excludeSessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exercises"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_in"},"value":{"kind":"Variable","name":{"kind":"Name","value":"exerciseIds"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionExercises"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"IntValue","value":"3"}},{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"workoutSession"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startedAt"},"value":{"kind":"EnumValue","value":"desc"}}]}}]}},{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"workoutSessionId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_neq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"excludeSessionId"}}}]}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"workoutSession"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionStrengthSets"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"setNumber"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"setNumber"}},{"kind":"Field","name":{"kind":"Name","value":"reps"}},{"kind":"Field","name":{"kind":"Name","value":"weight"}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionCardioEntries"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"entryNumber"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"entryNumber"}},{"kind":"Field","name":{"kind":"Name","value":"metrics"}}]}}]}}]}}]}}]} as unknown as DocumentNode<PriorSessionsPerExerciseQuery, PriorSessionsPerExerciseQueryVariables>;
export const InsertWorkoutSessionStrengthSetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InsertWorkoutSessionStrengthSet"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"obj"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"workoutSessionStrengthSets_insert_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insertWorkoutSessionStrengthSet"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"obj"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<InsertWorkoutSessionStrengthSetMutation, InsertWorkoutSessionStrengthSetMutationVariables>;
export const UpdateWorkoutSessionStrengthSetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateWorkoutSessionStrengthSet"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"workoutSessionStrengthSets_set_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateWorkoutSessionStrengthSet"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UpdateWorkoutSessionStrengthSetMutation, UpdateWorkoutSessionStrengthSetMutationVariables>;
export const DeleteWorkoutSessionStrengthSetDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteWorkoutSessionStrengthSet"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteWorkoutSessionStrengthSet"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteWorkoutSessionStrengthSetMutation, DeleteWorkoutSessionStrengthSetMutationVariables>;
export const InsertWorkoutSessionCardioEntryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InsertWorkoutSessionCardioEntry"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"obj"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"workoutSessionCardioEntries_insert_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insertWorkoutSessionCardioEntry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"obj"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<InsertWorkoutSessionCardioEntryMutation, InsertWorkoutSessionCardioEntryMutationVariables>;
export const UpdateWorkoutSessionCardioEntryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateWorkoutSessionCardioEntry"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"workoutSessionCardioEntries_set_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateWorkoutSessionCardioEntry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UpdateWorkoutSessionCardioEntryMutation, UpdateWorkoutSessionCardioEntryMutationVariables>;
export const DeleteWorkoutSessionCardioEntryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteWorkoutSessionCardioEntry"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteWorkoutSessionCardioEntry"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteWorkoutSessionCardioEntryMutation, DeleteWorkoutSessionCardioEntryMutationVariables>;
export const UpdateSessionStartedAtDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateSessionStartedAt"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"startedAt"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"timestamptz"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateWorkoutSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startedAt"},"value":{"kind":"Variable","name":{"kind":"Name","value":"startedAt"}}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<UpdateSessionStartedAtMutation, UpdateSessionStartedAtMutationVariables>;
export const DeleteWorkoutSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteWorkoutSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteWorkoutSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteWorkoutSessionMutation, DeleteWorkoutSessionMutationVariables>;
export const InsertWorkoutSessionExercisesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"InsertWorkoutSessionExercises"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"objs"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"workoutSessionExercises_insert_input"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insertWorkoutSessionExercises"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"objects"},"value":{"kind":"Variable","name":{"kind":"Name","value":"objs"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}}]}}]} as unknown as DocumentNode<InsertWorkoutSessionExercisesMutation, InsertWorkoutSessionExercisesMutationVariables>;
export const DeleteWorkoutSessionExerciseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteWorkoutSessionExercise"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteWorkoutSessionExercise"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteWorkoutSessionExerciseMutation, DeleteWorkoutSessionExerciseMutationVariables>;
export const SessionsIndexDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"SessionsIndex"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"limit"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"offset"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"workoutSessions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"startedAt"},"value":{"kind":"EnumValue","value":"desc"}}]}},{"kind":"Argument","name":{"kind":"Name","value":"limit"},"value":{"kind":"Variable","name":{"kind":"Name","value":"limit"}}},{"kind":"Argument","name":{"kind":"Name","value":"offset"},"value":{"kind":"Variable","name":{"kind":"Name","value":"offset"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"workout"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionExercises_aggregate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionExercises"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"exercise"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionStrengthSets_aggregate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"sum"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"reps"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutSessionCardioEntries_aggregate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<SessionsIndexQuery, SessionsIndexQueryVariables>;
export const WorkoutDetailDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"WorkoutDetail"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"workout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"workoutExercises"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"exercise"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"strength"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"doubleWeight"}}]}},{"kind":"Field","name":{"kind":"Name","value":"primaryMuscleGroup"}},{"kind":"Field","name":{"kind":"Name","value":"image1FileId"}},{"kind":"Field","name":{"kind":"Name","value":"image2FileId"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutLabels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"labelId"}},{"kind":"Field","name":{"kind":"Name","value":"label"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<WorkoutDetailQuery, WorkoutDetailQueryVariables>;
export const EditWorkoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"EditWorkout"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"workout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"userId"}},{"kind":"Field","name":{"kind":"Name","value":"workoutExercises"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"position"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"position"}},{"kind":"Field","name":{"kind":"Name","value":"exercise"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"primaryMuscleGroup"}},{"kind":"Field","name":{"kind":"Name","value":"strength"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"doubleWeight"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutLabels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"labelId"}},{"kind":"Field","name":{"kind":"Name","value":"label"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<EditWorkoutQuery, EditWorkoutQueryVariables>;
export const SaveWorkoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SaveWorkout"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"set"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"workouts_set_input"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"deleteRowIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasDeleteRows"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"insertRows"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"workoutExercises_insert_input"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasInsertRows"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"positionUpdates"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"workoutExercises_updates"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasPositionUpdates"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"deleteLabelIds"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasDeleteLabels"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"insertLabels"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"workoutLabels_insert_input"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasInsertLabels"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateWorkout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"pk_columns"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"Argument","name":{"kind":"Name","value":"_set"},"value":{"kind":"Variable","name":{"kind":"Name","value":"set"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"deleteWorkoutExercises"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"id"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_in"},"value":{"kind":"Variable","name":{"kind":"Name","value":"deleteRowIds"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasDeleteRows"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}},{"kind":"Field","name":{"kind":"Name","value":"insertWorkoutExercises"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"objects"},"value":{"kind":"Variable","name":{"kind":"Name","value":"insertRows"}}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasInsertRows"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}},{"kind":"Field","name":{"kind":"Name","value":"update_workoutExercises_many"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"updates"},"value":{"kind":"Variable","name":{"kind":"Name","value":"positionUpdates"}}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasPositionUpdates"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}},{"kind":"Field","name":{"kind":"Name","value":"deleteWorkoutLabels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"where"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"workoutId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_eq"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}},{"kind":"ObjectField","name":{"kind":"Name","value":"labelId"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"_in"},"value":{"kind":"Variable","name":{"kind":"Name","value":"deleteLabelIds"}}}]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasDeleteLabels"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}},{"kind":"Field","name":{"kind":"Name","value":"insertWorkoutLabels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"objects"},"value":{"kind":"Variable","name":{"kind":"Name","value":"insertLabels"}}},{"kind":"Argument","name":{"kind":"Name","value":"on_conflict"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"constraint"},"value":{"kind":"EnumValue","value":"workout_labels_pkey"}},{"kind":"ObjectField","name":{"kind":"Name","value":"update_columns"},"value":{"kind":"ListValue","values":[]}}]}}],"directives":[{"kind":"Directive","name":{"kind":"Name","value":"include"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"if"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasInsertLabels"}}}]}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"affected_rows"}}]}}]}}]} as unknown as DocumentNode<SaveWorkoutMutation, SaveWorkoutMutationVariables>;
export const DeleteWorkoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteWorkout"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"uuid"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteWorkout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteWorkoutMutation, DeleteWorkoutMutationVariables>;
export const WorkoutsIndexDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"WorkoutsIndex"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"workouts"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ListValue","values":[{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"isPublic"},"value":{"kind":"EnumValue","value":"asc"}}]},{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"isPublic"}},{"kind":"Field","name":{"kind":"Name","value":"workoutExercises_aggregate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"aggregate"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"count"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"workoutLabels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"labelId"}},{"kind":"Field","name":{"kind":"Name","value":"label"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<WorkoutsIndexQuery, WorkoutsIndexQueryVariables>;
export const NewWorkoutLabelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"NewWorkoutLabels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"labels"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"order_by"},"value":{"kind":"ObjectValue","fields":[{"kind":"ObjectField","name":{"kind":"Name","value":"name"},"value":{"kind":"EnumValue","value":"asc"}}]}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<NewWorkoutLabelsQuery, NewWorkoutLabelsQueryVariables>;
export const CreateWorkoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateWorkout"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"obj"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"workouts_insert_input"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"insertWorkout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"object"},"value":{"kind":"Variable","name":{"kind":"Name","value":"obj"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreateWorkoutMutation, CreateWorkoutMutationVariables>;