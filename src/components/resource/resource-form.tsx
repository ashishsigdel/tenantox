"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { FieldInput } from "@/components/resource/field-input";
import {
  DataApiError,
  useCreateRecord,
  useUpdateRecord,
} from "@/lib/data-provider";
import {
  buildDefaultValues,
  buildFormSchema,
  buildPayload,
  isFieldVisible,
} from "@/lib/form-schema";
import type { DataRecord } from "@/types/api";
import type { ResourceDef } from "@/types/meta";

type FormValues = Record<string, unknown>;

export function ResourceForm({
  resource,
  record,
  recordId,
  preview = false,
}: {
  resource: ResourceDef;
  /** Existing record → edit mode; absent → create mode. */
  record?: DataRecord;
  recordId?: string;
  /** Builder preview: validates but never submits to the API. */
  preview?: boolean;
}) {
  const router = useRouter();
  const isEdit = recordId != null;

  const formFields = useMemo(
    () => resource.fields.filter((f) => f.showInForm),
    [resource.fields],
  );

  // Validation only covers fields that are visible at submit time, so
  // conditionally hidden fields can't block the form.
  const resolver: Resolver<FormValues> = useMemo(
    () => (values, context, options) => {
      const visibleFields = formFields.filter((f) =>
        isFieldVisible(f.visibleIf, values),
      );
      return zodResolver(buildFormSchema(visibleFields))(
        values,
        context,
        options,
      );
    },
    [formFields],
  );

  const form = useForm<FormValues>({
    resolver,
    defaultValues: buildDefaultValues(formFields, record),
  });

  const createMutation = useCreateRecord(resource.slug);
  const updateMutation = useUpdateRecord(resource.slug);
  const pending = createMutation.isPending || updateMutation.isPending;

  const watched = form.watch();
  const visibleFields = formFields.filter((f) =>
    isFieldVisible(f.visibleIf, watched),
  );

  async function onSubmit(values: FormValues) {
    const payload = buildPayload(visibleFields, values);
    if (preview) {
      toast.info("Preview only — nothing was submitted.", {
        description: JSON.stringify(payload),
      });
      return;
    }
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: recordId, payload });
        toast.success(`${resource.name.replace(/s$/, "")} updated`);
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(`${resource.name.replace(/s$/, "")} created`);
      }
      router.push(`/dashboard/r/${resource.slug}`);
      router.refresh();
    } catch (e) {
      if (e instanceof DataApiError) {
        if (e.fields) {
          for (const [key, msg] of Object.entries(e.fields)) {
            form.setError(key, { type: "server", message: msg });
          }
          toast.error("Please fix the highlighted fields.");
        } else {
          toast.error(e.message);
        }
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid max-w-3xl gap-x-4 gap-y-5 sm:grid-cols-6"
      >
        {visibleFields.map((field) => (
          <FieldInput key={field.id} field={field} control={form.control} />
        ))}

        <div className="flex gap-2 sm:col-span-6">
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Create"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
