import type {
  PromptTemplate,
  PromptFormData,
  CompiledPrompt,
  PromptVariable,
} from "@/types/litechat/prompt-template";

/**
 * Parses the string-based default value from a prompt variable into its correct type.
 * @param variable The prompt variable definition.
 * @returns The parsed default value, or undefined if none is present.
 */
export function parseVariableValue(
  value: any,
  type: PromptVariable["type"]
): any {
  if (value === undefined || value === null) return value;

  switch (type) {
    case "number":
      const num = parseFloat(value);
      return isNaN(num) ? undefined : num;
    case "boolean":
      return String(value).toLowerCase() === "true";
    case "array":
      if (Array.isArray(value)) return value; // Already an array
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [String(value)];
      } catch {
        return String(value)
          .split(",")
          .map((s) => s.trim());
      }
    case "string":
    default:
      return String(value);
  }
}

/**
 * Replaces placeholders in a template string with corresponding values from a FormData object.
 * It now supports flexible spacing (e.g., {{ variable }}) and correctly serializes objects/arrays.
 *
 * @param content - The template string with placeholders.
 * @param formData - An object containing the data to fill in the placeholders.
 * @returns The content with placeholders filled.
 */
function fillPlaceholders(content: string, formData: PromptFormData): string {
  // Regex to find {{variable_name}} with optional whitespace
  return content.replace(/\{\{\s*([\w_.-]+)\s*\}\}/g, (match, variableName) => {
    const value = formData[variableName];

    if (value === undefined || value === null) {
      // Keep placeholder for missing non-required variables
      return match;
    }

    // Handle arrays: serialize objects, convert others to string, then join
    if (Array.isArray(value)) {
      return value
        .map((item) => {
          if (item === null) return "null";
          if (typeof item === "object") return JSON.stringify(item);
          return String(item);
        })
        .join(", ");
    }

    // Handle non-array objects
    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    // Handle primitives
    return String(value);
  });
}

/**
 * Compiles a prompt template with the given form data.
 * It validates required variables, applies defaults, fills placeholders,
 * and selects tools and rules.
 *
 * @param template - The PromptTemplate object to compile.
 * @param formData - The form data to use for compilation.
 * @returns A promise that resolves to the compiled prompt.
 */
export async function compilePromptTemplate(
  template: PromptTemplate,
  formData: PromptFormData
): Promise<CompiledPrompt> {
  const variables = template.variables || [];
  const processedFormData = { ...formData };

  // Validate required variables and apply defaults
  for (const variable of variables) {
    let value = processedFormData[variable.name];

    // Use default value if the current value is undefined or null
    if (
      (value === undefined || value === null) &&
      variable.default !== undefined
    ) {
      value = parseVariableValue(variable.default, variable.type);
      processedFormData[variable.name] = value;
    }

    // Check for required variables
    if (variable.required) {
      if (value === undefined || value === null || value === "") {
        throw new Error(
          `Required variable "${variable.name}" is missing or empty.`
        );
      }
      if (Array.isArray(value) && value.length === 0) {
        throw new Error(
          `Required variable "${variable.name}" cannot be an empty array.`
        );
      }
    }
  }

  // Fill in the main content
  const compiledContent = fillPlaceholders(template.prompt, processedFormData);

  // TODO: Add logic for selecting tools and rules based on formData if needed in the future
  const selectedTools = template.tools || [];
  const selectedRules = template.rules || [];

  return {
    content: compiledContent,
    selectedTools: selectedTools,
    selectedRules: selectedRules,
  };
}

/**
 * Calculates the cost of prompt and completion tokens based on per-million pricing.
 * @param promptTokens Number of prompt tokens
 * @param completionTokens Number of completion tokens
 * @param promptPrice Price per million prompt tokens (e.g., 3 = $3 per 1M tokens)
 * @param completionPrice Price per million completion tokens (e.g., 15 = $15 per 1M tokens)
 * @returns Object with cost and formula type (always 'per-million')
 */
export const calculateTokenCost = (
  promptTokens: number,
  completionTokens: number,
  promptPrice: number,
  completionPrice: number
): { cost: number; formula: 'per-million' } => {
  return {
    cost:
      promptTokens * promptPrice +
      completionTokens * completionPrice,
    formula: 'per-million',
  };
};
