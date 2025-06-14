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
    
    if (renderers.length === 0) {
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

    // Combine and sort by priority (higher priority first)
    const candidateRenderers = [...specificRenderers, ...fallbackRenderers]
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    return candidateRenderers[0] || null;
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