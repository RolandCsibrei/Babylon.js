/* eslint-disable @typescript-eslint/naming-convention */
import type { Nullable } from "../types";
import type { Scene } from "../scene";
import type { IAudioEngine } from "./Interfaces/IAudioEngine";
import { Tools } from "../Misc/tools";
import { EngineStore } from "../Engines/engineStore";
import { AbstractEngine } from "core/Engines/abstractEngine";

/**
 * Class used to work with sound analyzer using fast fourier transform (FFT)
 * @see https://doc.babylonjs.com/features/featuresDeepDive/audio/playingSoundsMusic
 */
export class Analyser {
    /**
     * Gets or sets the smoothing
     */
    public SMOOTHING = 0.75;
    /**
     * Gets or sets the FFT table size
     */
    public FFT_SIZE = 512;
    /**
     * Gets or sets the bar graph amplitude
     */
    public BARGRAPHAMPLITUDE = 256;
    /**
     * Gets or sets the position of the debug canvas
     */
    public DEBUGCANVASPOS = { x: 20, y: 20 };
    /**
     * Gets or sets the debug canvas size
     */
    public DEBUGCANVASSIZE = { width: 320, height: 200 };

    private _byteFreqs: Uint8Array;
    private _byteTime: Uint8Array;
    private _floatFreqs: Float32Array;
    private _webAudioAnalyser: AnalyserNode;
    private _debugCanvas: Nullable<HTMLCanvasElement>;
    private _debugCanvasContext: Nullable<CanvasRenderingContext2D>;
    private _scene: Scene;
    private _registerFunc: Nullable<() => void>;
    private _audioEngine: IAudioEngine;

    /**
     * Creates a new analyser
     * @param scene defines hosting scene
     */
    constructor(scene?: Nullable<Scene>) {
        scene = scene || EngineStore.LastCreatedScene;
        if (!scene) {
            return;
        }
        this._scene = scene;
        if (!AbstractEngine.audioEngine) {
            Tools.Warn("No audio engine initialized, failed to create an audio analyser");
            return;
        }
        this._audioEngine = AbstractEngine.audioEngine;
        if (this._audioEngine.canUseWebAudio && this._audioEngine.audioContext) {
            this._webAudioAnalyser = this._audioEngine.audioContext.createAnalyser();
            this._webAudioAnalyser.minDecibels = -140;
            this._webAudioAnalyser.maxDecibels = 0;
            this._byteFreqs = new Uint8Array(this._webAudioAnalyser.frequencyBinCount);
            this._byteTime = new Uint8Array(this._webAudioAnalyser.frequencyBinCount);
            this._floatFreqs = new Float32Array(this._webAudioAnalyser.frequencyBinCount);
        }
    }

    /**
     * Get the number of data values you will have to play with for the visualization
     * @see https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/frequencyBinCount
     * @returns a number
     */
    public getFrequencyBinCount(): number {
        if (this._audioEngine.canUseWebAudio) {
            return this._webAudioAnalyser.frequencyBinCount;
        } else {
            return 0;
        }
    }

    /**
     * Gets the current frequency data as a byte array
     * @see https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/getByteFrequencyData
     * @returns a Uint8Array
     */
    public getByteFrequencyData(): Uint8Array {
        if (this._audioEngine.canUseWebAudio) {
            this._webAudioAnalyser.smoothingTimeConstant = this.SMOOTHING;
            this._webAudioAnalyser.fftSize = this.FFT_SIZE;
            this._webAudioAnalyser.getByteFrequencyData(this._byteFreqs);
        }
        return this._byteFreqs;
    }

    /**
     * Gets the current waveform as a byte array
     * @see https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/getByteTimeDomainData
     * @returns a Uint8Array
     */
    public getByteTimeDomainData(): Uint8Array {
        if (this._audioEngine.canUseWebAudio) {
            this._webAudioAnalyser.smoothingTimeConstant = this.SMOOTHING;
            this._webAudioAnalyser.fftSize = this.FFT_SIZE;
            this._webAudioAnalyser.getByteTimeDomainData(this._byteTime);
        }
        return this._byteTime;
    }

    /**
     * Gets the current frequency data as a float array
     * @see https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/getByteFrequencyData
     * @returns a Float32Array
     */
    public getFloatFrequencyData(): Float32Array {
        if (this._audioEngine.canUseWebAudio) {
            this._webAudioAnalyser.smoothingTimeConstant = this.SMOOTHING;
            this._webAudioAnalyser.fftSize = this.FFT_SIZE;
            this._webAudioAnalyser.getFloatFrequencyData(this._floatFreqs);
        }
        return this._floatFreqs;
    }

    /**
     * Renders the debug canvas
     */
    public drawDebugCanvas() {
        if (this._audioEngine.canUseWebAudio) {
            if (!this._debugCanvas) {
                this._debugCanvas = document.createElement("canvas");
                this._debugCanvas.width = this.DEBUGCANVASSIZE.width;
                this._debugCanvas.height = this.DEBUGCANVASSIZE.height;
                this._debugCanvas.style.position = "absolute";
                this._debugCanvas.style.top = this.DEBUGCANVASPOS.y + "px";
                this._debugCanvas.style.left = this.DEBUGCANVASPOS.x + "px";
                this._debugCanvasContext = this._debugCanvas.getContext("2d");
                document.body.appendChild(this._debugCanvas);
                this._registerFunc = () => {
                    this.drawDebugCanvas();
                };
                this._scene.registerBeforeRender(this._registerFunc);
            }
            if (this._registerFunc && this._debugCanvasContext) {
                const workingArray = this.getByteFrequencyData();

                this._debugCanvasContext.fillStyle = "rgb(0, 0, 0)";
                this._debugCanvasContext.fillRect(0, 0, this.DEBUGCANVASSIZE.width, this.DEBUGCANVASSIZE.height);

                // Draw the frequency domain chart.
                for (let i = 0; i < this.getFrequencyBinCount(); i++) {
                    const value = workingArray[i];
                    const percent = value / this.BARGRAPHAMPLITUDE;
                    const height = this.DEBUGCANVASSIZE.height * percent;
                    const offset = this.DEBUGCANVASSIZE.height - height - 1;
                    const barWidth = this.DEBUGCANVASSIZE.width / this.getFrequencyBinCount();
                    const hue = (i / this.getFrequencyBinCount()) * 360;
                    this._debugCanvasContext.fillStyle = "hsl(" + hue + ", 100%, 50%)";
                    this._debugCanvasContext.fillRect(i * barWidth, offset, barWidth, height);
                }
            }
        }
    }

    /**
     * Stops rendering the debug canvas and removes it
     */
    public stopDebugCanvas() {
        if (this._debugCanvas) {
            if (this._registerFunc) {
                this._scene.unregisterBeforeRender(this._registerFunc);
                this._registerFunc = null;
            }
            document.body.removeChild(this._debugCanvas);
            this._debugCanvas = null;
            this._debugCanvasContext = null;
        }
    }

    /**
     * Connects two audio nodes
     * @param inputAudioNode defines first node to connect
     * @param outputAudioNode defines second node to connect
     */
    public connectAudioNodes(inputAudioNode: AudioNode, outputAudioNode: AudioNode) {
        if (this._audioEngine.canUseWebAudio) {
            inputAudioNode.connect(this._webAudioAnalyser);
            this._webAudioAnalyser.connect(outputAudioNode);
        }
    }

    /**
     * Releases all associated resources
     */
    public dispose() {
        if (this._audioEngine.canUseWebAudio) {
            this._webAudioAnalyser.disconnect();
        }
    }
}
