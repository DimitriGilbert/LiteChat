import type { BlockRenderer, BlockRendererContext } from "@/types/litechat/canvas/block-renderer";
import { useControlRegistryStore } from "@/store/control.store";

export class BlockRendererService {
  /**
   * Find the best renderer for a given language
   * @param lang The language of the code block
   * @param registeredRenderers All registered block renderers
   * @returns The best matching renderer or null if none found
   */
  static findRendererForLanguage(
    lang: string | undefined,
    registeredRenderers: Record<string, BlockRenderer>
  ): BlockRenderer | null {
    const renderers = Object.values(registeredRenderers);
    
    console.log(`[BlockRendererService] Finding renderer for language "${lang}":`, {
      totalRenderers: renderers.length,
      availableRendererIds: renderers.map(r => r.id),
      availableLanguages: renderers.map(r => ({ id: r.id, languages: r.supportedLanguages })),
    });
    
    if (renderers.length === 0) {
      console.log(`[BlockRendererService] No renderers registered`);
      return null;
    }

    // Find renderers that support this specific language
    const specificRenderers = renderers.filter(renderer => 
      renderer.supportedLanguages?.includes(lang || "")
    );

    // Find fallback renderers (no supportedLanguages or empty array)
    const fallbackRenderers = renderers.filter(renderer => 
      !renderer.supportedLanguages || renderer.supportedLanguages.length === 0
    );

    console.log(`[BlockRendererService] Renderer selection for "${lang}":`, {
      specificRenderers: specificRenderers.map(r => ({ id: r.id, priority: r.priority })),
      fallbackRenderers: fallbackRenderers.map(r => ({ id: r.id, priority: r.priority })),
    });

    // Combine and sort by priority (higher priority first)
    const candidateRenderers = [...specificRenderers, ...fallbackRenderers]
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    const selectedRenderer = candidateRenderers[0] || null;
    console.log(`[BlockRendererService] Selected renderer for "${lang}":`, 
      selectedRenderer ? { id: selectedRenderer.id, priority: selectedRenderer.priority } : null
    );

    return selectedRenderer;
  }

  /**
   * Render a code block using the appropriate renderer
   * @param context The block renderer context
   * @returns React node or null if no renderer found
   */
  static renderBlock(context: BlockRendererContext): React.ReactNode | null {
    const registeredRenderers = useControlRegistryStore.getState().blockRenderers;
    const renderer = this.findRendererForLanguage(context.lang, registeredRenderers);
    
    if (!renderer) {
      return null;
    }

    try {
      return renderer.renderer(context);
    } catch (error) {
      console.error(`[BlockRendererService] Error rendering block with renderer ${renderer.id}:`, error);
      return null;
    }
  }

  /**
   * Get all registered renderers
   */
  static getRegisteredRenderers(): Record<string, BlockRenderer> {
    return useControlRegistryStore.getState().blockRenderers;
  }

  /**
   * Check if a renderer exists for a given language
   */
  static hasRendererForLanguage(lang: string | undefined): boolean {
    const registeredRenderers = useControlRegistryStore.getState().blockRenderers;
    return this.findRendererForLanguage(lang, registeredRenderers) !== null;
  }
} 