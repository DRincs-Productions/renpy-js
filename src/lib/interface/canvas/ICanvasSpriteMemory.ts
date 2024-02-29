import { ColorSource } from "pixi.js";
import { ICanvasContainerMemory } from "./ICanvasContainerMemory";
import { ITextureMemory } from "./ITextureMemory";

/**
 * Interface for the canvas sprite memory
 */
export interface ICanvasSpriteMemory extends ICanvasContainerMemory {
    texture: ITextureMemory,
    anchor: { x: number, y: number },
    tint: ColorSource,
}
