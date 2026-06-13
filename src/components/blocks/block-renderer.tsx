import { ResourceTable } from "@/components/resource/resource-table";
import type {
  BlockDef,
  CalloutConfig,
  HeadingConfig,
  ResourceDef,
  TextConfig,
} from "@/types/meta";
import type { Role } from "@prisma/client";

import { ChartBlock } from "./chart-block";
import { StatBlock } from "./stat-block";
import { ButtonBlock } from "./button-block";
import { CalloutBlock } from "./callout-block";
import { Markdown } from "./markdown";

/** Maps a block definition to its rendered output. */
export function BlockRenderer({
  pageId,
  block,
  role,
  resource,
}: {
  pageId: string;
  block: BlockDef;
  role: Role;
  resource: ResourceDef | null;
}) {
  switch (block.type) {
    case "TABLE":
      return resource ? (
        <ResourceTable resource={resource} role={role} />
      ) : (
        <BlockError message="Table block isn't linked to a resource." />
      );

    case "CHART":
      return <ChartBlock pageId={pageId} block={block} />;

    case "STAT":
      return <StatBlock pageId={pageId} block={block} />;

    case "BUTTON":
      return <ButtonBlock pageId={pageId} block={block} />;

    case "HEADING": {
      const cfg = (block.config as HeadingConfig | null) ?? {
        text: "",
        level: 2,
      };
      const sizes = {
        1: "text-2xl font-semibold",
        2: "text-xl font-semibold",
        3: "text-lg font-medium",
      } as const;
      const Tag = (`h${cfg.level}`) as "h1" | "h2" | "h3";
      return <Tag className={sizes[cfg.level]}>{cfg.text}</Tag>;
    }

    case "TEXT": {
      const cfg = (block.config as TextConfig | null) ?? { markdown: "" };
      return <Markdown source={cfg.markdown} />;
    }

    case "DIVIDER":
      return <hr className="my-2 border-border" />;

    case "CALLOUT": {
      const cfg = (block.config as CalloutConfig | null) ?? {
        text: "",
        tone: "info",
      };
      return <CalloutBlock config={cfg} />;
    }

    default:
      return <BlockError message="Unknown block type." />;
  }
}

function BlockError({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-destructive/40 p-4 text-sm text-destructive">
      {message}
    </div>
  );
}
