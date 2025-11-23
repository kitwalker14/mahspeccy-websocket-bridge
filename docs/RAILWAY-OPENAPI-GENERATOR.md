# Railway OpenAPI Generator

Complete guide to generating OpenAPI 3.1 specifications from Railway's GraphQL API.

---

## 🎯 Purpose

Railway's API is **GraphQL**, but many tools need **OpenAPI/Swagger**:
- API documentation generators (Swagger UI, Redoc)
- Client SDK generators (TypeScript, Python, Go, etc.)
- Testing tools (Postman, Insomnia)
- API gateways and proxies

**Solution:** Introspect Railway's GraphQL schema and convert to OpenAPI 3.1

---

## 📦 Generator Repository Setup

### Directory Structure

```
railway-openapi-generator/
├── package.json
├── README.md
├── .gitignore
├── .env.example
├── src/
│   ├── generate-openapi.js       # Main generator
│   ├── introspection-query.js    # GraphQL introspection
│   └── type-mapper.js            # GraphQL → OpenAPI type mapping
├── examples/
│   └── openapi.example.json      # Sample output
└── openapi.generated.json        # Generated file (gitignored)
```

### package.json

```json
{
  "name": "railway-openapi-generator",
  "version": "1.0.0",
  "description": "Generate full OpenAPI 3.1 spec from Railway GraphQL API",
  "type": "module",
  "main": "src/generate-openapi.js",
  "scripts": {
    "generate": "node src/generate-openapi.js",
    "generate:watch": "nodemon src/generate-openapi.js",
    "validate": "swagger-cli validate openapi.generated.json",
    "docs": "redoc-cli bundle openapi.generated.json -o docs/index.html",
    "serve": "swagger-ui-express openapi.generated.json"
  },
  "keywords": [
    "railway",
    "graphql",
    "openapi",
    "swagger",
    "api",
    "generator"
  ],
  "author": "mahSpeccy",
  "license": "MIT",
  "dependencies": {
    "graphql": "^16.8.1",
    "node-fetch": "^3.3.2",
    "prettier": "^3.1.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2",
    "@apidevtools/swagger-cli": "^4.0.4",
    "redoc-cli": "^0.13.21",
    "swagger-ui-express": "^5.0.0"
  }
}
```

### .env.example

```env
# Railway API Token
# Get from: https://railway.app/account/tokens
RAILWAY_TOKEN=your_token_here

# Optional: Custom endpoint (defaults to Railway's public API)
RAILWAY_GRAPHQL_ENDPOINT=https://backboard.railway.com/graphql/v2

# Output options
OUTPUT_FILE=openapi.generated.json
PRETTIFY=true
INCLUDE_DEPRECATED=false
```

### .gitignore

```
node_modules/
openapi.generated.json
.env
*.log
sdk/
```

---

## 📝 Source Code

### src/introspection-query.js

Complete GraphQL introspection query:

```javascript
/**
 * GraphQL Introspection Query
 * Fetches complete schema including types, fields, arguments, and descriptions
 */

export const introspectionQuery = `
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
        ofType {
          kind
          name
        }
      }
    }
  }
}
`;
```

### src/type-mapper.js

Type conversion utilities:

```javascript
/**
 * Type Mapper: GraphQL → OpenAPI
 * Converts GraphQL types to OpenAPI 3.1 schemas
 */

import {
  isNonNullType,
  isListType,
  isScalarType,
  isEnumType,
  isObjectType,
  isInputObjectType,
} from 'graphql';

// Scalar type mappings
const SCALAR_TYPE_MAP = {
  ID: { type: 'string', format: 'uuid' },
  String: { type: 'string' },
  Boolean: { type: 'boolean' },
  Int: { type: 'integer', format: 'int32' },
  Float: { type: 'number', format: 'float' },
  DateTime: { type: 'string', format: 'date-time' },
  Date: { type: 'string', format: 'date' },
  Time: { type: 'string', format: 'time' },
  JSON: { type: 'object' },
};

/**
 * Convert GraphQL type to OpenAPI schema
 */
export function toOpenAPISchema(type) {
  if (isNonNullType(type)) {
    const inner = toOpenAPISchema(type.ofType);
    inner.nullable = false;
    return inner;
  }

  if (isListType(type)) {
    return {
      type: 'array',
      items: toOpenAPISchema(type.ofType),
    };
  }

  if (isScalarType(type)) {
    return SCALAR_TYPE_MAP[type.name] || { type: 'string' };
  }

  if (isEnumType(type)) {
    return {
      type: 'string',
      enum: type.getValues().map(v => v.name),
      description: type.description,
    };
  }

  if (isObjectType(type) || isInputObjectType(type)) {
    return {
      $ref: `#/components/schemas/${type.name}`,
    };
  }

  return { type: 'object' };
}

