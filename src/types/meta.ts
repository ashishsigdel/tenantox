/**
 * Types for the config plane meta-schema: the JSON blobs stored on
 * Resource, FieldDefinition, and MenuItem rows.
 */
import type { Role, FieldType, BlockType } from "@prisma/client";

export type CrudOperation = "list" | "getOne" | "create" | "update" | "delete";

export interface EndpointConfig {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path relative to the connection baseUrl. `{id}` is replaced per record. */
  path: string;
  /**
   * Whether this operation is active. The enabled set drives the table UI:
   * list→table, getOne→row detail, create→Add, update→Edit, delete→Delete.
   * Source of truth; `ResourceCapabilities` is derived/deprecated. Optional on
   * input (older rows omit it); `toResourceDef` always fills it, so a loaded
   * ResourceDef has a concrete boolean. Only `false` disables.
   */
  enabled?: boolean;
  /**
   * Per-operation override for where the record(s) live in the response.
   * `undefined` → fall back to the resource's `apiMapping.response.dataPath`;
   * `""` → the response root. Lets list and getOne use different shapes.
   */
  dataPath?: string;
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

/** How to read the records / total / success / error out of the API response. */
export interface ResponseMapping {
  /** JSON path to the records array (list) and record (getOne/create/update). "" = root. */
  dataPath: string;
  /** JSON path to the total count, for pagination. */
  totalPath: string;
  /** JSON path to a success flag; blank = auto (envelope `success` boolean, else HTTP 2xx). */
  successPath?: string;
  /** JSON path to an error message; blank = envelope `error.message` then HTTP status text. */
  errorPath?: string;
}

export type FilterStyle = "bracket" | "flat";

/** How to name the outgoing list query params and encode filters. */
export interface RequestMapping {
  pageParam: string;
  pageSizeParam: string;
  sortParam: string;
  searchParam: string;
  /** bracket → filter[field][op]=value ; flat → field=value (equality only). */
  filterStyle: FilterStyle;
}

export interface ApiMapping {
  request: RequestMapping;
  response: ResponseMapping;
}

export const DEFAULT_API_MAPPING: ApiMapping = {
  request: {
    pageParam: "page",
    pageSizeParam: "pageSize",
    sortParam: "sort",
    searchParam: "search",
    filterStyle: "bracket",
  },
  response: {
    dataPath: "data",
    totalPath: "meta.total",
    successPath: "",
    errorPath: "",
  },
};

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
  apiMapping: ApiMapping;
  fields: FieldDef[];
}

/* -------------------------------------------------------------------------- */
/* Page builder: blocks composed into a custom Page.                          */
/* -------------------------------------------------------------------------- */

export type BlockWidth = "full" | "half" | "third";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * How a block gets its data.
 *  - resource: reuse an existing Resource (Table block → full CRUD engine).
 *  - raw: hit an ApiConnection endpoint directly (chart / stat / button).
 * For `raw`, the request is built server-side from this stored config; the
 * browser only ever references the block by id.
 */
export type BlockDataSource =
  | { mode: "resource"; resourceId: string }
  | {
      mode: "raw";
      connectionId: string;
      method: HttpMethod;
      /** Path relative to the connection baseUrl. Supports `{{var}}` interpolation. */
      path: string;
      /** JSON path to the array/object the block renders from, e.g. "data.items". */
      rootPath?: string;
      /** Static query params merged into the request. */
      query?: Record<string, string>;
    };

export type StatAggregate = "raw" | "count" | "sum" | "avg" | "min" | "max";

export interface StatMetric {
  label: string;
  /** JSON path to the value (relative to rootPath when aggregating an array). */
  valuePath: string;
  aggregate: StatAggregate;
  format?: CellFormat;
  icon?: string;
}

export interface StatConfig {
  title?: string;
  metrics: StatMetric[];
  /** Number of cards per row (1–4). Defaults to 3. */
  columns?: 1 | 2 | 3 | 4;
}

export type ChartKind = "line" | "bar" | "area" | "pie" | "donut";

export interface ChartSeries {
  label: string;
  /** JSON path to the numeric value within each row (relative to rootPath). */
  yPath: string;
  color?: string;
}

export interface ChartConfig {
  title?: string;
  chartType: ChartKind;
  /** JSON path to the category/label within each row (relative to rootPath). */
  xPath: string;
  series: ChartSeries[];
}

export interface ButtonConfig {
  label: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
  /** Confirmation prompt shown before firing; omit to fire immediately. */
  confirm?: string;
  successMessage?: string;
  /** Static body sent with the request. */
  payload?: Record<string, unknown>;
}

export interface HeadingConfig {
  text: string;
  level: 1 | 2 | 3;
}

export interface TextConfig {
  markdown: string;
}

export interface CalloutConfig {
  text: string;
  tone: "info" | "success" | "warning" | "danger";
  icon?: string;
}

export interface TableBlockConfig {
  title?: string;
}

/** Union of every block's config shape; narrowed by BlockDef["type"]. */
export type BlockConfig =
  | TableBlockConfig
  | ChartConfig
  | StatConfig
  | ButtonConfig
  | HeadingConfig
  | TextConfig
  | CalloutConfig
  | null;

/** A Block row with JSON columns narrowed to real types. */
export interface BlockDef {
  id: string;
  type: BlockType;
  order: number;
  width: BlockWidth;
  config: BlockConfig;
  dataSource: BlockDataSource | null;
  /** Roles allowed to see this block; null = inherit the page's viewRole. */
  visibleToRoles: Role[] | null;
}

/** A Page row with JSON columns narrowed, plus its ordered blocks. */
export interface PageDef {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  viewRole: Role;
  blocks: BlockDef[];
}
