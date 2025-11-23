# Railway Public API - Complete Reference

**Official Documentation Ingested:** Railway GraphQL API v2

---

## 📋 Quick Facts

- **API Type:** GraphQL
- **Endpoint:** `https://backboard.railway.com/graphql/v2`
- **Authentication:** Bearer token (from https://railway.app/account/tokens)
- **Introspection:** ✅ Supported
- **OpenAPI/Swagger:** ❌ Not native (requires generation)
- **API Version:** v2 (current)

---

## 🔑 Authentication

### Getting Your Token

1. **Go to:** https://railway.app/account/tokens
2. **Click:** "Create Token"
3. **Name it:** e.g., "mahSpeccy Automation"
4. **Copy immediately** (shown only once!)
5. **Store securely** in `.env`

### Using the Token

**HTTP Headers:**
```http
POST https://backboard.railway.com/graphql/v2
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN_HERE
```

**In Code (Node.js):**
```javascript
const fetch = require('node-fetch');

const response = await fetch('https://backboard.railway.com/graphql/v2', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.RAILWAY_TOKEN}`,
  },
  body: JSON.stringify({
    query: '{ me { id name email } }',
  }),
});

const data = await response.json();
```

---

## 🔍 GraphQL Schema Introspection

### What is Introspection?

Introspection allows you to **query the GraphQL schema itself** to discover:
- Available queries and mutations
- Input parameters and types
- Return types
- Documentation strings
- Deprecation status

### Full Introspection Query

```graphql
query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
      ...FullType
    }
    directives {
      name
      description
      locations
      args {
        ...InputValue
      }
    }
  }
}

fragment FullType on __Type {
  kind
  name
  description
  fields(includeDeprecated: true) {
    name
    description
    args {
      ...InputValue
    }
    type {
      ...TypeRef
    }
    isDeprecated
    deprecationReason
  }
  inputFields {
    ...InputValue
  }
  interfaces {
    ...TypeRef
  }
  enumValues(includeDeprecated: true) {
    name
    description
    isDeprecated
    deprecationReason
  }
  possibleTypes {
    ...TypeRef
  }
}

fragment InputValue on __InputValue {
  name
  description
  type { ...TypeRef }
  defaultValue
}

fragment TypeRef on __Type {
  kind
  name
  ofType {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
      }
    }
  }
}
```

### Running Introspection

**Using curl:**
```bash
curl -X POST https://backboard.railway.com/graphql/v2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"query":"{ __schema { queryType { name } mutationType { name } } }"}'
```

**Using our railway-api.js:**
```javascript
const { RailwayAPI } = require('./railway-api.js');
const railway = new RailwayAPI(process.env.RAILWAY_TOKEN);

// Any query automatically uses introspection internally
const me = await railway.getMe();
```

---

## 🛠️ OpenAPI Generation

### Why Generate OpenAPI?

Railway's API is **GraphQL**, but many tools expect **OpenAPI/Swagger**:
- API documentation generators
- Client SDK generators
- Testing tools
- API gateways

**Solution:** Introspect the GraphQL schema and convert to OpenAPI 3.1

### OpenAPI Generator Repository Structure

```
railway-openapi-generator/
├── package.json
├── README.md
├── src/
│   ├── generate-openapi.js       # Main generator
│   └── introspection-query.js    # Schema query
└── openapi.generated.json         # Output (generated)
```

### Generator Code: `package.json`

```json
{
  "name": "railway-openapi-generator",
  "version": "1.0.0",
  "description": "Fetches Railway GraphQL schema and generates a full OpenAPI 3.1 JSON",
  "main": "src/generate-openapi.js",
  "scripts": {
    "generate": "node src/generate-openapi.js"
  },
  "keywords": ["graphql", "openapi", "railway", "introspection", "generator"],
  "author": "Generated for mahSpeccy",
  "license": "MIT",
  "dependencies": {
    "graphql": "^16.7.0",
    "node-fetch": "^2.6.12",
    "openapi3-ts": "^1.13.0",
    "prettier": "^2.8.8"
  }
}
```

### Generator Code: `src/introspection-query.js`

```javascript
// Canonical GraphQL introspection query
module.exports = `
query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
      ...FullType
    }
    directives {
      name
      description
      locations
      args {
        ...InputValue
      }
    }
  }
}

fragment FullType on __Type {
  kind
  name
  description
  fields(includeDeprecated: true) {
    name
    description
    args {
      ...InputValue
    }
    type {
      ...TypeRef
    }
    isDeprecated
    deprecationReason
  }
  inputFields {
    ...InputValue
  }
  interfaces {
    ...TypeRef
  }
  enumValues(includeDeprecated: true) {
    name
    description
    isDeprecated
    deprecationReason
  }
  possibleTypes {
    ...TypeRef
  }
}

fragment InputValue on __InputValue {
  name
  description
  type { ...TypeRef }
  defaultValue
}

fragment TypeRef on __Type {
  kind
  name
  ofType {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
      }
    }
  }
}
`;
```

### Generator Code: `src/generate-openapi.js`

```javascript
// Extended generator with full GraphQL -> OpenAPI component schema mapping
// Usage: RAILWAY_TOKEN=xxx node src/generate-openapi.js

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const {
  buildClientSchema,
  printSchema,
  isObjectType,
  isScalarType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
} = require('graphql');
const introspectionQuery = require('./introspection-query');
const prettier = require('prettier');

