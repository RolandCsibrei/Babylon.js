import { InternalTexture, InternalTextureSource } from "../../../Materials/Textures/internalTexture";
import type { RenderTargetCreationOptions, DepthTextureCreationOptions, TextureSize } from "../../../Materials/Textures/textureCreationOptions";
import type { Nullable } from "../../../types";
import { Constants } from "../../constants";
import type { RenderTargetWrapper } from "../../renderTargetWrapper";
import { WebGPURenderTargetWrapper } from "../webgpuRenderTargetWrapper";
import { GetTypeForDepthTexture, HasStencilAspect } from "core/Materials/Textures/textureHelper.functions";

import "../../AbstractEngine/abstractEngine.texture";
import { ThinWebGPUEngine } from "core/Engines/thinWebGPUEngine";

declare module "../../abstractEngine" {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    export interface AbstractEngine {
        /**
         * Creates a new render target texture
         * @param size defines the size of the texture
         * @param options defines the options used to create the texture
         * @returns a new render target wrapper ready to render texture
         */
        createRenderTargetTexture(size: TextureSize, options: boolean | RenderTargetCreationOptions): RenderTargetWrapper;

        /**
         * Updates the sample count of a render target texture
         * @see https://doc.babylonjs.com/setup/support/webGL2#multisample-render-targets
         * @param rtWrapper defines the render target wrapper to update
         * @param samples defines the sample count to set
         * @returns the effective sample count (could be 0 if multisample render targets are not supported)
         */
        updateRenderTargetTextureSampleCount(rtWrapper: Nullable<RenderTargetWrapper>, samples: number): number;

        /** @internal */
        _createDepthStencilTexture(size: TextureSize, options: DepthTextureCreationOptions, rtWrapper: RenderTargetWrapper): InternalTexture;

        /** @internal */
        _createHardwareRenderTargetWrapper(isMulti: boolean, isCube: boolean, size: TextureSize): RenderTargetWrapper;

        /** @internal */
        _setupDepthStencilTexture(internalTexture: InternalTexture, size: TextureSize, bilinearFiltering: boolean, comparisonFunction: number, samples?: number): void;
    }
}

ThinWebGPUEngine.prototype._createHardwareRenderTargetWrapper = function (isMulti: boolean, isCube: boolean, size: TextureSize): WebGPURenderTargetWrapper {
    const rtWrapper = new WebGPURenderTargetWrapper(isMulti, isCube, size, this);
    this._renderTargetWrapperCache.push(rtWrapper);
    return rtWrapper;
};

ThinWebGPUEngine.prototype.createRenderTargetTexture = function (size: TextureSize, options: boolean | RenderTargetCreationOptions): WebGPURenderTargetWrapper {
    const rtWrapper = this._createHardwareRenderTargetWrapper(false, false, size) as WebGPURenderTargetWrapper;

    const fullOptions: RenderTargetCreationOptions = {};

    if (options !== undefined && typeof options === "object") {
        fullOptions.generateMipMaps = options.generateMipMaps;
        fullOptions.generateDepthBuffer = options.generateDepthBuffer === undefined ? true : options.generateDepthBuffer;
        fullOptions.generateStencilBuffer = fullOptions.generateDepthBuffer && options.generateStencilBuffer;
        fullOptions.samplingMode = options.samplingMode === undefined ? Constants.TEXTURE_TRILINEAR_SAMPLINGMODE : options.samplingMode;
        fullOptions.creationFlags = options.creationFlags ?? 0;
        fullOptions.noColorAttachment = !!options.noColorAttachment;
        fullOptions.colorAttachment = options.colorAttachment;
        fullOptions.samples = options.samples;
        fullOptions.label = options.label;
        fullOptions.format = options.format;
        fullOptions.type = options.type;
    } else {
        fullOptions.generateMipMaps = options;
        fullOptions.generateDepthBuffer = true;
        fullOptions.generateStencilBuffer = false;
        fullOptions.samplingMode = Constants.TEXTURE_TRILINEAR_SAMPLINGMODE;
        fullOptions.creationFlags = 0;
        fullOptions.noColorAttachment = false;
    }

    const texture =
        fullOptions.colorAttachment || (fullOptions.noColorAttachment ? null : this._createInternalTexture(size, fullOptions, true, InternalTextureSource.RenderTarget));

    rtWrapper.label = fullOptions.label ?? "RenderTargetWrapper";
    rtWrapper._samples = fullOptions.colorAttachment?.samples ?? fullOptions.samples ?? 1;
    rtWrapper._generateDepthBuffer = fullOptions.generateDepthBuffer;
    rtWrapper._generateStencilBuffer = fullOptions.generateStencilBuffer ? true : false;

    rtWrapper.setTextures(texture);

    if (rtWrapper._generateDepthBuffer || rtWrapper._generateStencilBuffer) {
        rtWrapper.createDepthStencilTexture(
            0,
            false, // force false as filtering is not supported for depth textures
            rtWrapper._generateStencilBuffer,
            rtWrapper.samples,
            fullOptions.generateStencilBuffer ? Constants.TEXTUREFORMAT_DEPTH24_STENCIL8 : Constants.TEXTUREFORMAT_DEPTH32_FLOAT,
            fullOptions.label ? fullOptions.label + "-DepthStencil" : undefined
        );
    }

    if (texture && !fullOptions.colorAttachment) {
        if (options !== undefined && typeof options === "object" && options.createMipMaps && !fullOptions.generateMipMaps) {
            texture.generateMipMaps = true;
        }

        this._textureHelper.createGPUTextureForInternalTexture(texture, undefined, undefined, undefined, fullOptions.creationFlags);

        if (options !== undefined && typeof options === "object" && options.createMipMaps && !fullOptions.generateMipMaps) {
            texture.generateMipMaps = false;
        }
    }

    return rtWrapper;
};