/**
 * Build component schemas from GraphQL types
 */
export function buildComponentSchemas(schema) {
  const types = schema.getTypeMap();
  const components = {};

  for (const name in types) {
    // Skip internal GraphQL types
    if (name.startsWith('__')) continue;

    const type = types[name];

    if (isObjectType(type)) {
      components[name] = buildObjectSchema(type);
    }

    if (isInputObjectType(type)) {
      components[name] = buildInputObjectSchema(type);
    }

    if (isEnumType(type)) {
      components[name] = buildEnumSchema(type);
    }
  }

  return components;
}

function buildObjectSchema(type) {
  const fields = type.getFields();
  const properties = {};
  const required = [];

  for (const fieldName in fields) {
    const field = fields[fieldName];
    properties[fieldName] = toOpenAPISchema(field.type);

    if (field.description) {
      properties[fieldName].description = field.description;
    }

    if (isNonNullType(field.type)) {
      required.push(fieldName);
    }
  }

  return {
    type: 'object',
    description: type.description,
    properties,
    ...(required.length > 0 && { required }),
  };
}

function buildInputObjectSchema(type) {
  const fields = type.getFields();
  const properties = {};
  const required = [];

  for (const fieldName in fields) {
    const field = fields[fieldName];
    properties[fieldName] = toOpenAPISchema(field.type);

    if (field.description) {
      properties[fieldName].description = field.description;
    }

    if (isNonNullType(field.type)) {
      required.push(fieldName);
    }
  }

  return {
    type: 'object',
    description: type.description,
    properties,
    ...(required.length > 0 && { required }),
  };
}

function buildEnumSchema(type) {
  return {
    type: 'string',
    description: type.description,
    enum: type.getValues().map(v => v.name),
  };
}
```

### src/generate-openapi.js

Main generator:

```javascript
/**
 * Railway OpenAPI Generator
 * Generates OpenAPI 3.1 spec from Railway GraphQL API
 * 
 * Usage: RAILWAY_TOKEN=xxx npm run generate
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { buildClientSchema } from 'graphql';
import prettier from 'prettier';
import { introspectionQuery } from './introspection-query.js';
import { toOpenAPISchema, buildComponentSchemas } from './type-mapper.js';

// Configuration
const ENDPOINT = process.env.RAILWAY_GRAPHQL_ENDPOINT || 'https://backboard.railway.com/graphql/v2';
const TOKEN = process.env.RAILWAY_TOKEN;
const OUTPUT_FILE = process.env.OUTPUT_FILE || 'openapi.generated.json';
const PRETTIFY = process.env.PRETTIFY !== 'false';

// Validation
if (!TOKEN) {
  console.error('❌ ERROR: RAILWAY_TOKEN environment variable is required');
  console.error('   Get token from: https://railway.app/account/tokens');
  process.exit(1);
}

/**
 * Fetch GraphQL schema via introspection
 */
async function fetchSchema() {
  console.log('🔍 Fetching Railway GraphQL schema...');

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ query: introspectionQuery }),
  });

  const result = await response.json();

  if (result.errors) {
    console.error('❌ GraphQL errors:', result.errors);
    throw new Error('Introspection failed');
  }

  console.log('✅ Schema fetched successfully');
  return result.data;
}

/**
 * Build OpenAPI operation for a GraphQL field
 */
