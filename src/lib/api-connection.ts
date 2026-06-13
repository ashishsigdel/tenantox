import "server-only";

import { decrypt } from "@/lib/crypto";
import type { AuthConfig } from "@/types/meta";
import type { ApiConnection } from "@prisma/client";

/** Builds the auth headers for an ApiConnection, decrypting its secret blob. */
export function buildAuthHeaders(
  connection: Pick<ApiConnection, "authType" | "authConfig">,
): Record<string, string> {
  if (connection.authType === "NONE" || !connection.authConfig) return {};
  const config = JSON.parse(decrypt(connection.authConfig)) as AuthConfig;
  switch (config.type) {
    case "BEARER_TOKEN":
      return { Authorization: `Bearer ${config.token}` };
    case "API_KEY_HEADER":
      return { [config.headerName]: config.key };
    case "BASIC":
      return {
        Authorization: `Basic ${Buffer.from(
          `${config.username}:${config.password}`,
        ).toString("base64")}`,
      };
    default:
      return {};
  }
}
