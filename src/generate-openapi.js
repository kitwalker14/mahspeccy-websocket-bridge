// Extended generator with full GraphQL -> OpenAPI component schema mapping
// Usage: RAILWAY_TOKEN=xxx node src/generate-openapi.js

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const {
  buildClientSchema,
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
  console.error('\nERROR: Please set RAILWAY_TOKEN (or RAILWAY_API_TOKEN) environment variable.');
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
    },
    paths: {},
    components: { 
      schemas: buildComponents(schema), 
      securitySchemes: { 
        bearerAuth: { 
          type: 'http', 
          scheme: 'bearer' 
        } 
      } 
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
                query: { type: 'string' },
                operationName: { type: 'string', example: field.name },
                variables: { type: 'object' },
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
                },
              },
            },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    };
  }

  if (queryTypeName && typesByName[queryTypeName]) {
    const q = typesByName[queryTypeName];
    (q.fields || []).forEach((f) => {
      const p = `/query/${f.name}`;
      openapi.paths[p] = { post: buildOperation('query', f, queryTypeName) };
    });
  }

  if (mutationTypeName && typesByName[mutationTypeName]) {
    const m = typesByName[mutationTypeName];
    (m.fields || []).forEach((f) => {
      const p = `/mutation/${f.name}`;
      openapi.paths[p] = { post: buildOperation('mutation', f, mutationTypeName) };
    });
  }

  openapi.paths['/graphql'] = {
    post: {
      summary: 'Execute any GraphQL query',
      operationId: 'graphql_execute',
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
  console.log('Fetching Railway schema...');
  const data = await fetchIntrospection();
  console.log('Generating typed OpenAPI...');

  const openapi = generateOpenAPI(data);
  const outFile = path.join(process.cwd(), 'openapi.generated.json');
  const formatted = prettier.format(JSON.stringify(openapi), { parser: 'json' });
  fs.writeFileSync(outFile, formatted);
  console.log('Done. File written:', outFile);
})();