function buildOperation(kind, field, schema, parentTypeName) {
  const parentType = schema.getType(parentTypeName);
  const graphQLField = parentType.getFields()[field.name];
  const returnType = graphQLField.type;

  // Build operation
  return {
    summary: field.description || `${kind} operation: ${field.name}`,
    operationId: `${kind}_${field.name}`,
    tags: [kind],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'GraphQL query string',
                example: `${kind} ${field.name} { ... }`,
              },
              variables: {
                type: 'object',
                description: 'Query variables',
              },
              operationName: {
                type: 'string',
                example: field.name,
              },
            },
            required: ['query'],
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Successful GraphQL response',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                data: toOpenAPISchema(returnType),
                errors: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      message: { type: 'string' },
                      locations: { type: 'array' },
                      path: { type: 'array' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      400: {
        description: 'Bad Request - Invalid GraphQL query',
      },
      401: {
        description: 'Unauthorized - Invalid or missing token',
      },
      500: {
        description: 'Internal Server Error',
      },
    },
    security: [{ bearerAuth: [] }],
  };
}

/**
 * Generate complete OpenAPI specification
 */
function generateOpenAPI(introspectionData) {
  console.log('🔨 Generating OpenAPI specification...');

  const schema = buildClientSchema(introspectionData);
  const rawSchema = introspectionData.__schema;

  // Initialize OpenAPI document
  const openapi = {
    openapi: '3.1.0',
    info: {
      title: 'Railway Public API',
      version: new Date().toISOString(),
      description: `
Auto-generated OpenAPI 3.1 specification for Railway's GraphQL API.

## Authentication
Get your API token from: https://railway.app/account/tokens

Include it in the Authorization header:
\`\`\`
Authorization: Bearer YOUR_TOKEN
\`\`\`

## GraphQL Endpoint
All operations POST to: ${ENDPOINT}

## Usage
Each path represents a GraphQL query or mutation as a REST-like endpoint.
You can also use the generic \`/graphql\` endpoint for any query.
      `.trim(),
      contact: {
        name: 'Railway Support',
        url: 'https://railway.app/help',
      },
    },
    servers: [
      {
        url: ENDPOINT,
        description: 'Railway GraphQL API',
      },
    ],
    paths: {},
    components: {
      schemas: buildComponentSchemas(schema),
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'Railway API Token',
          description: 'Get token from https://railway.app/account/tokens',
        },
      },
    },
    tags: [
      { name: 'query', description: 'GraphQL Queries' },
      { name: 'mutation', description: 'GraphQL Mutations' },
    ],
  };

  // Get type names
  const queryTypeName = rawSchema.queryType?.name;
  const mutationTypeName = rawSchema.mutationType?.name;

  // Build type map
  const typesByName = {};
  rawSchema.types.forEach(type => {
    typesByName[type.name] = type;
  });

  // Generate query endpoints
  if (queryTypeName && typesByName[queryTypeName]) {
    const queryType = typesByName[queryTypeName];
    (queryType.fields || []).forEach(field => {
      const path = `/query/${field.name}`;
      openapi.paths[path] = {
        post: buildOperation('query', field, schema, queryTypeName),
      };
    });
  }

  // Generate mutation endpoints
  if (mutationTypeName && typesByName[mutationTypeName]) {
    const mutationType = typesByName[mutationTypeName];
    (mutationType.fields || []).forEach(field => {
      const path = `/mutation/${field.name}`;
      openapi.paths[path] = {
        post: buildOperation('mutation', field, schema, mutationTypeName),
      };
    });
  }

  // Add generic /graphql endpoint
  openapi.paths['/graphql'] = {
    post: {
      summary: 'Execute any GraphQL query or mutation',
      description: 'Generic endpoint for executing arbitrary GraphQL operations',
      operationId: 'graphql_execute',
      tags: ['query', 'mutation'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'GraphQL query or mutation' },
                variables: { type: 'object', description: 'Variables for the query' },
                operationName: { type: 'string', description: 'Name of operation to execute' },
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

  console.log(`✅ Generated ${Object.keys(openapi.paths).length} endpoints`);
  console.log(`✅ Generated ${Object.keys(openapi.components.schemas).length} schemas`);

  return openapi;
}

/**
 * Write OpenAPI to file
 */
async function writeOutput(openapi) {
  console.log(`📝 Writing to ${OUTPUT_FILE}...`);

  let output = JSON.stringify(openapi);

  if (PRETTIFY) {
    output = await prettier.format(output, { parser: 'json' });
  }

  fs.writeFileSync(OUTPUT_FILE, output);

  const stats = fs.statSync(OUTPUT_FILE);
  console.log(`✅ File written: ${(stats.size / 1024).toFixed(2)} KB`);
}

/**
 * Main execution
 */
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Railway OpenAPI Generator                               ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    const introspectionData = await fetchSchema();
    const openapi = generateOpenAPI(introspectionData);
    await writeOutput(openapi);

    console.log('\n✅ OpenAPI generation complete!');
    console.log(`\n📖 Next steps:`);
    console.log(`   1. View docs: npx swagger-ui-express ${OUTPUT_FILE}`);
    console.log(`   2. Validate: npm run validate`);
    console.log(`   3. Generate SDK: openapi-generator-cli generate -i ${OUTPUT_FILE}`);
  } catch (error) {
    console.error('\n❌ Generation failed:', error.message);
    process.exit(1);
  }
}