const ENDPOINT = process.env.RAILWAY_GRAPHQL_ENDPOINT || 'https://backboard.railway.com/graphql/v2';
const TOKEN = process.env.RAILWAY_TOKEN || process.env.RAILWAY_API_TOKEN || process.env.TOKEN;

if (!TOKEN) {
  console.error('\nERROR: Please set RAILWAY_TOKEN environment variable.');
  process.exit(1);
}

async function fetchIntrospection() {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ query: introspectionQuery }),
  });
  const json = await res.json();
  if (json.errors) {
    console.error('Introspection errors:', json.errors);
    process.exit(1);
  }
  return json.data;
}

// Convert GraphQL type to OpenAPI schema
function toSchema(type) {
  if (isNonNullType(type)) {
    const inner = toSchema(type.ofType);
    inner.nullable = false;
    return inner;
  }
  if (isListType(type)) {
    return {
      type: 'array',
      items: toSchema(type.ofType),
    };
  }
  if (isScalarType(type)) {
    const map = {
      ID: { type: 'string' },
      String: { type: 'string' },
      Boolean: { type: 'boolean' },
      Int: { type: 'integer' },
      Float: { type: 'number' },
    };
    return map[type.name] || { type: 'string' };
  }
  if (isEnumType(type)) {
    return {
      type: 'string',
      enum: type.getValues().map((v) => v.name),
    };
  }
  if (isObjectType(type) || isInputObjectType(type)) {
    return { $ref: `#/components/schemas/${type.name}` };
  }

  return { type: 'object' };
}

// Build all GraphQL types into OpenAPI components
function buildComponents(schema) {
  const types = schema.getTypeMap();
  const components = {};

  for (const name in types) {
    if (name.startsWith('__')) continue;
    const type = types[name];

    if (isObjectType(type)) {
      const fields = type.getFields();
      const props = {};
      const required = [];
      for (const f in fields) {
        const field = fields[f];
        const schemaField = toSchema(field.type);
        props[f] = schemaField;
        if (isNonNullType(field.type)) required.push(f);
      }
      components[name] = {
        type: 'object',
        properties: props,
        ...(required.length ? { required } : {}),
      };
    }

    if (isInputObjectType(type)) {
      const fields = type.getFields();
      const props = {};
      const required = [];
      for (const f in fields) {
        const field = fields[f];
        const schemaField = toSchema(field.type);
        props[f] = schemaField;
        if (isNonNullType(field.type)) required.push(f);
      }
      components[name] = {
        type: 'object',
        properties: props,
        ...(required.length ? { required } : {}),
      };
    }

    if (isEnumType(type)) {
      components[name] = {
        type: 'string',
        enum: type.getValues().map((v) => v.name),
      };
    }
  }
  return components;
}

