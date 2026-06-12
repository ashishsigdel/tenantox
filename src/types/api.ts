/**
 * The external API contract (data plane). Every backend connected to the
 * dashboard must respond with this envelope. Documented at /docs.
 */

export interface ListMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ListMeta;
}

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INTERNAL_ERROR";

export interface ApiError {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    /** Per-field validation messages, mapped onto form inputs by the dashboard. */
    fields?: Record<string, string>;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/** A single record from the data plane. Shape is defined by FieldDefinitions. */
export type DataRecord = Record<string, unknown>;

/** Query the dashboard sends to list endpoints. */
export interface ListQuery {
  page: number;
  pageSize: number;
  /** Field name, "-" prefix for descending, e.g. "-createdAt". */
  sort?: string;
  search?: string;
  /** filter[field]=value or filter[field][op]=value (op: gte|lte|gt|lt|ne|like|in) */
  filters?: Record<string, string | Record<string, string>>;
}
