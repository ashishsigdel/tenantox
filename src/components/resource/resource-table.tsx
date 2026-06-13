"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  ListFilter,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CellRenderer } from "@/components/resource/cell-renderer";
import { ResourceForm } from "@/components/resource/resource-form";
import { RecordDetail, RecordEditor } from "@/components/resource/record-views";
import {
  DataApiError,
  useDeleteRecord,
  useRecordList,
} from "@/lib/data-provider";
import { hasRole } from "@/lib/roles";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { DataRecord } from "@/types/api";
import type { FieldDef, ResourceDef } from "@/types/meta";
import type { Role } from "@prisma/client";

type Filters = Record<string, string | Record<string, string>>;

function FilterControl({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: Filters[string] | undefined;
  onChange: (value: Filters[string] | undefined) => void;
}) {
  if (
    field.type === "SELECT" ||
    field.type === "RADIO" ||
    field.type === "BOOLEAN"
  ) {
    const options =
      field.type === "BOOLEAN"
        ? [
            { label: "Yes", value: "true" },
            { label: "No", value: "false" },
          ]
        : (field.config?.options ?? []);
    return (
      <Select
        value={typeof value === "string" ? value : ""}
        onValueChange={(v) => onChange(v === "__all" ? undefined : v)}
      >
        <SelectTrigger size="sm" className="w-full">
          <SelectValue placeholder="Any" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">Any</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field.type === "NUMBER") {
    const range = (typeof value === "object" ? value : {}) as Record<
      string,
      string
    >;
    const update = (op: "gte" | "lte", v: string) => {
      const next = { ...range };
      if (v === "") delete next[op];
      else next[op] = v;
      onChange(Object.keys(next).length > 0 ? next : undefined);
    };
    return (
      <div className="flex gap-2">
        <Input
          type="number"
          placeholder="Min"
          className="h-8"
          value={range.gte ?? ""}
          onChange={(e) => update("gte", e.target.value)}
        />
        <Input
          type="number"
          placeholder="Max"
          className="h-8"
          value={range.lte ?? ""}
          onChange={(e) => update("lte", e.target.value)}
        />
      </div>
    );
  }

  return (
    <Input
      placeholder="Contains…"
      className="h-8"
      value={
        typeof value === "object" ? (value.like ?? "") : ""
      }
      onChange={(e) =>
        onChange(e.target.value ? { like: e.target.value } : undefined)
      }
    />
  );
}

export function ResourceTable({
  resource,
  role,
}: {
  resource: ResourceDef;
  role: Role;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({});
  const [deleteTarget, setDeleteTarget] = useState<
    { ids: (string | number)[] } | null
  >(null);
  const [formSheet, setFormSheet] = useState<
    { mode: "create" } | { mode: "edit"; id: string } | null
  >(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(search, 350);
  const pk = resource.primaryKeyField;

  const can = {
    create:
      resource.endpoints.create.enabled &&
      hasRole(role, resource.permissions.create),
    update:
      resource.endpoints.update.enabled &&
      hasRole(role, resource.permissions.update),
    delete:
      resource.endpoints.delete.enabled &&
      hasRole(role, resource.permissions.delete),
    view: resource.endpoints.getOne.enabled,
  };

  const { data, isLoading, isFetching, error } = useRecordList(resource.slug, {
    page,
    pageSize,
    sort,
    search: debouncedSearch || undefined,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  });

  const deleteMutation = useDeleteRecord(resource.slug);

  const tableFields = useMemo(
    () =>
      resource.fields
        .filter((f) => f.showInTable)
        .sort((a, b) => a.tableOrder - b.tableOrder),
    [resource.fields],
  );
  const filterableFields = resource.fields.filter((f) => f.filterable);
  const activeFilterCount = Object.keys(filters).length;

  const columns = useMemo<ColumnDef<DataRecord>[]>(() => {
    const cols: ColumnDef<DataRecord>[] = [
      {
        id: "__select",
        enableHiding: false,
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Select row"
            onClick={(e) => e.stopPropagation()}
          />
        ),
      },
      ...tableFields.map<ColumnDef<DataRecord>>((field) => ({
        id: field.key,
        accessorKey: field.key,
        header: () =>
          field.sortable ? (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 h-8"
              onClick={() =>
                setSort((current) =>
                  current === field.key
                    ? `-${field.key}`
                    : current === `-${field.key}`
                      ? undefined
                      : field.key,
                )
              }
            >
              {field.label}
              {sort === field.key ? (
                <ArrowUp className="size-3.5" />
              ) : sort === `-${field.key}` ? (
                <ArrowDown className="size-3.5" />
              ) : (
                <ArrowUpDown className="size-3.5 opacity-50" />
              )}
            </Button>
          ) : (
            field.label
          ),
        cell: ({ row }) => (
          <CellRenderer field={field} value={row.original[field.key]} />
        ),
      })),
      {
        id: "__actions",
        enableHiding: false,
        cell: ({ row }) => {
          const id = row.original[pk] as string | number;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                {can.view && (
                  <DropdownMenuItem onClick={() => setDetailId(String(id))}>
                    <Eye className="size-4" /> View
                  </DropdownMenuItem>
                )}
                {can.update && (
                  <DropdownMenuItem
                    onClick={() => setFormSheet({ mode: "edit", id: String(id) })}
                  >
                    <Pencil className="size-4" /> Edit
                  </DropdownMenuItem>
                )}
                {can.delete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteTarget({ ids: [id] })}
                    >
                      <Trash2 className="size-4" /> Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ];
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableFields, sort, can.view, can.update, can.delete, resource.slug, pk]);

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    state: { rowSelection, columnVisibility },
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getRowId: (row, index) => String(row[pk] ?? index),
  });

  const selectedIds = Object.keys(rowSelection).filter(
    (key) => rowSelection[key],
  );
  const meta = data?.meta;

  async function confirmDelete() {
    if (!deleteTarget) return;
    const ids = deleteTarget.ids;
    setDeleteTarget(null);
    try {
      for (const id of ids) {
        await deleteMutation.mutateAsync(id);
      }
      toast.success(
        ids.length === 1 ? "Record deleted" : `${ids.length} records deleted`,
      );
      setRowSelection({});
    } catch (e) {
      toast.error(
        e instanceof DataApiError ? e.message : "Failed to delete record",
      );
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={`Search ${resource.name.toLowerCase()}…`}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-64 pl-8"
          />
        </div>

        {filterableFields.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <ListFilter className="size-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 space-y-3" align="start">
              {filterableFields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <div className="text-xs font-medium text-muted-foreground">
                    {field.label}
                  </div>
                  <FilterControl
                    field={field}
                    value={filters[field.key]}
                    onChange={(value) => {
                      setFilters((current) => {
                        const next = { ...current };
                        if (value === undefined) delete next[field.key];
                        else next[field.key] = value;
                        return next;
                      });
                      setPage(1);
                    }}
                  />
                </div>
              ))}
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setFilters({})}
                >
                  Clear filters
                </Button>
              )}
            </PopoverContent>
          </Popover>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings2 className="size-4" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((col) => col.getCanHide())
              .map((col) => {
                const field = tableFields.find((f) => f.key === col.id);
                return (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    checked={col.getIsVisible()}
                    onCheckedChange={(v) => col.toggleVisibility(!!v)}
                  >
                    {field?.label ?? col.id}
                  </DropdownMenuCheckboxItem>
                );
              })}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-center gap-2">
          {isFetching && !isLoading && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )}
          {selectedIds.length > 0 && can.delete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteTarget({ ids: selectedIds })}
            >
              <Trash2 className="size-4" />
              Delete ({selectedIds.length})
            </Button>
          )}
          {can.create && (
            <Button size="sm" onClick={() => setFormSheet({ mode: "create" })}>
              <Plus className="size-4" />
              New {resource.name.replace(/s$/, "")}
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  <Loader2 className="mx-auto size-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-destructive"
                >
                  {error instanceof DataApiError
                    ? error.message
                    : "Failed to load data"}
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  No records found.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={can.view ? "cursor-pointer" : undefined}
                  onClick={() =>
                    can.view && setDetailId(String(row.original[pk]))
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {meta
            ? `${meta.total} record${meta.total === 1 ? "" : "s"}`
            : " "}
          {selectedIds.length > 0 && ` · ${selectedIds.length} selected`}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger size="sm" className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-sm text-muted-foreground">
            Page {meta?.page ?? page} of {meta?.totalPages ?? "…"}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!meta || page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.ids.length === 1 ? "record" : `${deleteTarget?.ids.length} records`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The record
              {deleteTarget && deleteTarget.ids.length > 1 ? "s" : ""} will be
              permanently deleted from the external API.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create / edit record */}
      <Sheet
        open={formSheet !== null}
        onOpenChange={(open) => !open && setFormSheet(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {formSheet?.mode === "edit" ? "Edit" : "New"}{" "}
              {resource.name.replace(/s$/, "")}
            </SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            {formSheet?.mode === "edit" ? (
              <RecordEditor
                resource={resource}
                recordId={formSheet.id}
                onSuccess={() => setFormSheet(null)}
                onCancel={() => setFormSheet(null)}
              />
            ) : formSheet?.mode === "create" ? (
              <ResourceForm
                resource={resource}
                onSuccess={() => setFormSheet(null)}
                onCancel={() => setFormSheet(null)}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      {/* Record detail */}
      <Sheet
        open={detailId !== null}
        onOpenChange={(open) => !open && setDetailId(null)}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{resource.name.replace(/s$/, "")} details</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            {detailId !== null && (
              <RecordDetail
                resource={resource}
                recordId={detailId}
                role={role}
                onEdit={() => {
                  const id = detailId;
                  setDetailId(null);
                  setFormSheet({ mode: "edit", id });
                }}
                onDeleted={() => setDetailId(null)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
