import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type {
  BlockRenderer,
  BlockRendererContext,
} from "@/types/litechat/canvas/block-renderer";
import { JsRunnableBlockRenderer } from "@/components/LiteChat/common/JsRunnableBlockRenderer";
import React from "react";

// Control rule prompt for JavaScript runnable blocks
export const JS_RUNNABLE_CONTROL_PROMPT = `# JavaScript Runnable Block Environment

You have access to a full JavaScript execution environment with the following context:

## Available Context
- \`litechat\` — The LiteChat API object with utilities and VFS operations.
- \`litechat.target\` — **THE DOM ELEMENT ITSELF** - Use direct DOM manipulation for performance and versatility.

## LiteChat API Reference
You can use the following methods on \`litechat\`:

### Utilities
- \`litechat.utils.log(level, ...args)\` — Log messages that will be captured in the console output (level: 'info', 'warn', 'error')
- \`litechat.utils.toast(type, message)\` — Show toast notifications (type: 'success', 'error', 'info', 'warning')
- \`litechat.utils.loadModule(url, name, globalKey?, importMap?)\` — Dynamically import an ES module with optional import map support
- \`litechat.utils.loadModules(moduleConfigs)\` — Load multiple ES modules with dependency and import map support
- \`litechat.utils.loadScript(src)\` — Dynamically load a script via <script src="...">. Returns a promise that resolves when loaded. Tracks loaded scripts for cleanup.

### Event System
- \`litechat.emit(eventName, payload)\` — Emit events to the LiteChat system

### VFS (File System)
- \`litechat.getVfsInstance(vfsKey)\` — Get VFS instance ('orphan' is the default)

### DOM Target
- \`litechat.target\` — The DOM element for rendering content and UI

## DOM Manipulation - USE THIS APPROACH!
**ALWAYS use direct DOM operations on the \`litechat.target\` element. This is THE PRIMARY METHOD for rendering content.**

### Basic DOM Operations
\`\`\`runjs
// Clear the target
litechat.target.replaceChildren();

// Create and append elements
const heading = document.createElement('h3');
heading.textContent = 'Hello from DOM!';
heading.className = 'text-blue-500';
litechat.target.appendChild(heading);

// Create interactive elements
const button = document.createElement('button');
button.textContent = 'Click me!';
button.onclick = () => alert('DOM manipulation rocks!');
litechat.target.appendChild(button);

litechat.utils.log('info', 'DOM elements created and appended');
\`\`\`

### Complex DOM Structures
\`\`\`runjs
// Clear target first
litechat.target.replaceChildren();

// Create a container
const container = document.createElement('div');
container.className = 'p-5 bg-gray-100 rounded-lg m-2';

// Add title
const title = document.createElement('h3');
title.textContent = 'Interactive Demo';
container.appendChild(title);

// Add input field
const input = document.createElement('input');
input.type = 'text';
input.placeholder = 'Type something...';
input.className = 'p-2 m-2 border border-gray-300 rounded-md';
container.appendChild(input);

// Add interactive button
const button = document.createElement('button');
button.textContent = 'Process Input';
button.className = 'p-2 px-4 bg-blue-500 text-white border-none rounded-md cursor-pointer';
button.onclick = () => {
  const output = document.createElement('div');
  output.textContent = \`You typed: \${input.value}\`;
  output.className = 'mt-2 p-2 bg-gray-200 rounded-md';
  container.appendChild(output);
};
container.appendChild(button);

// Append to target
litechat.target.appendChild(container);

litechat.utils.log('info', 'Complex DOM structure created');
\`\`\`

### Module Loading Examples
\`\`\`runjs
// Example 1: Loading a simple module
try {
    const lodash = await litechat.utils.loadModule(
        'https://cdn.jsdelivr.net/npm/lodash@4.17.21/+esm', 
        'lodash'
    );
    
    // Use the module
    const numbers = [1, 2, 3, 4, 5];
    const doubled = lodash.map(numbers, n => n * 2);
    
    litechat.utils.log('info', 'Doubled numbers:', doubled);
} catch (error) {
    litechat.utils.toast('error', 'Failed to load lodash');
}
\`\`\`

\`\`\`runjs
// Example 2: Loading multiple modules
async function loadMultipleModules() {
    try {
        const [d3, moment] = await Promise.all([
            litechat.utils.loadModule('https://cdn.jsdelivr.net/npm/d3@7/+esm', 'D3'),
            litechat.utils.loadModule('https://cdn.jsdelivr.net/npm/moment@2.29.4/+esm', 'moment')
        ]);
        
        litechat.utils.log('info', 'Both modules loaded successfully');
        // Use modules here
    } catch (error) {
        litechat.utils.toast('error', 'Failed to load modules');
    }
}

loadMultipleModules();
\`\`\`

### Three.js with OrbitControls Example
\`\`\`runjs
// Clear any previous content
litechat.target.replaceChildren();

async function createThreeJSScene() {
    try {
        litechat.utils.log('info', '🚀 Starting Three.js scene creation...');
        
        // Load the modules with proper import map configuration
        const modules = await litechat.utils.loadModules([
            {
                url: 'https://unpkg.com/three@0.170.0/build/three.module.js',
                name: 'THREE',
                globalKey: 'THREE',
                importMap: {
                    "three": "https://unpkg.com/three@0.170.0/build/three.module.js",
                    "three/addons/": "https://unpkg.com/three@0.170.0/examples/jsm/"
                }
            },
            {
                url: 'https://unpkg.com/three@0.170.0/examples/jsm/controls/OrbitControls.js',
                name: 'OrbitControls',
                globalKey: 'OrbitControls',
                dependencies: ['THREE']
            }
        ]);

        const { THREE, OrbitControls } = modules;
        
        // Create container
        const container = document.createElement('div');
        container.className = 'p-4 bg-gray-900 rounded-lg';
        
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = 800;
        canvas.height = 600;
        canvas.className = 'border border-gray-600 rounded';
        container.appendChild(canvas);
        
        // Add info text
        const info = document.createElement('div');
        info.className = 'text-white text-center mt-2';
        info.textContent = 'Drag to rotate, scroll to zoom';
        container.appendChild(info);
        
        litechat.target.appendChild(container);

        // Three.js scene setup
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x222222);
        
        const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
        camera.position.set(5, 5, 5);
        
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        renderer.setSize(canvas.width, canvas.height);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Add lights
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        scene.add(directionalLight);

        // Create colorful cubes
        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
        const cubes = [];

        for (let i = 0; i < 6; i++) {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshLambertMaterial({ color: colors[i] });
            const cube = new THREE.Mesh(geometry, material);
            
            // Position cubes in a proper circle (60 degrees apart)
            const angle = (i / 6) * Math.PI * 2;
            const radius = 4; // Increased radius for better spacing
            cube.position.set(
                Math.cos(angle) * radius,
                0, // Keep them at same height initially
                Math.sin(angle) * radius
            );
            
            cube.castShadow = true;
            cube.receiveShadow = true;
            scene.add(cube);
            cubes.push(cube);
        }

        // Add a ground plane
        const planeGeometry = new THREE.PlaneGeometry(20, 20);
        const planeMaterial = new THREE.MeshLambertMaterial({ color: 0x808080 });
        const plane = new THREE.Mesh(planeGeometry, planeMaterial);
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = -2;
        plane.receiveShadow = true;
        scene.add(plane);

        // Setup controls
        const controls = new OrbitControls.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.enableZoom = true;

        // Animation loop
        function animate() {
            requestAnimationFrame(animate);
            
            // Rotate cubes
            cubes.forEach((cube, index) => {
                cube.rotation.x += 0.01;
                cube.rotation.y += 0.01;
                cube.position.y = Math.sin(Date.now() * 0.001 + index) * 0.5;
            });
            
            controls.update();
            renderer.render(scene, camera);
        }

        animate();
        litechat.utils.log('info', '🎉 SUCCESS! Three.js scene with animated cubes is displaying!');
        
    } catch (error) {
        litechat.utils.log('error', '❌ FAILED to create scene:', error.message);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'p-4 text-red-600 bg-red-100 border border-red-200 rounded-md';
        errorDiv.textContent = \`Error: \${error.message}\`;
        litechat.target.appendChild(errorDiv);
    }
}
createThreeJSScene();
\`\`\`

## IMPORTANT PRINCIPLES:
1. **ALWAYS use \`litechat.target.appendChild()\`, \`litechat.target.replaceChildren()\`, etc.**
2. **Create elements with \`document.createElement()\`**
3. **Use Tailwind utility classes via \`className\` for styling**
4. **Add event listeners directly: \`element.onclick = () => {...}\`**, prevent defaults when target is focused but release them on blur so your output is usable but do not lock LiteChat usage.
5. **Avoid innerHTML/outerHTML - use DOM methods for performance**
6. **Use \`litechat.target.replaceChildren()\` to clear content before adding new content**
7. **For external libraries, use \`litechat.utils.load...\` method to load your script, module or mapped modules !**

You are encouraged to use the full browser environment (DOM, Canvas, WebGL, Web APIs) with direct DOM manipulation for maximum performance and versatility. Focus on creating interactive, performant visualizations and UI components.
`;

