import type { AiModelConfig } from "@/types/litechat/provider";
import { experimental_generateImage as generateImage } from "ai";
import { toast } from "sonner";

export interface ImageGenerationRequest {
  prompt: string;
  model: AiModelConfig;
  size?: "256x256" | "512x512" | "1024x1024" | "1792x1024" | "1024x1792";
  quality?: "standard" | "hd";
  style?: "vivid" | "natural";
  width?: number;
  height?: number;
  steps?: number;
  guidance_scale?: number;
  seed?: number;
}

export interface ImageGenerationResult {
  image: string; // URL or base64 encoded image
  finishReason: "stop" | "length" | "content-filter" | "other";
  width?: number;
  height?: number;
  seed?: number;
}

export class AiImageGenerationService {
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const { model, prompt } = request;

    // Check if the model supports image generation
    const outputModalities = model.metadata?.architecture?.output_modalities || [];
    if (!outputModalities.includes("image") && !outputModalities.includes("video")) {
      throw new Error(`Model ${model.name} does not support image or video generation`);
    }

    try {
      console.log(`[ImageGeneration] Generating image with model: ${model.name}`);
      console.log(`[ImageGeneration] Prompt: ${prompt}`);

      // Prepare generation options for experimental_generateImage
      const generateOptions: any = {
        model: model.instance,
        prompt,
      };

      // Add provider-specific parameters for OpenAI/OpenRouter
      if (request.size && (model.providerId === "openai" || model.providerId === "openrouter")) {
        generateOptions.size = request.size;
      }
      
      if (request.quality && (model.providerId === "openai" || model.providerId === "openrouter")) {
        generateOptions.quality = request.quality;
      }
      
      if (request.style && (model.providerId === "openai" || model.providerId === "openrouter")) {
        generateOptions.style = request.style;
      }

      // Add aspect ratio for supported providers
      if (request.width && request.height) {
        // Calculate aspect ratio for providers that support it
        const aspectRatio = `${request.width}:${request.height}`;
        if (model.providerId === "fal" || model.providerId === "replicate" || model.providerId === "luma") {
          generateOptions.aspectRatio = aspectRatio;
        }
      }

      // Add provider-specific options via providerOptions
      const providerOptions: any = {};
      
      if (model.providerId === "fal") {
        if (request.steps) providerOptions.num_inference_steps = request.steps;
        if (request.guidance_scale) providerOptions.guidance_scale = request.guidance_scale;
        if (request.seed) providerOptions.seed = request.seed;
        if (Object.keys(providerOptions).length > 0) {
          generateOptions.providerOptions = { fal: providerOptions };
        }
      }
      
      if (model.providerId === "replicate") {
        if (request.steps) providerOptions.num_inference_steps = request.steps;
        if (request.guidance_scale) providerOptions.guidance_scale = request.guidance_scale;
        if (request.seed) providerOptions.seed = request.seed;
        if (Object.keys(providerOptions).length > 0) {
          generateOptions.providerOptions = { replicate: providerOptions };
        }
      }
      
      if (model.providerId === "luma") {
        if (request.seed) providerOptions.seed = request.seed;
        // Add polling configuration for Luma
        providerOptions.pollIntervalMillis = 5000;
        providerOptions.maxPollAttempts = 10;
        if (Object.keys(providerOptions).length > 0) {
          generateOptions.providerOptions = { luma: providerOptions };
        }
      }
      
      if (model.providerId === "deepinfra") {
        if (request.steps) providerOptions.num_inference_steps = request.steps;
        if (request.guidance_scale) providerOptions.guidance_scale = request.guidance_scale;
        if (request.seed) providerOptions.seed = request.seed;
        if (Object.keys(providerOptions).length > 0) {
          generateOptions.providerOptions = { deepinfra: providerOptions };
        }
      }

      const result = await generateImage(generateOptions);

      console.log(`[ImageGeneration] Generation successful`);
      
      return {
        image: result.image.toString(), // Convert to base64 or URL string
        finishReason: "stop", // experimental_generateImage doesn't have finishReason
        width: typeof result.providerMetadata?.width === 'number' ? result.providerMetadata.width : undefined,
        height: typeof result.providerMetadata?.height === 'number' ? result.providerMetadata.height : undefined,
        seed: typeof result.providerMetadata?.seed === 'number' ? result.providerMetadata.seed : undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[ImageGeneration] Error generating image:`, errorMessage);
      toast.error(`Image generation failed: ${errorMessage}`);
      throw new Error(`Image generation failed: ${errorMessage}`);
    }
  }
}

export const aiImageGenerationService = new AiImageGenerationService(); 