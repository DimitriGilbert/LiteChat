// Global pyodide instance for reuse
let pyodidePromise: Promise<any> | null = null;

export const CodeExecutionService = {
  /**
   * Initialize and get Pyodide instance
   * Singleton pattern to avoid multiple downloads
   */
  async getPyodide(): Promise<any> {
    if (!pyodidePromise) {
      pyodidePromise = this.loadPyodide();
    }
    return pyodidePromise;
  },

  /**
   * Load Pyodide from CDN
   */
  async loadPyodide(): Promise<any> {
    try {
      // Load pyodide dynamically from CDN
      if (typeof window === 'undefined') {
        throw new Error('Pyodide only available in browser environment');
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
      document.head.appendChild(script);
      
      // Wait for script to load
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
      });
      
      // @ts-ignore - Global pyodide from script
      const pyodide = await window.loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
      });
      
      return pyodide;
    } catch (error) {
      console.error('[CodeExecutionService] Failed to load Pyodide:', error);
      throw new Error(`Failed to load Python environment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Execute JavaScript code with context
   * @param code - JavaScript code to execute
   * @param context - Context object with workflow data (same structure as transform steps)
   * @returns Promise<any> - Return value from the code
   */
  async executeJs(code: string, context: Record<string, any>): Promise<any> {
    if (!code.trim()) {
      throw new Error('JavaScript code cannot be empty');
    }

    // No security validation needed - this is user-authored workflow code

    try {
      // Create function with context variables available
      const contextKeys = Object.keys(context);
      const contextValues = Object.values(context);
      
      // Wrap code in function that can return a value
      const wrappedCode = `
        (function(${contextKeys.join(', ')}) {
          ${code}
        })
      `;

      // Evaluate the function
      const func = eval(wrappedCode);
      
      // Execute with context
      const result = func(...contextValues);
      
      // Handle promises
      if (result && typeof result.then === 'function') {
        return await result;
      }
      
      return result;
    } catch (error) {
      console.error('[CodeExecutionService] JavaScript execution error:', error);
      throw new Error(`JavaScript execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Execute Python code with context
   * @param code - Python code to execute
   * @param context - Context object with workflow data
   * @returns Promise<any> - Return value from the code
   */
  async executePy(code: string, context: Record<string, any>): Promise<any> {
    if (!code.trim()) {
      throw new Error('Python code cannot be empty');
    }

    // No security validation needed - this is user-authored workflow code

    try {
      const pyodide = await this.getPyodide();
      pyodide.globals.set("_workflow_result", null);
      // Set context variables in Python global scope
      for (const [key, value] of Object.entries(context)) {
        pyodide.globals.set(key, value);
      }
      
      // Set up return value capture
      pyodide.runPython(`
import sys
import json

# Create a result container
_workflow_result = None

def workflow_return(value):
    global _workflow_result
    _workflow_result = value
    return value
      `);
      
      // Instead of interpolating user code, use exec to safely execute user code in a controlled scope
      // This prevents code injection via triple quotes or special syntax
      const safeWrapper = `
import sys
import json

try:
    exec(USER_CODE, globals())
    # If no explicit return, try to capture the last expression
    if '_workflow_result' not in globals() or _workflow_result is None:
        pass  # No return value
except Exception as e:
    _workflow_result = {'error': str(e)}
    raise
`;
      // Replace USER_CODE with a unique placeholder, then use runPython with code argument
      // Pyodide supports runPython(code, globals, locals) but not direct code injection, so we use set
      pyodide.globals.set("USER_CODE", code);
      pyodide.runPython(safeWrapper);
      
      // Get the return value
      const result = pyodide.globals.get('_workflow_result');
      
      // Convert Python objects to JavaScript
      if (result && result.toJs) {
        return result.toJs({ dict_converter: Object.fromEntries });
      }
      
      return result;
    } catch (error) {
      console.error('[CodeExecutionService] Python execution error:', error);
      throw new Error(`Python execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Get available Python packages
   */
  async getAvailablePythonPackages(): Promise<string[]> {
    try {
      const pyodide = await this.getPyodide();
      pyodide.runPython(`
import sys
available_packages = list(sys.modules.keys())
      `);
      return pyodide.globals.get('available_packages').toJs();
    } catch (error) {
      console.warn('[CodeExecutionService] Could not get Python packages:', error);
      return ['builtins', 'sys', 'json'];
    }
  },

  /**
   * Install additional Python package
   */
  async installPythonPackage(packageName: string): Promise<void> {
    try {
      const pyodide = await this.getPyodide();
      await pyodide.loadPackage([packageName]);
    } catch (error) {
      console.error(`[CodeExecutionService] Failed to install package ${packageName}:`, error);
      throw new Error(`Failed to install Python package: ${packageName}`);
    }
  },
}; 