function generateOpenAPI(introspection) {
  const schema = buildClientSchema(introspection);
  const raw = introspection.__schema;

  const openapi = {
    openapi: '3.1.0',
    info: {
      title: 'Railway Public API (Full OpenAPI with typed responses)',
      version: new Date().toISOString(),
      description: 'Auto-generated from GraphQL introspection. Each query/mutation is a POST operation.',
    },
    paths: {},
    components: {
      schemas: buildComponents(schema),
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Get token from https://railway.app/account/tokens',
        },
      },
    },
  };

  const queryTypeName = raw.queryType?.name;
  const mutationTypeName = raw.mutationType?.name;

  const typesByName = Object.fromEntries(raw.types.map((t) => [t.name, t]));

  function buildOperation(kind, field, parentType) {
    const graphQLType = schema.getType(parentType).getFields()[field.name].type;
    const responseSchema = toSchema(graphQLType);

    return {
      summary: field.description || `${kind} ${field.name}`,
      operationId: `${kind}_${field.name}`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'GraphQL query string' },
                operationName: { type: 'string', example: field.name },
                variables: { type: 'object', description: 'Query variables' },
              },
              required: ['query'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'GraphQL response',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  data: responseSchema,
                  errors: {
                    type: 'array',
                    items: { type: 'object' },
                  },
                },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    };
  }

  // Generate query endpoints
  if (queryTypeName && typesByName[queryTypeName]) {
    const q = typesByName[queryTypeName];
    (q.fields || []).forEach((f) => {
      const p = `/query/${f.name}`;
      openapi.paths[p] = { post: buildOperation('query', f, queryTypeName) };
    });
  }

  // Generate mutation endpoints
  if (mutationTypeName && typesByName[mutationTypeName]) {
    const m = typesByName[mutationTypeName];
    (m.fields || []).forEach((f) => {
      const p = `/mutation/${f.name}`;
      openapi.paths[p] = { post: buildOperation('mutation', f, mutationTypeName) };
    });
  }

  // Add generic /graphql endpoint
  openapi.paths['/graphql'] = {
    post: {
      summary: 'Execute any GraphQL query',
      operationId: 'graphql_execute',
      description: 'Generic endpoint for any GraphQL query or mutation',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                variables: { type: 'object' },
                operationName: { type: 'string' },
              },
              required: ['query'],
            },
          },
        },
      },
      responses: {
        200: {
          description: 'GraphQL response',
          content: {
            'application/json': {
              schema: { type: 'object' },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  };

  return openapi;
}

(async function main() {
  console.log('Fetching Railway schema from', ENDPOINT);
  const data = await fetchIntrospection();
  console.log('Generating typed OpenAPI...');

  const openapi = generateOpenAPI(data);
  const outFile = path.join(process.cwd(), 'openapi.generated.json');
  const formatted = prettier.format(JSON.stringify(openapi), { parser: 'json' });
  fs.writeFileSync(outFile, formatted);
  console.log('✅ OpenAPI file written to:', outFile);
  console.log(`📊 Generated ${Object.keys(openapi.paths).length} endpoints`);
  console.log(`📦 Generated ${Object.keys(openapi.components.schemas).length} schemas`);
})();
```

### Usage

```bash
# 1. Create directory
mkdir railway-openapi-generator
cd railway-openapi-generator

# 2. Create files (package.json, src/introspection-query.js, src/generate-openapi.js)

# 3. Install dependencies
npm install

# 4. Generate OpenAPI
RAILWAY_TOKEN=your_token npm run generate

# Output: openapi.generated.json
```

---

## 🔄 GitHub Actions CI/CD for SDK Generation

### Auto-Generate SDKs on Push

Create `.github/workflows/generate-sdks.yml`:

```yaml
name: Generate Railway SDKs
on:
  push:
    branches: [ main ]
    paths:
      - 'openapi.generated.json'
  workflow_dispatch:

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install OpenAPI Generator
        run: |
          npm install @openapitools/openapi-generator-cli -g
          pip install openapi-python-client
      
      - name: Generate TypeScript SDK
        run: |
          openapi-generator-cli generate \
            -i openapi.generated.json \
            -g typescript-fetch \
            -o sdk/typescript \
            --additional-properties=npmName=@mahspeccy/railway-client
      
      - name: Generate Python SDK
        run: |
          openapi-python-client generate \
            --path openapi.generated.json \
            --output-path sdk/python
      
      - name: Generate Go SDK
        run: |
          openapi-generator-cli generate \
            -i openapi.generated.json \
            -g go \
            -o sdk/go \
            --additional-properties=packageName=railway
      
      - name: Commit SDKs
        run: |
          git config user.name "github-actions"
          git config user.email "github-actions@github.com"
          git add sdk/
          git commit -m "🤖 Auto-generate Railway SDKs" || echo "No changes"
          git push
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 📚 Common Queries

### Get Current User

```graphql
query {
  me {
    id
    name
    email
    avatar
  }
}
```

**JavaScript:**
```javascript
const data = await railway.query(`
  query {
    me {
      id
      name
      email
    }
  }
`);
```

### List Projects

```graphql
query {
  projects {
    edges {
      node {
        id
        name
        description
        createdAt
      }
    }
  }
}
```

### Get Project Services

```graphql
query GetProject($projectId: String!) {
  project(id: $projectId) {
    id
    name
    services {
      edges {
        node {
          id
          name
          createdAt
        }
      }
    }
  }
}
```

### Create Project

```graphql
mutation CreateProject($name: String!, $description: String) {
  projectCreate(input: {
    name: $name
    description: $description
  }) {
    id
    name
  }
}
```

### Deploy from GitHub

```graphql
mutation DeployService($projectId: String!, $repo: String!, $branch: String) {
  serviceCreate(input: {
    projectId: $projectId
    source: {
      repo: $repo
      branch: $branch
    }
  }) {
    id
    name
  }
}
```

### Get Deployment Logs

```graphql
query GetLogs($deploymentId: String!, $limit: Int) {
  deploymentLogs(deploymentId: $deploymentId, limit: $limit) {
    timestamp
    message
    severity
  }
}
```

---

## 🎯 Best Practices

### 1. **Always Use Variables**

❌ **Bad:**
```javascript
const query = `query { project(id: "${projectId}") { name } }`;
```

✅ **Good:**
```javascript
const query = `query GetProject($id: String!) { project(id: $id) { name } }`;
const variables = { id: projectId };
```

### 2. **Request Only Needed Fields**

❌ **Bad:**
```graphql
query {
  projects {
    edges {
      node {
        id
        name
        description
        createdAt
        updatedAt
        services { ... }
        environments { ... }
        # ... everything
      }
    }
  }
}
```

✅ **Good:**
```graphql
query {
  projects {
    edges {
      node {
        id
        name
      }
    }
  }
}
```

### 3. **Handle Errors Properly**

```javascript
const response = await fetch(endpoint, {
  method: 'POST',
  headers: { /* ... */ },
  body: JSON.stringify({ query, variables }),
});

const { data, errors } = await response.json();

if (errors) {
  console.error('GraphQL Errors:', errors);
  throw new Error(errors[0].message);
}

if (!data) {
  throw new Error('No data returned from API');
}

return data;
```

### 4. **Use Pagination**

```graphql
query GetProjects($first: Int, $after: String) {
  projects(first: $first, after: $after) {
    edges {
      node {
        id
        name
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### 5. **Cache Introspection Results**

Don't introspect on every request:

```javascript
// Cache schema for 24 hours
const CACHE_TTL = 24 * 60 * 60 * 1000;
let cachedSchema = null;
let cacheTime = 0;

async function getSchema() {
  if (cachedSchema && Date.now() - cacheTime < CACHE_TTL) {
    return cachedSchema;
  }
  
  cachedSchema = await fetchIntrospection();
  cacheTime = Date.now();
  return cachedSchema;
}
```

---

## 🔗 Related Resources

### Official Links
- **Railway Dashboard:** https://railway.app
- **API Tokens:** https://railway.app/account/tokens
- **Status Page:** https://railway.statuspage.io/
- **Documentation:** https://docs.railway.app

### Tools
- **GraphQL Playground:** https://studio.apollographql.com/sandbox
- **OpenAPI Generator:** https://openapi-generator.tech
- **GraphQL Inspector:** https://graphql-inspector.com

### mahSpeccy Integration
- **Railway API Client:** `/websocket-server/railway-api.js`
- **Deployment Script:** `/websocket-server/deploy-railway.js`
- **Health Monitor:** `/websocket-server/monitor-health.js`
- **Automation Guide:** `/websocket-server/AUTOMATION.md`

---

## 📝 Notes

1. **Rate Limiting:** Railway API has rate limits (exact numbers not documented)
2. **Token Security:** Never commit tokens to Git
3. **Schema Changes:** Railway may update their schema; regenerate OpenAPI periodically
4. **GraphQL vs REST:** GraphQL is more efficient (request only what you need)
5. **Subscriptions:** Not supported in public API (queries and mutations only)

---

**Last Updated:** 2025-11-23  
**API Version:** v2  
**Documentation Source:** Railway Public API + OpenAPI Generator Reference
