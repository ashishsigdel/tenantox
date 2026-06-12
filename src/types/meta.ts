/**
 * Types for the config plane meta-schema: the JSON blobs stored on
 * Resource, FieldDefinition, and MenuItem rows.
 */
import type { Role, FieldType } from "@prisma/client";

export type CrudOperation = "list" | "getOne" | "create" | "update" | "delete";

export interface EndpointConfig {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path relative to the connection baseUrl. `{id}` is replaced per record. */
  path: string;
}

export type ResourceEndpoints = Record<CrudOperation, EndpointConfig>;

export interface ResourceCapabilities {
  create: boolean;
  update: boolean;
  delete: boolean;
  view: boolean;
}

/** Minimum role required per operation. */
export interface ResourcePermissions {
  view: Role;
  create: Role;
  update: Role;
  delete: Role;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface OptionsSource {
  resourceSlug: string;
  valueField: string;
  labelField: string;
}

/** Type-specific config stored in FieldDefinition.config. */
export interface FieldConfig {
  // SELECT / MULTI_SELECT / RADIO
  options?: SelectOption[];
  optionsSource?: OptionsSource;
  // RELATION
  relation?: OptionsSource & { multiple?: boolean };
  // NUMBER
  min?: number;
  max?: number;
  step?: number;
  // FILE / IMAGE
  accept?: string;
  maxSizeMB?: number;
  uploadEndpoint?: string;
  // TEXTAREA / RICH_TEXT
  rows?: number;
}

export interface FieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  /** Custom error messages keyed by rule name. */
  messages?: Record<string, string>;
}

export type VisibleIfOperator = "eq" | "neq" | "in" | "truthy";

export interface VisibleIf {
  field: string;
  operator: VisibleIfOperator;
  value?: unknown;
}

export type FieldWidth = "full" | "half" | "third";

export type CellFormat =
  | "text"
  | "badge"
  | "date"
  | "datetime"
  | "currency"
  | "boolean-icon"
  | "image-thumb"
  | "truncate"
  | "link";

/** Decrypted ApiConnection.authConfig shapes, keyed by authType. */
export type AuthConfig =
  | { type: "NONE" }
  | { type: "BEARER_TOKEN"; token: string }
  | { type: "API_KEY_HEADER"; headerName: string; key: string }
  | { type: "BASIC"; username: string; password: string };

/** A FieldDefinition row with its JSON columns narrowed to real types. */
export interface FieldDef {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  order: number;
  config: FieldConfig | null;
  validation: FieldValidation | null;
  showInForm: boolean;
  placeholder: string | null;
  helpText: string | null;
  defaultValue: string | null;
  readOnly: boolean;
  width: FieldWidth;
  visibleIf: VisibleIf | null;
  showInTable: boolean;
  sortable: boolean;
  filterable: boolean;
  tableOrder: number;
  format: CellFormat;
  badgeColorMap: Record<string, string> | null;
}

/** A Resource row with JSON columns narrowed, plus its fields. */
export interface ResourceDef {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  apiConnectionId: string;
  endpoints: ResourceEndpoints;
  primaryKeyField: string;
  titleField: string;
  capabilities: ResourceCapabilities;
  permissions: ResourcePermissions;
  fields: FieldDef[];
}