ThinWebGPUEngine.prototype._createDepthStencilTexture = function (size: TextureSize, options: DepthTextureCreationOptions, wrapper: WebGPURenderTargetWrapper): InternalTexture {
    const internalOptions = {
        bilinearFiltering: false,
        comparisonFunction: 0,
        generateStencil: false,
        samples: 1,
        depthTextureFormat: options.generateStencil ? Constants.TEXTUREFORMAT_DEPTH24_STENCIL8 : Constants.TEXTUREFORMAT_DEPTH32_FLOAT,
        ...options,
    };

    const hasStencil = HasStencilAspect(internalOptions.depthTextureFormat);

    wrapper._depthStencilTextureWithStencil = hasStencil;

    const internalTexture = new InternalTexture(this, hasStencil ? InternalTextureSource.DepthStencil : InternalTextureSource.Depth);

    internalTexture.label = options.label;

    internalTexture.format = internalOptions.depthTextureFormat;
    internalTexture.type = GetTypeForDepthTexture(internalTexture.format);

    this._setupDepthStencilTexture(internalTexture, size, internalOptions.bilinearFiltering, internalOptions.comparisonFunction, internalOptions.samples);

    this._textureHelper.createGPUTextureForInternalTexture(internalTexture);

    this._internalTexturesCache.push(internalTexture);

    return internalTexture;
};

ThinWebGPUEngine.prototype._setupDepthStencilTexture = function (
    internalTexture: InternalTexture,
    size: TextureSize,
    bilinearFiltering: boolean,
    comparisonFunction: number,
    samples = 1
): void {
    const width = (<{ width: number; height: number; layers?: number }>size).width ?? <number>size;
    const height = (<{ width: number; height: number; layers?: number }>size).height ?? <number>size;
    const layers = (<{ width: number; height: number; depth?: number; layers?: number }>size).layers || 0;
    const depth = (<{ width: number; height: number; depth?: number; layers?: number }>size).depth || 0;

    internalTexture.baseWidth = width;
    internalTexture.baseHeight = height;
    internalTexture.width = width;
    internalTexture.height = height;
    internalTexture.is2DArray = layers > 0;
    internalTexture.is3D = depth > 0;
    internalTexture.depth = layers || depth;
    internalTexture.isReady = true;
    internalTexture.samples = samples;
    internalTexture.generateMipMaps = false;
    internalTexture.samplingMode = bilinearFiltering ? Constants.TEXTURE_BILINEAR_SAMPLINGMODE : Constants.TEXTURE_NEAREST_SAMPLINGMODE;
    internalTexture.type = Constants.TEXTURETYPE_FLOAT; // the right type will be set later
    internalTexture._comparisonFunction = comparisonFunction;
    internalTexture._cachedWrapU = Constants.TEXTURE_CLAMP_ADDRESSMODE;
    internalTexture._cachedWrapV = Constants.TEXTURE_CLAMP_ADDRESSMODE;
};

ThinWebGPUEngine.prototype.updateRenderTargetTextureSampleCount = function (rtWrapper: Nullable<RenderTargetWrapper>, samples: number): number {
    if (!rtWrapper || !rtWrapper.texture || rtWrapper.samples === samples) {
        return samples;
    }

    samples = Math.min(samples, this.getCaps().maxMSAASamples);

    this._textureHelper.createMSAATexture(rtWrapper.texture, samples);

    if (rtWrapper._depthStencilTexture) {
        this._textureHelper.createMSAATexture(rtWrapper._depthStencilTexture, samples);
        rtWrapper._depthStencilTexture.samples = samples;
    }

    rtWrapper._samples = samples;
    rtWrapper.texture.samples = samples;

    return samples;
};
