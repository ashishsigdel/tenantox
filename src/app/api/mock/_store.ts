/**
 * In-memory store backing the bundled mock external API. It exists so the
 * dashboard demos out of the box and so the contract has a reference
 * implementation. Data resets when the dev server restarts.
 */
import type { DataRecord } from "@/types/api";

interface Collection {
  records: DataRecord[];
  nextId: number;
  /** Keys that must be present and non-empty on create/update. */
  required: string[];
}

const PRODUCT_NAMES: [string, string, number, number, string, string][] = [
  ["Wireless Headphones", "electronics", 129.99, 42, "active", "Noise-cancelling over-ear headphones with 30h battery."],
  ["Mechanical Keyboard", "electronics", 89.5, 15, "active", "Hot-swappable switches, RGB backlight."],
  ["Cotton T-Shirt", "clothing", 19.99, 200, "active", "100% organic cotton, unisex fit."],
  ["Denim Jacket", "clothing", 74.0, 31, "draft", "Classic fit denim jacket."],
  ["TypeScript Handbook", "books", 39.0, 88, "active", "A practical guide to modern TypeScript."],
  ["Design Patterns", "books", 54.25, 12, "archived", "The classic GoF reference."],
  ["Ceramic Planter", "home", 24.5, 64, "active", "Minimal ceramic planter, 6 inch."],
  ["LED Desk Lamp", "home", 45.99, 27, "active", "Adjustable color temperature desk lamp."],
  ["USB-C Hub", "electronics", 59.99, 53, "active", "7-in-1 hub with HDMI and PD charging."],
  ["Running Shoes", "clothing", 119.0, 9, "draft", "Lightweight trainers for daily runs."],
  ["Cookbook: Pasta", "books", 29.99, 41, "active", "60 regional Italian pasta recipes."],
  ["Throw Blanket", "home", 34.0, 18, "archived", "Soft knit blanket, 130x170cm."],
];

function seedProducts(): Collection {
  const now = Date.now();
  return {
    nextId: PRODUCT_NAMES.length + 1,
    required: ["name", "price"],
    records: PRODUCT_NAMES.map(
      ([name, category, price, stock, status, description], i) => ({
        id: String(i + 1),
        name,
        description,
        price,
        stock,
        status,
        category,
        featured: i % 4 === 0,
        discountPercent: i % 4 === 0 ? 10 : null,
        imageUrl: null,
        createdAt: new Date(now - (PRODUCT_NAMES.length - i) * 86_400_000)
          .toISOString(),
        updatedAt: new Date(now - (PRODUCT_NAMES.length - i) * 86_400_000)
          .toISOString(),
      }),
    ),
  };
}

type MockDb = Map<string, Collection>;

const globalForMock = globalThis as unknown as { mockDb?: MockDb };

function createDb(): MockDb {
  return new Map([["products", seedProducts()]]);
}

export function getDb(): MockDb {
  globalForMock.mockDb ??= createDb();
  return globalForMock.mockDb;
}

/** Unknown collections are created empty on first write, so users can point new resources at the mock API. */
export function getCollection(name: string): Collection {
  const db = getDb();
  let collection = db.get(name);
  if (!collection) {
    collection = { records: [], nextId: 1, required: [] };
    db.set(name, collection);
  }
  return collection;
}