export class JsRunnableBlockRendererModule implements ControlModule {
  readonly id = "core-block-renderer-runnable-js";
  private unregisterCallback?: () => void;
  private unregisterRuleCallback?: () => void;
  private modApiRef?: LiteChatModApi;

  async initialize(): Promise<void> {
    // No initialization needed
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(
        `[JsRunnableBlockRendererModule] Already registered. Skipping.`
      );
      return;
    }

    const jsRunnableBlockRenderer: BlockRenderer = {
      id: this.id,
      supportedLanguages: ["runjs"], // Specifically handles runjs language
      priority: 15, // Higher priority than regular code renderer
      renderer: (context: BlockRendererContext) => {
        return React.createElement(JsRunnableBlockRenderer, {
          code: context.code,
          isStreaming: context.isStreaming,
          interactionId: context.interactionId,
          blockId: context.blockId,
          module: this, // Pass module reference for enhanced context
        });
      },
    };

    this.unregisterCallback = modApi.registerBlockRenderer(
      jsRunnableBlockRenderer
    );

    this.unregisterRuleCallback = modApi.registerRule({
      id: `${this.id}-control-rule`,
      name: "JavaScript Runnable Block Control",
      content: JS_RUNNABLE_CONTROL_PROMPT,
      type: "control",
      alwaysOn: false, // Disabled by default, user must opt-in via settings
      moduleId: this.id,
    });

