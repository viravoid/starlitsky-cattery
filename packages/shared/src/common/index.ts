export type ID = string;

export type ISODateTimeString = string;

export interface TimestampFields {
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<TItem> {
  items: TItem[];
  pagination: PaginationMeta;
}

export type VisibilityStatus = "visible" | "hidden" | "archived";
