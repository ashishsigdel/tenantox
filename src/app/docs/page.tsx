import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "API Contract" };

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-4 text-sm leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-10 text-xl font-semibold">{children}</h2>;
}

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2">
        <Link href="/dashboard">
          <ArrowLeft className="size-4" /> Back to dashboard
        </Link>
      </Button>

      <h1 className="text-3xl font-semibold">External API Contract</h1>
      <p className="mt-3 text-muted-foreground">
        The dashboard manages data living in <em>your</em> backend. Any API
        that implements the endpoints and response envelope below can be
        plugged in as a connection — no dashboard code changes needed.
      </p>

      <H2>1. Endpoints</H2>
      <p className="mt-2 text-sm text-muted-foreground">
        Paths are configurable per resource; these are the recommended
        defaults. <code>{"{id}"}</code> is replaced with the record id.
      </p>
      <Code>{`GET    {baseUrl}/{resource}            list
GET    {baseUrl}/{resource}/{id}       get one
POST   {baseUrl}/{resource}            create
PUT    {baseUrl}/{resource}/{id}       update (PATCH also supported)
DELETE {baseUrl}/{resource}/{id}       delete`}</Code>

      <H2>2. List query parameters</H2>
      <p className="mt-2 text-sm text-muted-foreground">
        The dashboard sends these on every list request:
      </p>
      <Code>{`?page=1                      1-based page number
&pageSize=10                 rows per page (max 100)
&sort=-createdAt             field name, "-" prefix = descending
&search=keyword              free-text search (you pick the fields)
&filter[status]=active       equality filter, repeatable
&filter[price][gte]=100      operator filter: gte, lte, gt, lt, ne, like, in`}</Code>

      <H2>3. Response envelope — success</H2>
      <Code>{`{
  "success": true,
  "data": { ... } | [ ... ],
  "meta": { "page": 1, "pageSize": 10, "total": 142, "totalPages": 15 }
}`}</Code>
      <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-muted-foreground">
        <li><code>meta</code> is required for list responses, omitted elsewhere.</li>
        <li><code>data</code> is an array for list, an object for getOne / create / update, and <code>null</code> for delete.</li>
        <li>Create should return HTTP 201; everything else 200.</li>
      </ul>

      <H2>4. Response envelope — error</H2>
      <Code>{`{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "fields": {
      "email": "Email is already taken",
      "price": "Must be positive"
    }
  }
}`}</Code>
      <p className="mt-3 text-sm text-muted-foreground">
        When <code>fields</code> is present on create/update errors, the
        dashboard shows each message inline on the matching form input.
      </p>

      <div className="mt-4 rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>HTTP status</TableHead>
              <TableHead>Meaning</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              ["VALIDATION_ERROR", "422", "Bad input; include fields when possible"],
              ["NOT_FOUND", "404", "Record or collection doesn't exist"],
              ["UNAUTHORIZED", "401", "Missing/invalid credentials"],
              ["FORBIDDEN", "403", "Authenticated but not allowed"],
              ["INTERNAL_ERROR", "500", "Anything unexpected"],
            ].map(([code, status, meaning]) => (
              <TableRow key={code}>
                <TableCell>
                  <Badge variant="secondary" className="font-mono">
                    {code}
                  </Badge>
                </TableCell>
                <TableCell>{status}</TableCell>
                <TableCell className="text-muted-foreground">
                  {meaning}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <H2>5. Authentication</H2>
      <p className="mt-2 text-sm text-muted-foreground">
        Configure auth per connection in Settings → Connections. The dashboard
        attaches credentials server-side (they never reach the browser):
      </p>
      <Code>{`Bearer token     Authorization: Bearer <token>
API key header   <header-name>: <key>      (e.g. x-api-key)
Basic auth       Authorization: Basic base64(user:pass)`}</Code>

      <H2>6. Reference implementation (Express)</H2>
      <Code>{`const app = require("express")();
app.use(require("express").json());

const db = []; // your data source

app.get("/products", (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Number(req.query.pageSize) || 10);
  let rows = [...db];

  // search / filter / sort left to your data layer …
  if (req.query.sort) {
    const desc = req.query.sort.startsWith("-");
    const f = desc ? req.query.sort.slice(1) : req.query.sort;
    rows.sort((a, b) => (a[f] > b[f] ? 1 : -1) * (desc ? -1 : 1));
  }

  const total = rows.length;
  res.json({
    success: true,
    data: rows.slice((page - 1) * pageSize, page * pageSize),
    meta: { page, pageSize, total,
            totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
});

app.post("/products", (req, res) => {
  if (!req.body.name) {
    return res.status(422).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Validation failed",
               fields: { name: "name is required" } },
    });
  }
  const record = { id: String(db.length + 1), ...req.body };
  db.push(record);
  res.status(201).json({ success: true, data: record });
});

app.listen(4000);`}</Code>

      <H2>7. Try it with the bundled mock API</H2>
      <p className="mt-2 text-sm text-muted-foreground">
        This dashboard ships with a reference backend at{" "}
        <code>/api/mock/{"{resource}"}</code> that implements the full
        contract (in-memory, resets on restart). The seeded “Products”
        resource points at it — use it to explore before wiring your own API.
      </p>
    </div>
  );
}
