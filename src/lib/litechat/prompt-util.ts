import type { PromptTemplate, PromptFormData, CompiledPrompt } from "@/types/litechat/prompt-template";

/**
 * Replaces placeholders in a template string with corresponding values from a FormData object.
 *
 * @param content - The template string with placeholders (e.g., "Hello, {{name}}").
 * @param variables - An array of variable definitions for the template.
 * @param formData - An object containing the data to fill in the placeholders.
 * @returns The content with placeholders filled.
 */
function fillPlaceholders(content: string, variables: PromptTemplate['variables'], formData: PromptFormData): string {
    let filledContent = content;
    if (!variables) {
        return filledContent;
    }
    variables.forEach(variable => {
        const placeholder = `{{${variable.name}}}`;
        const value = formData[variable.name];

        if (value !== undefined) {
            // For array values (e.g., from multi-select), join them into a string
            const replacement = Array.isArray(value) ? value.join(', ') : String(value);
            filledContent = filledContent.replace(new RegExp(placeholder, 'g'), replacement);
        }
    });
    return filledContent;
}


/**
 * Compiles a prompt template with the given form data.
 * It fills placeholders, selects tools, and selects rules.
 *
 * @param template - The PromptTemplate object to compile.
 * @param formData - The form data to use for compilation.
 * @returns A promise that resolves to the compiled prompt.
 */
export async function compilePromptTemplate(template: PromptTemplate, formData: PromptFormData): Promise<CompiledPrompt> {
    const variables = template.variables || [];
    
    // Fill in the main content
    const compiledContent = fillPlaceholders(template.prompt, variables, formData);
    
    // TODO: Add logic for selecting tools and rules based on formData if needed in the future
    const selectedTools = template.tools || [];
    const selectedRules = template.rules || [];

    return {
        content: compiledContent,
        selectedTools: selectedTools,
        selectedRules: selectedRules
    };
} 