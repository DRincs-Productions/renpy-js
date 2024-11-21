import { FadeAlphaTickerProps, MoveTickerProps, ZoomTickerProps } from "../../types/ticker"
import { aliasToRemoveAfterType } from "../../types/ticker/AliasToRemoveAfterType"

interface BaseTransitionProps {
    /**
     * If true, the transition will be completed before the next step.
     * For example, if the transition is a dissolve transition, the "alpha" of the texture will be 1 before the next step.
     * @default true
     */
    mustBeCompletedBeforeNextStep?: boolean,
}

export interface ShowWithDissolveTransitionProps extends BaseTransitionProps, Omit<FadeAlphaTickerProps, "type" | aliasToRemoveAfterType | "startOnlyIfHaveTexture"> { }
export interface ShowWithFadeTransitionProps extends BaseTransitionProps, Omit<FadeAlphaTickerProps, "type" | aliasToRemoveAfterType | "startOnlyIfHaveTexture"> { }
export interface MoveInOutProps extends BaseTransitionProps, Omit<MoveTickerProps, aliasToRemoveAfterType | "startOnlyIfHaveTexture" | "destination" | "isPushInOut"> {
    /**
     * The direction of the movement.
     */
    direction?: "up" | "down" | "left" | "right",
}
export interface ZoomInOutProps extends BaseTransitionProps, Omit<ZoomTickerProps, "startOnlyIfHaveTexture" | "type" | "limit" | "isZoomInOut"> {
    /**
     * The direction of the zoom effect.
     */
    direction?: "up" | "down" | "left" | "right",
}
export interface PushInOutProps extends BaseTransitionProps, Omit<MoveTickerProps, "startOnlyIfHaveTexture" | "destination" | "isPushInOut"> {
    /**
     * The direction of the push effect.
     */
    direction?: "up" | "down" | "left" | "right",
} 