// Run generator
main();
```

---

## 🚀 Usage

### Basic Generation

```bash
# 1. Install dependencies
npm install

# 2. Set Railway token
export RAILWAY_TOKEN=your_token_here

# 3. Generate OpenAPI
npm run generate

# Output: openapi.generated.json
```

### With Environment File

```bash
# Create .env
echo "RAILWAY_TOKEN=your_token" > .env

# Generate
npm run generate
```

### Watch Mode

```bash
# Regenerate on file changes
npm run generate:watch
```

---

## 📊 Generated Output

The generator creates a complete OpenAPI 3.1 specification:

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "Railway Public API",
    "version": "2025-11-23T12:00:00.000Z",
    "description": "..."
  },
  "servers": [
    {
      "url": "https://backboard.railway.com/graphql/v2"
    }
  ],
  "paths": {
    "/query/me": {
      "post": {
        "operationId": "query_me",
        "summary": "Get current user",
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/User"
                }
              }
            }
          }
        }
      }
    },
    "/query/projects": { "..." },
    "/mutation/projectCreate": { "..." }
  },
  "components": {
    "schemas": {
      "User": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "name": { "type": "string" },
          "email": { "type": "string" }
        }
      }
    },
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer"
      }
    }
  }
}
```

---

## 🛠️ SDK Generation

### TypeScript SDK

```bash
npm install @openapitools/openapi-generator-cli -g

openapi-generator-cli generate \
  -i openapi.generated.json \
  -g typescript-fetch \
  -o sdk/typescript \
  --additional-properties=npmName=@mahspeccy/railway-client
```

### Python SDK

```bash
pip install openapi-python-client

openapi-python-client generate \
  --path openapi.generated.json \
  --output-path sdk/python
```

### Go SDK

```bash
openapi-generator-cli generate \
  -i openapi.generated.json \
  -g go \
  -o sdk/go \
  --additional-properties=packageName=railway
```

---

## 📚 Documentation Generation

### Swagger UI

```bash
npx swagger-ui-watcher openapi.generated.json
# Opens http://localhost:8080
```

### Redoc

```bash
npx redoc-cli bundle openapi.generated.json -o docs/index.html
# Creates static HTML docs
```

---

## 🔗 Integration with mahSpeccy

Add to your existing automation:

```javascript
// In deploy-railway.js or similar
import { generateOpenAPI } from './railway-openapi-generator/src/generate-openapi.js';

// Regenerate OpenAPI before deployment
await generateOpenAPI();
console.log('✅ OpenAPI spec regenerated');
```

---

## 📝 Related Documentation

- **Railway API Reference:** `RAILWAY-API-REFERENCE.md`
- **Integration Guide:** `RAILWAY-INTEGRATION-GUIDE.md`
- **Main Automation:** `/websocket-server/AUTOMATION.md`

---

**OpenAPI generation ready! Generate your spec anytime with `npm run generate`** 🎉
