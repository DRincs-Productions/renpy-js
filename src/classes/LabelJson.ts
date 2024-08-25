import sha1 from 'crypto-js/sha1'
import { moveIn, setFlag, showImage, showVideo, showWithDissolveTransition, showWithFadeTransition, zoomIn } from "../functions"
import { getValueFromConditionalStatements, getVariableData, setStorageJson } from "../functions/PixiVNJsonUtility"
import { LabelProps, PixiVNJsonIfElse, PixiVNJsonLabelStep, PixiVNJsonOperation } from "../interface"
import PixiVNJsonConditionalStatements from '../interface/PixiVNJsonConditionalStatements'
import { PixiVNJsonChoice, PixiVNJsonChoices, PixiVNJsonDialog, PixiVNJsonDialogText, PixiVNJsonLabelToOpen } from "../interface/PixiVNJsonLabelStep"
import { canvas, narration, sound, storage } from "../managers"
import { LabelIdType } from "../types/LabelIdType"
import { StepLabelType } from "../types/StepLabelType"
import CanvasVideo from "./canvas/CanvasAVideo"
import CanvasImage from "./canvas/CanvasImage"
import ChoiceMenuOption from "./ChoiceMenuOption"
import LabelAbstract from "./LabelAbstract"

export default class LabelJson<T extends {} = {}> extends LabelAbstract<LabelJson<T>, T> {
    /**
     * @param id is the id of the label
     * @param steps is the list of steps that the label will perform
     * @param props is the properties of the label
     */
    constructor(id: LabelIdType, steps: (PixiVNJsonLabelStep | (() => PixiVNJsonLabelStep))[], props?: LabelProps<LabelJson<T>>) {
        super(id, props)
        this._steps = steps
    }

    private _steps: (PixiVNJsonLabelStep | (() => PixiVNJsonLabelStep))[]
    /**
     * Get the steps of the label.
     */
    public get steps(): StepLabelType<T>[] {
        return this._steps.map(this.stepConverter)
    }

    public getStepSha1(index: number): string | undefined {
        if (index < 0 || index >= this.steps.length) {
            return undefined
        }
        let step = this._steps[index]
        let sha1String = sha1(step.toString().toLocaleLowerCase())
        return sha1String.toString()
    }

    private getDialogueText(origin: PixiVNJsonDialogText): string | string[] {
        let text: string | string[] = ""
        if (Array.isArray(origin)) {
            let texts: string[] = []
            origin.forEach((t) => {
                texts.push(getValueFromConditionalStatements(t) || "")
            })
            text = texts
        }
        else {
            text = getValueFromConditionalStatements(origin) || ""
        }
        return text
    }
    private getDialogue(origin: PixiVNJsonDialog<PixiVNJsonDialogText> | PixiVNJsonConditionalStatements<PixiVNJsonDialog<PixiVNJsonDialogText>> | undefined): PixiVNJsonDialog<string | string[]> | undefined {
        let d = getValueFromConditionalStatements(origin)
        let dialogue: PixiVNJsonDialog<string | string[]> | undefined = undefined
        if (d) {
            if (typeof d === "object" && "character" in d && "text" in d) {
                dialogue = {
                    character: d.character,
                    text: this.getDialogueText(d.text)
                }
            }
            else {
                dialogue = this.getDialogueText(d)
            }
        }
        return dialogue
    }

    private getChoices(origin: PixiVNJsonChoices | PixiVNJsonConditionalStatements<PixiVNJsonChoices> | undefined): PixiVNJsonChoice[] | undefined {
        let choices = getValueFromConditionalStatements(origin)
        if (choices) {
            let options: PixiVNJsonChoice[] = choices.map((option) => {
                return getValueFromConditionalStatements(option)
            }).filter((option) => option !== undefined)
            return options
        }
        return undefined
    }

    private stepConverter(step: PixiVNJsonLabelStep | (() => PixiVNJsonLabelStep)): StepLabelType<T> {
        return async (props) => {
            if (typeof step === "function") {
                step = step()
            }
            if (step.operation) {
                for (let operation of step.operation) {
                    await this.runOperation(operation)
                }
            }

            let choices = this.getChoices(step.choices)
            let glueEnabled = getValueFromConditionalStatements(step.glueEnabled)
            let dialogue: PixiVNJsonDialog<string | string[]> | undefined = this.getDialogue(step.dialogue)
            let labelToOpen: PixiVNJsonLabelToOpen[] = []
            if (step.labelToOpen) {
                if (!Array.isArray(step.labelToOpen)) {
                    step.labelToOpen = [step.labelToOpen]
                }
                step.labelToOpen.forEach((label) => {
                    let i = getValueFromConditionalStatements(label)
                    if (i) {
                        labelToOpen.push(i)
                    }
                })
            }
            let goNextStep = getValueFromConditionalStatements(step.goNextStep)
            let end = getValueFromConditionalStatements(step.end)

            if (choices) {
                let options = choices.map((option) => {
                    let text: string = ""
                    if (Array.isArray(option.text)) {
                        let texts: string[] = []
                        option.text.forEach((t) => {
                            if (typeof t === "string") {
                                texts.push(t)
                            }
                            else if (t.conditionalChoice) {
                                let res = getVariableData(t.conditionalChoice, "conditionalChoice").map((choice) => {
                                    if (Array.isArray(choice.text)) {
                                        return choice.text.join()
                                    }
                                    return choice.text || ""
                                })
                                texts = texts.concat(res)
                            }
                        })
                        text = texts.join()
                    }
                    else if (typeof option.text === "string") {
                        text = option.text
                    }
                    return new ChoiceMenuOption(text, option.label, option.props, {
                        type: option.type,
                        oneTime: option.oneTime
                    })
                })
                options = options.filter((option, index) => {
                    if (option.oneTime) {
                        let alreadyChoices = narration.alreadyCurrentStepMadeChoices
                        if (alreadyChoices && alreadyChoices.includes(index)) {
                            return false
                        }
                    }
                    return true
                })
                narration.choiceMenuOptions = options
            }
            else {
                narration.choiceMenuOptions = undefined
            }

            if (glueEnabled) {
                setFlag(storage.keysSystem.ADD_NEXT_DIALOG_TEXT_INTO_THE_CURRENT_DIALOG_FLAG_KEY, true)
            }
            else if (glueEnabled === false) {
                setFlag(storage.keysSystem.ADD_NEXT_DIALOG_TEXT_INTO_THE_CURRENT_DIALOG_FLAG_KEY, false)
            }
            if (dialogue) {
                narration.dialogue = (dialogue)
            }

            labelToOpen.forEach((label) => {
                if (label.type === "jump") {
                    narration.jumpLabel(label.label, props)
                }
                else {
                    narration.callLabel(label.label, props)
                }
            })

            if (goNextStep) {
                narration.goNext(props)
            }

            if (end === "game_end") {
                narration.closeAllLabels()
                narration.goNext(props)
            }
            else if (end === "label_end") {
                narration.closeCurrentLabel()
            }
        }
    }

