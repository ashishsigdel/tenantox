"use client";

import { useState } from "react";
import type { Control } from "react-hook-form";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useRelationOptions } from "@/lib/data-provider";
import { cn } from "@/lib/utils";
import type { FieldDef, SelectOption } from "@/types/meta";

const INPUT_TYPE: Partial<Record<FieldDef["type"], string>> = {
  TEXT: "text",
  EMAIL: "email",
  URL: "url",
  PASSWORD: "password",
  SLUG: "text",
  DATE: "date",
  DATETIME: "datetime-local",
  COLOR: "color",
  FILE: "url",
  IMAGE: "url",
};

/** Options for SELECT-likes: static list, or loaded from another resource. */
function useFieldOptions(field: FieldDef, search?: string): SelectOption[] {
  const source = field.config?.optionsSource ?? field.config?.relation;
  const isDynamic = !field.config?.options && !!source;
  const { data: dynamicOptions } = useRelationOptions(
    isDynamic ? source?.resourceSlug : undefined,
    source?.labelField ?? "name",
    source?.valueField ?? "id",
    search,
  );
  return field.config?.options ?? dynamicOptions ?? [];
}

function RelationCombobox({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const options = useFieldOptions(field, debounced || undefined);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={cn(
            "h-11 w-full justify-between px-3.5 font-normal",
            !value && "text-muted-foreground",
          )}
        >
          {selected?.label ?? (value || "Select…")}
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                onSelect={() => {
                  onChange(option.value === value ? "" : option.value);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "size-4",
                    option.value === value ? "opacity-100" : "opacity-0",
                  )}
                />
                {option.label}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SelectInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = useFieldOptions(field);
  return (
    <Select value={value} onValueChange={onChange} disabled={field.readOnly}>
      <SelectTrigger className="h-11 w-full px-3.5">
        <SelectValue placeholder={field.placeholder ?? "Select…"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MultiSelectInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const options = useFieldOptions(field);
  return (
    <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
      {options.length === 0 && (
        <p className="text-sm text-muted-foreground">No options configured.</p>
      )}
      {options.map((option) => {
        const checked = value.includes(option.value);
        return (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <Checkbox
              checked={checked}
              disabled={field.readOnly}
              onCheckedChange={(next) =>
                onChange(
                  next
                    ? [...value, option.value]
                    : value.filter((v) => v !== option.value),
                )
              }
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}

export function FieldInput({
  field,
  control,
}: {
  field: FieldDef;
  control: Control<Record<string, unknown>>;
}) {
  return (
    <FormField
      control={control}
      name={field.key}
      render={({ field: rhf }) => (
        <FormItem
          className={cn(
            field.width === "half" && "sm:col-span-3",
            field.width === "third" && "sm:col-span-2",
            field.width === "full" && "sm:col-span-6",
          )}
        >
          {field.type !== "BOOLEAN" && <FormLabel>{field.label}</FormLabel>}

          {(() => {
            const value = rhf.value;
            switch (field.type) {
              case "TEXTAREA":
              case "RICH_TEXT":
                return (
                  <FormControl>
                    <Textarea
                      placeholder={field.placeholder ?? undefined}
                      rows={field.config?.rows ?? 4}
                      readOnly={field.readOnly}
                      value={(value as string) ?? ""}
                      onChange={rhf.onChange}
                      onBlur={rhf.onBlur}
                    />
                  </FormControl>
                );
              case "JSON":
                return (
                  <FormControl>
                    <Textarea
                      placeholder={field.placeholder ?? '{ "key": "value" }'}
                      rows={field.config?.rows ?? 6}
                      readOnly={field.readOnly}
                      className="font-mono text-sm"
                      value={(value as string) ?? ""}
                      onChange={rhf.onChange}
                      onBlur={rhf.onBlur}
                    />
                  </FormControl>
                );
              case "NUMBER":
                return (
                  <FormControl>
                    <Input
                      type="number"
                      placeholder={field.placeholder ?? undefined}
                      min={field.config?.min}
                      max={field.config?.max}
                      step={field.config?.step ?? "any"}
                      readOnly={field.readOnly}
                      className="h-11 px-3.5"
                      value={(value as string | number) ?? ""}
                      onChange={rhf.onChange}
                      onBlur={rhf.onBlur}
                    />
                  </FormControl>
                );
              case "BOOLEAN":
                return (
                  <div className="flex items-center gap-3 pt-1">
                    <FormControl>
                      <Switch
                        checked={value === true}
                        disabled={field.readOnly}
                        onCheckedChange={rhf.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">{field.label}</FormLabel>
                  </div>
                );
              case "SELECT":
                return (
                  <SelectInput
                    field={field}
                    value={(value as string) ?? ""}
                    onChange={rhf.onChange}
                  />
                );
              case "RADIO": {
                return (
                  <FormControl>
                    <RadioGroup
                      value={(value as string) ?? ""}
                      onValueChange={rhf.onChange}
                      className="flex flex-wrap gap-4 pt-1"
                    >
                      {(field.config?.options ?? []).map((option) => (
                        <label
                          key={option.value}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <RadioGroupItem value={option.value} />
                          {option.label}
                        </label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                );
              }
              case "MULTI_SELECT":
                return (
                  <MultiSelectInput
                    field={field}
                    value={(value as string[]) ?? []}
                    onChange={rhf.onChange}
                  />
                );
              case "RELATION":
                return (
                  <RelationCombobox
                    field={field}
                    value={(value as string) ?? ""}
                    onChange={rhf.onChange}
                  />
                );
              default:
                return (
                  <FormControl>
                    <Input
                      type={INPUT_TYPE[field.type] ?? "text"}
                      placeholder={field.placeholder ?? undefined}
                      readOnly={field.readOnly}
                      className="h-11 px-3.5"
                      value={(value as string) ?? ""}
                      onChange={rhf.onChange}
                      onBlur={rhf.onBlur}
                    />
                  </FormControl>
                );
            }
          })()}

          {field.helpText && (
            <FormDescription>{field.helpText}</FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