    this.modApiRef = modApi;
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = undefined;
    }
    if (this.unregisterRuleCallback) {
      this.unregisterRuleCallback();
      this.unregisterRuleCallback = undefined;
    }
  }

  // Public method to get enhanced context for runnable functions
  public getEnhancedContext(
    capturedLogs: string[],
    previewElement: HTMLElement | null
  ) {
    if (!this.modApiRef) {
      throw new Error("Module not initialized with modApi");
    }

    // Create a custom litechat API that matches the control rule prompt
    const customLitechatApi = {
      // Utilities with log capture
      utils: {
        log: (level: "info" | "warn" | "error", ...args: any[]) => {
          const formatted = args
            .map((arg) => {
              if (typeof arg === "object") {
                try {
                  return JSON.stringify(arg, null, 2);
                } catch {
                  return String(arg);
                }
              }
              return String(arg);
            })
            .join(" ");
          const logEntry =
            level === "info"
              ? formatted
              : `${
                  level.charAt(0).toUpperCase() + level.slice(1)
                }: ${formatted}`;
          capturedLogs.push(logEntry);
          // Also log to browser console with prefix for debugging
          this.modApiRef?.log(level, ...args);
        },
        toast: (
          type: "success" | "error" | "info" | "warning",
          message: string
        ) => {
          this.modApiRef?.showToast(type, message);
        },
        // Improved module loading with import map support
        loadModule: async (
          moduleUrl: string,
          moduleName: string,
          globalKey?: string,
          importMap?: Record<string, string>
        ) => {
          const key = globalKey || moduleName;
          // Check if already loaded
          if ((window as any)[key]) {
            return (window as any)[key];
          }

          try {
            // Setup import map if provided
            if (importMap) {
              // Remove any existing import map first
              const existingMap = document.querySelector(
                'script[type="importmap"]'
              );
              if (existingMap) {
                existingMap.remove();
              }

              const mapScript = document.createElement("script");
              mapScript.type = "importmap";
              mapScript.textContent = JSON.stringify({ imports: importMap });
              document.head.appendChild(mapScript);

              // Wait for the import map to be processed
              await new Promise((resolve) => setTimeout(resolve, 100));
            }

            // Dynamic import
            const module = await import(moduleUrl);
            (window as any)[key] = module;

            // Dispatch ready event
            window.dispatchEvent(
              new CustomEvent(`${moduleName.toLowerCase()}-ready`, {
                detail: { [moduleName]: module },
              })
            );

            return module;
          } catch (error) {
            console.error(`Error loading module ${moduleName}:`, error);
            window.dispatchEvent(
              new CustomEvent(`${moduleName.toLowerCase()}-error`, {
                detail: error,
              })
            );
            throw error;
          }
        },
        // Enhanced loadModule function that supports multiple interdependent modules
        loadModules: async (
          moduleConfigs: Array<{
            url: string;
            name: string;
            globalKey?: string;
            dependencies?: string[];
            importMap?: Record<string, string>;
            bareImport?: string;
          }>
        ) => {
          const loadedModules: Record<string, any> = {};
          const loadPromises: Record<string, Promise<any>> = {};

          // 1. Merge all import maps from module configs
          const globalImportMap: Record<string, string> = {};
          moduleConfigs.forEach((config) => {
            if (config.importMap) {
              Object.assign(globalImportMap, config.importMap);
            }
          });

          // 2. Remove any existing import map
          const existingMap = document.querySelector(
            'script[type="importmap"]'
          );
          if (existingMap) existingMap.remove();

          // 3. Inject the new import map
          if (Object.keys(globalImportMap).length > 0) {
            const mapScript = document.createElement("script");
            mapScript.type = "importmap";
            mapScript.textContent = JSON.stringify({
              imports: globalImportMap,
            });
            document.head.appendChild(mapScript);

            // 4. Wait for the import map to be processed
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          // 5. Helper function to load a single module
          const loadSingleModule = async (
            config: (typeof moduleConfigs)[0]
          ): Promise<any> => {
            const key = config.globalKey || config.name;
            if ((window as any)[key]) return (window as any)[key];
            if (key in loadPromises) return loadPromises[key];

            // Wait for dependencies first
            if (config.dependencies) {
              await Promise.all(
                config.dependencies.map((depKey) => {
                  const depModule = moduleConfigs.find(
                    (m) => (m.globalKey || m.name) === depKey
                  );
                  if (depModule) return loadSingleModule(depModule);
                  return Promise.resolve();
                })
              );
            }

            // Load the module
            loadPromises[key] = (async () => {
              try {
                const module = await import(config.url);
                (window as any)[key] = module;
                loadedModules[key] = module;
                return module;
              } catch (error) {
                console.error(`Error loading module ${config.name}:`, error);
                throw error;
              }
            })();

            return loadPromises[key];
          };

          // 6. Load all modules
          await Promise.all(
            moduleConfigs.map((config) => loadSingleModule(config))
          );

          return loadedModules;
        },

        // Universal import map setup for any module resolution issues
        setupImportMap: (importMap: Record<string, string>) => {
          if (!document.querySelector('script[type="importmap"]')) {
            const mapScript = document.createElement("script");
            mapScript.type = "importmap";
            mapScript.textContent = JSON.stringify({ imports: importMap });
            document.head.appendChild(mapScript);
          }
        },
        // Track loaded script elements for cleanup
        loadedScriptElements: [] as HTMLScriptElement[],
        
        loadScript: async (src: string) => {
          return new Promise<void>((resolve, reject) => {
            // Check if already loaded
            if ([...document.scripts].some(s => s.src === src)) {
              resolve();
              return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = (e) => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
            customLitechatApi.utils.loadedScriptElements.push(script);
          });
        },

        clearLoadedScripts: () => {
          customLitechatApi.utils.loadedScriptElements.forEach(script => {
            if (script.parentNode) script.parentNode.removeChild(script);
          });
          customLitechatApi.utils.loadedScriptElements.length = 0;
        },
      },
      // Event system
      emit: (eventName: string, payload: any) => {
        this.modApiRef?.emit(eventName as any, payload);
      },
      // VFS access
      getVfsInstance: (vfsKey?: string) => {
        return this.modApiRef?.getVfsInstance(vfsKey || "orphan");
      },
      // DOM target element
      target: previewElement,
    };

    return {
      litechat: customLitechatApi,
      target: previewElement, // Keep backward compatibility
    };
  }
}
