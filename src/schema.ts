/**
 * schema.ts — the validator the repository ships, so the schema is load-bearing
 * rather than a document that drifts from the data.
 *
 * It implements the subset of JSON Schema the palette's own schema uses and it
 * refuses any keyword outside that subset: a schema that quietly relies on a
 * keyword nobody implements would read as enforced while checking nothing. The
 * supported keywords are `$ref` (within this document), `type`, `required`,
 * `properties`, `additionalProperties`, `pattern`, `const`, `enum`, `minLength`,
 * `minimum`, `maximum`, `oneOf` and `items`, plus the annotations `title`,
 * `description` and `$schema`.
 *
 * It is deliberately not a general-purpose validator: no dependency, no
 * remote references, no `allOf`, no `format`.
 */

export type SchemaError = { path: string; message: string }

const SUPPORTED = new Set([
  "$ref",
  "type",
  "required",
  "properties",
  "additionalProperties",
  "pattern",
  "const",
  "enum",
  "minLength",
  "minimum",
  "maximum",
  "oneOf",
  "items",
  "title",
  "description",
  "$schema",
  "$defs",
])

type SchemaNode = Record<string, unknown>

function isObject(value: unknown): value is SchemaNode {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function describeType(value: unknown): string {
  if (value === null) return "null"
  if (Array.isArray(value)) return "array"
  return typeof value
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function resolveRef(reference: string, root: SchemaNode): SchemaNode {
  if (!reference.startsWith("#/")) throw new Error(`only a reference within this document is supported: ${reference}`)
  let node: unknown = root
  for (const segment of reference.slice(2).split("/")) {
    if (!isObject(node) || !(segment in node)) throw new Error(`unresolvable reference: ${reference}`)
    node = node[segment]
  }
  if (!isObject(node)) throw new Error(`reference does not name a schema: ${reference}`)
  return node
}

function check(schemaValue: unknown, data: unknown, path: string, root: SchemaNode, errors: SchemaError[]): void {
  if (!isObject(schemaValue)) {
    errors.push({ path, message: "schema node is not an object" })
    return
  }

  if (typeof schemaValue.$ref === "string") {
    check(resolveRef(schemaValue.$ref, root), data, path, root, errors)
    return
  }

  for (const keyword of Object.keys(schemaValue)) {
    if (!SUPPORTED.has(keyword)) errors.push({ path, message: `unsupported schema keyword: ${keyword}` })
  }

  if (Array.isArray(schemaValue.oneOf)) {
    const passing = schemaValue.oneOf.filter((branch) => {
      const branchErrors: SchemaError[] = []
      check(branch, data, path, root, branchErrors)
      return branchErrors.length === 0
    })
    if (passing.length !== 1) errors.push({ path, message: `must match exactly one of the ${schemaValue.oneOf.length} allowed shapes` })
    return
  }

  if ("const" in schemaValue && !sameValue(schemaValue.const, data)) {
    errors.push({ path, message: `must be ${JSON.stringify(schemaValue.const)}, found ${JSON.stringify(data)}` })
  }

  if (Array.isArray(schemaValue.enum) && !schemaValue.enum.some((allowed) => sameValue(allowed, data))) {
    errors.push({ path, message: `must be one of ${JSON.stringify(schemaValue.enum)}` })
  }

  if (typeof schemaValue.type === "string") {
    const wanted = schemaValue.type
    const matches =
      wanted === "integer"
        ? typeof data === "number" && Number.isInteger(data)
        : wanted === "number"
          ? typeof data === "number" && Number.isFinite(data)
          : wanted === "array"
            ? Array.isArray(data)
            : wanted === "object"
              ? isObject(data)
              : describeType(data) === wanted
    if (!matches) {
      errors.push({ path, message: `must be ${wanted}, found ${describeType(data)}` })
      return
    }
  }

  if (typeof schemaValue.minLength === "number" && typeof data === "string" && data.length < schemaValue.minLength) {
    errors.push({ path, message: `must be at least ${schemaValue.minLength} characters` })
  }

  if (typeof schemaValue.minimum === "number" && typeof data === "number" && data < schemaValue.minimum) {
    errors.push({ path, message: `must be at least ${schemaValue.minimum}` })
  }

  if (typeof schemaValue.maximum === "number" && typeof data === "number" && data > schemaValue.maximum) {
    errors.push({ path, message: `must be at most ${schemaValue.maximum}` })
  }

  if (typeof schemaValue.pattern === "string" && typeof data === "string" && !new RegExp(schemaValue.pattern).test(data)) {
    errors.push({ path, message: `must match ${schemaValue.pattern}` })
  }

  if (isObject(data)) {
    if (Array.isArray(schemaValue.required)) {
      for (const key of schemaValue.required) {
        if (typeof key === "string" && !(key in data)) errors.push({ path, message: `missing required property: ${key}` })
      }
    }
    const properties = isObject(schemaValue.properties) ? schemaValue.properties : {}
    for (const [key, value] of Object.entries(data)) {
      if (key in properties) {
        check(properties[key], value, `${path}.${key}`, root, errors)
        continue
      }
      if (schemaValue.additionalProperties === false) {
        errors.push({ path, message: `unknown property: ${key}` })
        continue
      }
      if (isObject(schemaValue.additionalProperties)) check(schemaValue.additionalProperties, value, `${path}.${key}`, root, errors)
    }
  }

  if (Array.isArray(data) && isObject(schemaValue.items)) {
    data.forEach((entry, index) => check(schemaValue.items, entry, `${path}[${index}]`, root, errors))
  }
}

/** Every way `data` fails `schema`, each naming the path it failed at. */
export function validate(schema: unknown, data: unknown): SchemaError[] {
  const errors: SchemaError[] = []
  if (!isObject(schema)) return [{ path: "$", message: "schema is not an object" }]
  check(schema, data, "$", schema, errors)
  return errors
}

export function formatErrors(errors: SchemaError[]): string {
  return errors.map((error) => `${error.path}: ${error.message}`).join("\n")
}