    private async runOperation(origin: PixiVNJsonOperation | PixiVNJsonIfElse<PixiVNJsonOperation>) {
        let operation = getValueFromConditionalStatements(origin)
        if (!operation) {
            return
        }
        switch (operation.type) {
            case "sound":
                switch (operation.operationType) {
                    case "add":
                        sound.add(operation.alias, {
                            ...operation.props,
                            url: operation.url
                        })
                        break
                    case "play":
                        sound.play(operation.alias, operation.props)
                        break
                    case "remove":
                        sound.remove(operation.alias)
                        break
                    case "pause":
                        sound.pause(operation.alias)
                        break
                    case "resume":
                        sound.resume(operation.alias)
                        break
                    case "volume":
                        sound.volume(operation.alias, operation.value)
                        break
                }
                break
            case "image":
                switch (operation.operationType) {
                    case "show":
                        if (operation.transition) {
                            switch (operation.transition.type) {
                                case "fade":
                                    await showWithFadeTransition(operation.alias, operation.url, operation.transition.props, operation.transition.priority)
                                    break
                                case "dissolve":
                                    await showWithDissolveTransition(operation.alias, operation.url, operation.transition.props, operation.transition.priority)
                                    break
                                case "movein":
                                case "moveout":
                                    await moveIn(operation.alias, operation.url, operation.transition.props, operation.transition.priority)
                                    break
                                case "zoomin":
                                case "zoomout":
                                    await zoomIn(operation.alias, operation.url, operation.transition.props, operation.transition.priority)
                                    break
                            }
                        }
                        else {
                            await showImage(operation.alias, operation.url)
                        }
                        break
                    case "edit":
                        let image = canvas.find<CanvasImage>(operation.alias)
                        if (image) {
                            if (operation.props) {
                                image.memory = operation.props
                            }
                        }
                        else {
                            console.error(`[Pixi'VN] Image with alias ${operation.alias} not found.`)
                        }
                        break
                    case "remove":
                        canvas.remove(operation.alias)
                        break
                }
                break
            case "video":
                switch (operation.operationType) {
                    case "show":
                        if (operation.transition) {
                            let video = new CanvasVideo()
                            video.videoLink = operation.url
                            switch (operation.transition.type) {
                                case "fade":
                                    await showWithFadeTransition(operation.alias, video, operation.transition.props, operation.transition.priority)
                                    break
                                case "dissolve":
                                    await showWithDissolveTransition(operation.alias, video, operation.transition.props, operation.transition.priority)
                                    break
                                case "movein":
                                case "moveout":
                                    await moveIn(operation.alias, video, operation.transition.props, operation.transition.priority)
                                    break
                                case "zoomin":
                                case "zoomout":
                                    await zoomIn(operation.alias, video, operation.transition.props, operation.transition.priority)
                                    break
                            }
                        }
                        else {
                            await showVideo(operation.alias, operation.url)
                        }
                        break
                    case "edit":
                        let video = canvas.find<CanvasVideo>(operation.alias)
                        if (video) {
                            if (operation.props) {
                                video.memory = operation.props
                            }
                        }
                        else {
                            console.error(`[Pixi'VN] Video with alias ${operation.alias} not found.`)
                        }
                        break
                    case "remove":
                        canvas.remove(operation.alias)
                        break
                    case "pause":
                        let videoPause = canvas.find<CanvasVideo>(operation.alias)
                        if (videoPause) {
                            videoPause.paused = true
                        }
                        else {
                            console.error(`[Pixi'VN] Video with alias ${operation.alias} not found.`)
                        }
                        break
                    case "resume":
                        let videoResume = canvas.find<CanvasVideo>(operation.alias)
                        if (videoResume) {
                            videoResume.paused = false
                        }
                        else {
                            console.error(`[Pixi'VN] Video with alias ${operation.alias} not found.`)
                        }
                        break
                }
                break
            case "value":
                setStorageJson(operation)
                break
        }
    }
}
