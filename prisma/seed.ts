import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // --- Super admin from env ---
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin1234";
  const name = process.env.SEED_ADMIN_NAME ?? "Super Admin";

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  console.log(`✔ User: ${admin.email}`);

  // --- Demo workspace + owner membership ---
  const workspace = await prisma.workspace.upsert({
    where: { slug: "demo" },
    update: {},
    create: { name: "Demo Workspace", slug: "demo" },
  });
  await prisma.membership.upsert({
    where: {
      userId_workspaceId: { userId: admin.id, workspaceId: workspace.id },
    },
    update: { role: "SUPER_ADMIN" },
    create: { userId: admin.id, workspaceId: workspace.id, role: "SUPER_ADMIN" },
  });
  console.log(`✔ Workspace: ${workspace.name} (owner ${admin.email})`);

  // --- Demo connection → bundled mock API ---
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  let connection = await prisma.apiConnection.findFirst({
    where: { workspaceId: workspace.id, name: "Demo Mock API" },
  });
  if (!connection) {
    connection = await prisma.apiConnection.create({
      data: {
        workspaceId: workspace.id,
        name: "Demo Mock API",
        baseUrl: `${appUrl}/api/mock`,
        authType: "NONE",
      },
    });
  }
  console.log(`✔ Connection: ${connection.name} → ${connection.baseUrl}`);

  // --- Demo "Products" resource ---
  const existing = await prisma.resource.findUnique({
    where: { workspaceId_slug: { workspaceId: workspace.id, slug: "products" } },
  });
  if (existing) {
    console.log("✔ Products resource already seeded");
    return;
  }

  const products = await prisma.resource.create({
    data: {
      workspaceId: workspace.id,
      name: "Products",
      slug: "products",
      icon: "package",
      apiConnectionId: connection.id,
      endpoints: {
        list: { method: "GET", path: "/products" },
        getOne: { method: "GET", path: "/products/{id}" },
        create: { method: "POST", path: "/products" },
        update: { method: "PUT", path: "/products/{id}" },
        delete: { method: "DELETE", path: "/products/{id}" },
      },
      primaryKeyField: "id",
      titleField: "name",
      capabilities: { view: true, create: true, update: true, delete: true },
      permissions: {
        view: "VIEWER",
        create: "EDITOR",
        update: "EDITOR",
        delete: "ADMIN",
      },
      fields: {
        create: [
          {
            key: "name",
            label: "Name",
            type: "TEXT",
            order: 0,
            tableOrder: 0,
            validation: { required: true, minLength: 2, maxLength: 120 },
            placeholder: "Product name",
            sortable: true,
            format: "text",
          },
          {
            key: "description",
            label: "Description",
            type: "TEXTAREA",
            order: 1,
            tableOrder: 5,
            config: { rows: 4 },
            placeholder: "Short description…",
            format: "truncate",
          },
          {
            key: "price",
            label: "Price",
            type: "NUMBER",
            order: 2,
            tableOrder: 1,
            width: "half",
            config: { min: 0, step: 0.01 },
            validation: { required: true, min: 0 },
            sortable: true,
            filterable: true,
            format: "currency",
          },
          {
            key: "stock",
            label: "Stock",
            type: "NUMBER",
            order: 3,
            tableOrder: 2,
            width: "half",
            config: { min: 0, step: 1 },
            validation: { required: true, min: 0 },
            sortable: true,
            format: "text",
          },
          {
            key: "status",
            label: "Status",
            type: "SELECT",
            order: 4,
            tableOrder: 3,
            width: "half",
            config: {
              options: [
                { label: "Active", value: "active" },
                { label: "Draft", value: "draft" },
                { label: "Archived", value: "archived" },
              ],
            },
            validation: { required: true },
            defaultValue: "draft",
            filterable: true,
            format: "badge",
            badgeColorMap: {
              active: "green",
              draft: "yellow",
              archived: "gray",
            },
          },
          {
            key: "category",
            label: "Category",
            type: "SELECT",
            order: 5,
            tableOrder: 4,
            width: "half",
            config: {
              options: [
                { label: "Electronics", value: "electronics" },
                { label: "Clothing", value: "clothing" },
                { label: "Books", value: "books" },
                { label: "Home & Garden", value: "home" },
              ],
            },
            filterable: true,
            format: "text",
          },
          {
            key: "featured",
            label: "Featured",
            type: "BOOLEAN",
            order: 6,
            tableOrder: 6,
            defaultValue: "false",
            format: "boolean-icon",
          },
          {
            key: "discountPercent",
            label: "Discount %",
            type: "NUMBER",
            order: 7,
            width: "half",
            config: { min: 0, max: 90, step: 1 },
            helpText: "Only shown when the product is featured.",
            visibleIf: { field: "featured", operator: "truthy" },
            showInTable: false,
          },
          {
            key: "imageUrl",
            label: "Image URL",
            type: "URL",
            order: 8,
            tableOrder: 7,
            placeholder: "https://…",
            format: "image-thumb",
          },
          {
            key: "createdAt",
            label: "Created",
            type: "DATETIME",
            order: 9,
            tableOrder: 8,
            showInForm: false,
            readOnly: true,
            sortable: true,
            format: "datetime",
          },
        ],
      },
    },
  });
  console.log(`✔ Resource: ${products.name}`);

  // --- Menu ---
  await prisma.menuItem.create({
    data: {
      workspaceId: workspace.id,
      label: "Overview",
      icon: "layout-dashboard",
      type: "LINK",
      href: "/dashboard",
      order: 0,
    },
  });
  const group = await prisma.menuItem.create({
    data: { workspaceId: workspace.id, label: "Catalog", type: "GROUP", order: 1 },
  });
  await prisma.menuItem.create({
    data: {
      workspaceId: workspace.id,
      label: "Products",
      icon: "package",
      type: "RESOURCE",
      resourceId: products.id,
      parentId: group.id,
      order: 0,
    },
  });
  console.log("✔ Menu items");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
