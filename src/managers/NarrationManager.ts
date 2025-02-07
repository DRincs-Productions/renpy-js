import { diff } from "deep-diff";
import { canvas, CanvasManagerStatic, storage } from ".";
import { Dialogue, Label } from "../classes";
import ChoiceMenuOption, { ChoiceMenuOptionClose, IStoratedChoiceMenuOption } from "../classes/ChoiceMenuOption";
import newCloseLabel, { CLOSE_LABEL_ID } from "../classes/CloseLabel";
import LabelAbstract from "../classes/LabelAbstract";
import { getLabelById } from "../decorators/label-decorator";
import { CharacterInterface, HistoryStepData, NarrativeHistory } from "../interface";
import ExportedStep from "../interface/export/ExportedStep";
import {
    ChoiceMenuOptionsType,
    Close,
    DialogueType,
    HistoryChoiceMenuOption,
    InputInfo,
    StorageElementType,
} from "../types";
import ChoicesMadeType from "../types/ChoicesMadeType";
import { LabelIdType } from "../types/LabelIdType";
import { StepLabelPropsType, StepLabelResultType, StepLabelType } from "../types/StepLabelType";
import NarrationManagerStatic from "./NarrationManagerStatic";
import StorageManagerStatic from "./StorageManagerStatic";

/**
 * This class is a class that manages the steps and labels of the game.
 */
export default class NarrationManager {
    /**
     * stepHistory is a list of label events and steps that occurred during the progression of the steps.
     */
    get stepsHistory() {
        return NarrationManagerStatic._stepsHistory;
    }
    /**
     * Counter of execution times of the current step. Current execution is also included.
     * **Attention**: if the step index is edited or the code of step is edited, the counter will be reset.
     * You can restart the counter in this way:
     * ```typescript
     * narration.currentStepTimesCounter = 0
     * ```
     */
    get currentStepTimesCounter(): number {
        return NarrationManagerStatic.getCurrentStepTimesCounter();
    }
    set currentStepTimesCounter(_: 0) {
        NarrationManagerStatic.resetCurrentStepTimesCounter();
    }
    /**
     * Get a random number between min and max.
     * @param min The minimum number.
     * @param max The maximum number.
     * @param options The options.
     * @returns The random number or undefined. If options.onceonly is true and all numbers between min and max have already been generated, it will return undefined.
     */
    getRandomNumber(
        min: number,
        max: number,
        options: {
            /**
             * If true, the number will be generated only once on the current step of the label.
             * @default false
             */
            onceOnly?: boolean;
        } = {}
    ): number | undefined {
        return NarrationManagerStatic.getRandomNumber(min, max, options);
    }
    /**
     * lastStepIndex is the last step index that occurred during the progression of the steps. **Not is the length of the stepsHistory - 1.**
     */
    get lastStepIndex() {
        return NarrationManagerStatic._lastStepIndex;
    }
    /**
     * The stack of the opened labels.
     */
    get openedLabels() {
        return NarrationManagerStatic._openedLabels;
    }
    /**
     * currentLabel is the current label that occurred during the progression of the steps.
     */
    get currentLabel(): Label | undefined {
        return NarrationManagerStatic._currentLabel;
    }

    /* Edit History Methods */

    /**
     * Add a label to the history.
     * @param label The label to add to the history.
     */
    private addStepHistory(stepSha: string, choiseMade?: number) {
        let currentStepData: HistoryStepData = NarrationManagerStatic.currentStepData;
        if (NarrationManagerStatic.originalStepData) {
            if (NarrationManagerStatic.originalStepData.openedLabels.length === currentStepData.openedLabels.length) {
                try {
                    let lastStepDataOpenedLabelsString = JSON.stringify(
                        NarrationManagerStatic.originalStepData.openedLabels
                    );
                    let historyStepOpenedLabelsString = JSON.stringify(currentStepData.openedLabels);
                    if (
                        lastStepDataOpenedLabelsString === historyStepOpenedLabelsString &&
                        NarrationManagerStatic.originalStepData.path === currentStepData.path &&
                        NarrationManagerStatic.originalStepData.labelIndex === currentStepData.labelIndex
                    ) {
                        return;
                    }
                } catch (e) {
                    console.error("[Pixi’VN] Error comparing openedLabels", e);
                }
            }
        }
        let data = diff(NarrationManagerStatic.originalStepData, currentStepData);
        if (data) {
            let dialoge: Dialogue | undefined = undefined;
            let requiredChoices: IStoratedChoiceMenuOption[] | undefined = undefined;
            let inputValue: StorageElementType | undefined = undefined;
            if (
                storage.getVariable<number>(storage.keysSystem.LAST_DIALOGUE_ADDED_IN_STEP_MEMORY_KEY) ===
                this.lastStepIndex
            ) {
                dialoge = this.dialogue;
            }
            if (
                storage.getVariable<number>(storage.keysSystem.LAST_MENU_OPTIONS_ADDED_IN_STEP_MEMORY_KEY) ===
                this.lastStepIndex
            ) {
                requiredChoices = storage.getVariable<IStoratedChoiceMenuOption[]>(
                    storage.keysSystem.CURRENT_MENU_OPTIONS_MEMORY_KEY
                );
            }
            if (
                storage.getVariable<StorageElementType>(storage.keysSystem.LAST_INPUT_ADDED_IN_STEP_MEMORY_KEY) ===
                this.lastStepIndex
            ) {
                inputValue = storage.getVariable<IStoratedChoiceMenuOption[]>(
                    storage.keysSystem.CURRENT_INPUT_VALUE_MEMORY_KEY
                );
            }
            NarrationManagerStatic._stepsHistory.push({
                diff: data,
                currentLabel: NarrationManagerStatic.currentLabelId,
                dialoge: dialoge,
                choices: requiredChoices,
                stepSha1: stepSha,
                index: this.lastStepIndex,
                labelStepIndex: NarrationManagerStatic.currentLabelStepIndex,
                choiceIndexMade: choiseMade,
                inputValue: inputValue,
                alreadyMadeChoices: this.alreadyCurrentStepMadeChoices,
            });
            NarrationManagerStatic.originalStepData = currentStepData;
        }
        NarrationManagerStatic.increaseLastStepIndex();
    }
    /**
     * Close the current label and add it to the history.
     * @returns
     */
    closeCurrentLabel() {
        if (!NarrationManagerStatic.currentLabelId) {
            console.warn("[Pixi’VN] No label to close");
            return;
        }
        if (!this.currentLabel) {
            console.error("[Pixi’VN] currentLabel not found");
            return;
        }
        NarrationManagerStatic._openedLabels.pop();
        StorageManagerStatic.clearOldTempVariables(this.openedLabels.length);
    }
    /**
     * Close all labels and add them to the history. **Attention: This method can cause an unhandled game ending.**
     */
    closeAllLabels() {
        while (NarrationManagerStatic._openedLabels.length > 0) {
            this.closeCurrentLabel();
            StorageManagerStatic.clearOldTempVariables(this.openedLabels.length);
        }
    }
    /**
     * Get the narrative history
     * @returns the history of the dialogues, choices and steps
     */
    public get narrativeHistory(): NarrativeHistory[] {
        let list: NarrativeHistory[] = [];
        NarrationManagerStatic._stepsHistory.forEach((step) => {
            let dialoge = step.dialoge;
            let requiredChoices = step.choices;
            let inputValue = step.inputValue;
            if (
                list.length > 0 &&
                list[list.length - 1].choices &&
                !list[list.length - 1].playerMadeChoice &&
                step.currentLabel
            ) {
                let oldChoices = list[list.length - 1].choices;
                if (oldChoices) {
                    let choiceMade = false;
                    if (step.choiceIndexMade !== undefined && oldChoices.length > step.choiceIndexMade) {
                        oldChoices[step.choiceIndexMade].isResponse = true;
                        choiceMade = true;
                    }
                    list[list.length - 1].playerMadeChoice = choiceMade;
                    list[list.length - 1].choices = oldChoices;
                }
            }
            if (inputValue && list.length > 0) {
                list[list.length - 1].inputValue = inputValue;
            }
            if (dialoge || requiredChoices) {
                let choices: HistoryChoiceMenuOption[] | undefined = requiredChoices?.map((choice, index) => {
                    let hidden: boolean = false;
                    if (choice.oneTime && step.alreadyMadeChoices && step.alreadyMadeChoices.includes(index)) {
                        hidden = true;
                    }
                    return {
                        text: choice.text,
                        type: choice.type,
                        isResponse: false,
                        hidden: hidden,
                    };
                });
                // if all choices are hidden find onlyHaveNoChoice
                if (choices && choices.every((choice) => choice.hidden)) {
                    let onlyHaveNoChoice = choices.find((choice) => choice.hidden === false);
                    if (onlyHaveNoChoice) {
                        onlyHaveNoChoice.hidden = false;
                    }
                }
                list.push({
                    dialoge: dialoge,
                    playerMadeChoice: false,
                    choices: choices,
                    stepIndex: step.index,
                });
            }
        });
        return list;
    }
    /**
     * Delete the narrative history.
     * @param itemsNumber The number of items to delete. If undefined, all items will be deleted.
     */
    removeNarrativeHistory(itemsNumber?: number) {
        if (itemsNumber) {
            // remove the first items
            NarrationManagerStatic._stepsHistory.splice(0, itemsNumber);
        } else {
            NarrationManagerStatic._stepsHistory = [];
        }
    }
    /**
     * Check if the label is already completed.
     * @param label The label to check.
     * @returns True if the label is already completed.
     */
    public isLabelAlreadyCompleted<Label extends LabelAbstract<any>>(label: LabelIdType | Label): boolean {
        let labelId: LabelIdType;
        if (typeof label === "string") {
            labelId = label;
        } else {
            labelId = label.id;
        }
        let allOpenedLabels = NarrationManagerStatic.allOpenedLabels;
        let lastStep = allOpenedLabels[labelId]?.biggestStep || 0;
        if (lastStep) {
            let currentLabel = getLabelById(labelId);
            if (currentLabel) {
                return currentLabel.steps.length <= lastStep;
            }
        }
        return false;
    }
    private get alreadyCurrentStepMadeChoicesObj(): ChoicesMadeType[] | undefined {
        let currentLabelStepIndex = NarrationManagerStatic.currentLabelStepIndex;
        let currentLabel = this.currentLabel;
        if (currentLabelStepIndex === null || !currentLabel) {
            return;
        }
        let stepSha = currentLabel.getStepSha1(currentLabelStepIndex);
        if (!stepSha) {
            console.warn("[Pixi’VN] stepSha not found");
        }
        return NarrationManagerStatic.allChoicesMade.filter((choice) => {
            return (
                choice.labelId === currentLabel?.id &&
                choice.stepIndex === currentLabelStepIndex &&
                choice.stepSha1 === stepSha
            );
        });
    }
    /**
     * Get the choices already made in the current step. **Attention**: if the choice step index is edited or the code of choice step is edited, the result will be wrong.
     * @returns The choices already made in the current step. If there are no choices, it will return undefined.
     */
    public get alreadyCurrentStepMadeChoices(): number[] | undefined {
        return this.alreadyCurrentStepMadeChoicesObj?.map((choice) => choice.choiceIndex);
    }
    /**
     * Check if the current step is already completed.
     * @returns True if the current step is already completed.
     */
    public get isCurrentStepAlreadyOpened(): boolean {
        let currentLabel = NarrationManagerStatic.currentLabelId;
        if (currentLabel) {
            let lastStep = NarrationManagerStatic.allOpenedLabels[currentLabel]?.openCount || 0;
            if (
                NarrationManagerStatic.currentLabelStepIndex &&
                lastStep >= NarrationManagerStatic.currentLabelStepIndex
            ) {
                return true;
            }
        }
        return false;
    }
    /**
     * Get times a label has been opened
     * @returns times a label has been opened
     */
    public getTimesLabelOpened(label: LabelIdType): number {
        return NarrationManagerStatic.allOpenedLabels[label]?.openCount || 0;
    }
    /**
     * Get times a choice has been made in the current step.
     * @param index The index of the choice.
     * @returns The number of times the choice has been made.
     */
    public getTimesChoiceMade(index: number): number {
        return this.alreadyCurrentStepMadeChoicesObj?.find((choice) => choice.choiceIndex === index)?.madeTimes || 0;
    }

    /* Run Methods */

    private getCanGoNext(options?: {
        /**
         * If true, show a warning in the console.
         * @default false
         */
        showWarn?: boolean;
    }): boolean {
        let showWarn = options?.showWarn || false;
        let choiceMenuOptions = this.choiceMenuOptions;
        if (choiceMenuOptions && choiceMenuOptions.length > 0) {
            showWarn && console.warn("[Pixi’VN] The player must make a choice");
            return false;
        }
        if (this.isRequiredInput) {
            showWarn && console.warn("[Pixi’VN] The player must enter a value");
            return false;
        }
        return true;
    }
    /**
     * Return if can go to the next step.
     * @returns True if can go to the next step.
     */
    get canGoNext(): boolean {
        if (NarrationManagerStatic.stepsRunning !== 0) {
            return false;
        }
        return this.getCanGoNext();
    }
    /**
     * Execute the next step and add it to the history. If a step is already running, it will put the request in the queue,
     * and when the step is finished, it will execute the next step.
     * @param props The props to pass to the step.
     * @param options The options.
     * @returns StepLabelResultType or undefined.
     * @example
     * ```typescript
     *     function nextOnClick() {
     *     setLoading(true)
     *     narration.goNext(yourParams)
     *         .then((result) => {
     *             setUpdate((p) => p + 1)
     *             setLoading(false)
     *             if (result) {
     *                 // your code
     *             }
     *         })
     *         .catch((e) => {
     *             setLoading(false)
     *             console.error(e)
     *         })
     * }
     * ```
     */
    public async goNext(
        props: StepLabelPropsType,
        options: {
            /**
             * The index of the choise made by the player. (This params is used in the choice menu)
             */
            choiseMade?: number;
            /**
             * If true, ignore the running step, ignore the choice menu/required input and run the next step immediately.
             */
            runNow?: boolean;
        } = {}
    ): Promise<StepLabelResultType> {
        const { runNow = false } = options;
        if (!runNow && !this.getCanGoNext({ showWarn: true })) {
            return;
        }
        if (!runNow && NarrationManagerStatic.stepsRunning !== 0) {
            NarrationManagerStatic.goNextRequests++;
            return;
        }
        if (this.currentLabel && this.currentLabel.onStepEnd) {
            await this.currentLabel.onStepEnd(NarrationManagerStatic.currentLabelStepIndex || 0, this.currentLabel);
        }
        if (NarrationManagerStatic.stepsRunning === 0) {
            CanvasManagerStatic._tickersToCompleteOnStepEnd.tikersIds.forEach(({ id }) => {
                canvas.forceCompletionOfTicker(id);
            });
            CanvasManagerStatic._tickersToCompleteOnStepEnd.stepAlias.forEach(({ alias, id }) => {
                canvas.forceCompletionOfTicker(id, alias);
            });
            CanvasManagerStatic._tickersToCompleteOnStepEnd = { tikersIds: [], stepAlias: [] };
        }
        NarrationManagerStatic.increaseCurrentStepIndex();
        return await this.runCurrentStep(props, options);
    }
    /**
     * Execute the current step and add it to the history.
     * @param props The props to pass to the step.
     * @param options The options.
     * @returns StepLabelResultType or undefined.
     */
    private async runCurrentStep<T extends {}>(
        props: StepLabelPropsType<T>,
        options: {
            /**
             * The index of the choise made by the player. (This params is used in the choice menu)
             */
            choiseMade?: number;
        } = {}
    ): Promise<StepLabelResultType> {
        const { choiseMade } = options;
        if (NarrationManagerStatic.currentLabelId) {
            let currentLabelStepIndex = NarrationManagerStatic.currentLabelStepIndex;
            if (currentLabelStepIndex === null) {
                console.error("[Pixi’VN] currentLabelStepIndex is null");
                return;
            }
            let currentLabel = NarrationManagerStatic._currentLabel as Label<T> | undefined;
            if (!currentLabel) {
                console.error("[Pixi’VN] currentLabel not found");
                return;
            }
            if (currentLabel.steps.length > currentLabelStepIndex) {
                let onStepRun = currentLabel.onStepStart;
                if (onStepRun) {
                    await onStepRun(currentLabelStepIndex, currentLabel);
                }
                let step = currentLabel.steps[currentLabelStepIndex];
                let stepSha = currentLabel.getStepSha1(currentLabelStepIndex);
                if (!stepSha) {
                    console.warn("[Pixi’VN] stepSha not found");
                }
                try {
                    NarrationManagerStatic.stepsRunning++;
                    let result = await step(props, { labelId: currentLabel.id });

                    if (this.choiceMenuOptions?.length === 1 && this.choiceMenuOptions[0].autoSelect) {
                        let choice = this.choiceMenuOptions[0];
                        result = await this.selectChoice(choice, props);
                    }

                    if (choiseMade !== undefined && NarrationManagerStatic._stepsHistory.length > 0) {
                        let lastHistoryStep =
                            NarrationManagerStatic._stepsHistory[NarrationManagerStatic._stepsHistory.length - 1];
                        NarrationManagerStatic.addChoicesMade(
                            lastHistoryStep.currentLabel || "error",
                            typeof lastHistoryStep.labelStepIndex === "number" ? lastHistoryStep.labelStepIndex : -1,
                            lastHistoryStep.stepSha1 || "error",
                            choiseMade
                        );
                        NarrationManagerStatic.choiseMadeTemp = choiseMade;
                    }

                    NarrationManagerStatic.stepsRunning--;
                    if (NarrationManagerStatic.stepsRunning === 0) {
                        NarrationManagerStatic.addLabelHistory(currentLabel.id, currentLabelStepIndex);
                        this.addStepHistory(stepSha || "error", NarrationManagerStatic.choiseMadeTemp);
                        NarrationManagerStatic.choiseMadeTemp = undefined;

                        if (NarrationManagerStatic.goNextRequests > 0) {
                            NarrationManagerStatic.goNextRequests--;
                            return await this.goNext(props);
                        }
                    }
                    return result;
                } catch (e) {
                    // TODO: It might be useful to revert to the original state to avoid errors, but I don't have the browser to do that and I haven't asked for it yet.
                    // await GameStepManager.restoreFromHistoryStep(GameStepManager.originalStepData, navigate)
                    console.error("[Pixi’VN] Error running step", e);
                    if (this.onStepError) {
                        this.onStepError(e, props);
                    }
                    return;
                }
            } else if (this.openedLabels.length > 1) {
                this.closeCurrentLabel();
                return await this.goNext(props, options);
            } else if (this.openedLabels.length === 1) {
                NarrationManagerStatic.restoreLastLabelList();
                if (this.onGameEnd) {
                    return await this.onGameEnd(props, { labelId: "end" });
                }
                return;
            }
        } else if (this.openedLabels.length === 0) {
            NarrationManagerStatic.restoreLastLabelList();
            if (this.onGameEnd) {
                return await this.onGameEnd(props, { labelId: "end" });
            }
            console.error(
                "[Pixi’VN] The end of the game is not managed, so the game is blocked. Read this documentation to know how to manage the end of the game: https://pixi-vn.web.app/start/other-narrative-features.html#how-manage-the-end-of-the-game"
            );
            return;
        } else {
            console.error("[Pixi’VN] currentLabelId not found");
        }
    }
    /**
     * Execute the label and add it to the history. (It's similar to Ren'Py's call function)
     * @param label The label to execute or the id of the label
     * @param props The props to pass to the label.
     * @returns StepLabelResultType or undefined.
     * @example
     * ```typescript
     * narration.callLabel(startLabel, yourParams).then((result) => {
     *     if (result) {
     *         // your code
     *     }
     * })
     * ```
     * @example
     * ```typescript
     * // if you use it in a step label you should return the result.
     * return narration.callLabel(startLabel).then((result) => {
     *     return result
     * })
     * ```
     */
    public async callLabel<T extends {} = {}>(
        label: Label<T> | LabelIdType,
        props: StepLabelPropsType<T>
    ): Promise<StepLabelResultType> {
        let choiseMade: number | undefined = undefined;
        let labelId: LabelIdType;
        if (typeof label === "string") {
            labelId = label;
        } else {
            labelId = label.id;
            if (typeof label.choiseIndex === "number") {
                choiseMade = label.choiseIndex;
            }
        }
        try {
            if (labelId === CLOSE_LABEL_ID) {
                let closeCurrentLabel = newCloseLabel<T>(choiseMade);
                let choice: ChoiceMenuOptionClose<T> = {
                    label: closeCurrentLabel,
                    text: "",
                    closeCurrentLabel: false,
                    type: "close",
                    oneTime: false,
                    onlyHaveNoChoice: false,
                    autoSelect: false,
                    props: {},
                };
                return this.closeChoiceMenu(choice, props);
            }
            let tempLabel = getLabelById<Label<T>>(labelId);
            if (!tempLabel) {
                throw new Error(`[Pixi’VN] Label ${labelId} not found`);
            }

            if (this.currentLabel && this.currentLabel.onStepEnd) {
                await this.currentLabel.onStepEnd(NarrationManagerStatic.currentLabelStepIndex || 0, this.currentLabel);
            }
            NarrationManagerStatic.pushNewLabel(tempLabel.id);
        } catch (e) {
            console.error("[Pixi’VN] Error calling label", e);
            return;
        }
        return await this.runCurrentStep<T>(props, { choiseMade: choiseMade });
    }
    /**
     * Execute the label, close the current label, execute the new label and add the new label to the history. (It's similar to Ren'Py's jump function)
     * @param label The label to execute.
     * @param props The props to pass to the label or the id of the label
     * @returns StepLabelResultType or undefined.
     * @example
     * ```typescript
     * narration.jumpLabel(startLabel, yourParams).then((result) => {
     *     if (result) {
     *         // your code
     *     }
     * })
     * ```
     * @example
     * ```typescript
     * // if you use it in a step label you should return the result.
     * return narration.jumpLabel(startLabel).then((result) => {
     *     return result
     * })
     * ```
     */
    public async jumpLabel<T extends {}>(
        label: Label<T> | LabelIdType,
        props: StepLabelPropsType<T>
    ): Promise<StepLabelResultType> {
        this.closeCurrentLabel();
        let choiseMade: number | undefined = undefined;
        let labelId: LabelIdType;
        if (typeof label === "string") {
            labelId = label;
        } else {
            labelId = label.id;
            if (typeof label.choiseIndex === "number") {
                choiseMade = label.choiseIndex;
            }
        }
        try {
            if (labelId === CLOSE_LABEL_ID) {
                let closeCurrentLabel = newCloseLabel<T>(choiseMade);
                let choice: ChoiceMenuOptionClose<T> = {
                    label: closeCurrentLabel,
                    text: "",
                    closeCurrentLabel: false,
                    type: "close",
                    oneTime: false,
                    onlyHaveNoChoice: false,
                    autoSelect: false,
                    props: {},
                };
                return this.closeChoiceMenu<T>(choice, props);
            }
            let tempLabel = getLabelById<Label<T>>(labelId);
            if (!tempLabel) {
                throw new Error(`[Pixi’VN] Label ${labelId} not found`);
            }

            if (this.currentLabel && this.currentLabel.onStepEnd) {
                await this.currentLabel.onStepEnd(NarrationManagerStatic.currentLabelStepIndex || 0, this.currentLabel);
            }
            NarrationManagerStatic.pushNewLabel(tempLabel.id);
        } catch (e) {
            console.error("[Pixi’VN] Error jumping label", e);
            return;
        }
        return await this.runCurrentStep<T>(props, { choiseMade: choiseMade });
    }
    /**
     * Select a choice from the choice menu. and close the choice menu.
     * @param item
     * @param props
     * @returns
     * @example
     * ```typescript
     * narration.selectChoice(item, {
     *     navigate: navigate,
     *     // your props
     *     ...item.props
     * })
     *     .then(() => {
     *         // your code
     *     })
     *     .catch((e) => {
     *         // your code
     *     })
     * ```
     */
    public async selectChoice<T extends {}>(
        item: ChoiceMenuOptionClose | ChoiceMenuOption<T>,
        props: StepLabelPropsType<T>
    ): Promise<StepLabelResultType> {
        this.choiceMenuOptions = undefined;
        if (item.type == "call") {
            return await this.callLabel(item.label, { ...item.props, ...props });
        } else if (item.type == "jump") {
            return await this.jumpLabel(item.label, { ...item.props, ...props });
        } else if (item.type == "close") {
            return await this.closeChoiceMenu(item, { ...item.props, ...props });
        } else {
            throw new Error(`[Pixi’VN] Type ${item.type} not found`);
        }
    }
    /**
     * When the player is in a choice menu, can use this function to exit to the choice menu.
     * @param choice
     * @param props
     * @returns StepLabelResultType or undefined.
     * @example
     * ```typescript
     * narration.closeChoiceMenu(yourParams).then((result) => {
     *     if (result) {
     *         // your code
     *     }
     * })
     * ```
     */
    public async closeChoiceMenu<T extends {} = {}>(
        choice: ChoiceMenuOptionClose<T>,
        props: StepLabelPropsType<T>
    ): Promise<StepLabelResultType> {
        let label: Label<T> = choice.label;
        let choiseMade: number | undefined = undefined;
        if (typeof label.choiseIndex === "number") {
            choiseMade = label.choiseIndex;
        }
        if (choice.closeCurrentLabel) {
            this.closeCurrentLabel();
        }
        return this.goNext(props, { choiseMade: choiseMade });
    }

    /* Go Back & Refresh Methods */

    /**
     * Go back to the last step and add it to the history.
     * @param navigate The navigate function.
     * @param steps The number of steps to go back.
     * @returns
     * @example
     * ```typescript
     * export function goBack(navigate: (path: string) => void, afterBack?: () => void) {
     *     narration.goBack(navigate)
     *     afterBack && afterBack()
     * }
     * ```
     */
    public async goBack(navigate: (path: string) => void, steps: number = 1) {
        if (steps <= 0) {
            console.warn("[Pixi’VN] Steps must be greater than 0");
            return;
        }
        if (NarrationManagerStatic._stepsHistory.length <= 1) {
            console.warn("[Pixi’VN] No steps to go back");
            return;
        }
        let restoredStep = NarrationManagerStatic.goBackInternal(steps, NarrationManagerStatic.originalStepData);
        if (restoredStep) {
            await NarrationManagerStatic.restoreFromHistoryStep(restoredStep, navigate);
        } else {
            console.error("[Pixi’VN] Error going back");
        }
    }

    /**
     * Return true if it is possible to go back.
     */
    public get canGoBack(): boolean {
        return NarrationManagerStatic._stepsHistory.length > 1;
    }

    /**
     * Function to be executed at the end of the game. It should be set in the game initialization.
     * @example
     * ```typescript
     * narration.onGameEnd = async (props) => {
     *    props.navigate("/end")
     * }
     * ```
     */
    public onGameEnd: StepLabelType | undefined = undefined;
    /**
     * Function to be executed when an error occurs in the step.
     * @example
     * ```typescript
     * narration.onStepError = (error, props) => {
     *    props.notify("An error occurred")
     *    // send a notification to GlitchTip, Sentry, etc...
     * }
     * ```
     */
    public onStepError: ((error: any, props: StepLabelPropsType) => void) | undefined = undefined;

    /**
     * Dialogue to be shown in the game
     */
    public get dialogue(): Dialogue | undefined {
        return storage.getVariable<DialogueType>(storage.keysSystem.CURRENT_DIALOGUE_MEMORY_KEY) as Dialogue;
    }
    public set dialogue(
        props:
            | {
                  character: string | CharacterInterface;
                  text: string | string[];
              }
            | string
            | string[]
            | Dialogue
            | undefined
    ) {
        if (!props) {
            storage.setVariable(storage.keysSystem.CURRENT_DIALOGUE_MEMORY_KEY, undefined);
            return;
        }
        let text = "";
        let character: string | undefined = undefined;
        let dialogue: Dialogue;
        if (typeof props === "string") {
            text = props;
            dialogue = new Dialogue(text, character);
        } else if (Array.isArray(props)) {
            text = props.join();
            dialogue = new Dialogue(text, character);
        } else if (!(props instanceof Dialogue)) {
            if (Array.isArray(props.text)) {
                text = props.text.join();
            } else {
                text = props.text;
            }
            if (props.character) {
                if (typeof props.character === "string") {
                    character = props.character;
                } else {
                    character = props.character.id;
                }
            }
            dialogue = new Dialogue(text, character);
        } else {
            dialogue = props;
        }

        if (this.dialogGlue) {
            let glueDialogue = storage.getVariable<DialogueType>(
                storage.keysSystem.CURRENT_DIALOGUE_MEMORY_KEY
            ) as Dialogue;
            if (glueDialogue) {
                dialogue.text = `${glueDialogue.text}${dialogue.text}`;
                dialogue.character = dialogue.character || glueDialogue.character;
            }
            this.dialogGlue = false;
        }

        storage.setVariable(storage.keysSystem.CURRENT_DIALOGUE_MEMORY_KEY, dialogue as DialogueType);
        storage.setVariable(storage.keysSystem.LAST_DIALOGUE_ADDED_IN_STEP_MEMORY_KEY, this.lastStepIndex);
    }
    /**
     * The options to be shown in the game
     * @example
     * ```typescript
     * narration.choiceMenuOptions = [
     *     new ChoiceMenuOption("Events Test", EventsTestLabel, {}),
     *     new ChoiceMenuOption("Show Image Test", ShowImageTest, { image: "imageId" }, "call"),
     *     new ChoiceMenuOption("Ticker Test", TickerTestLabel, {}),
     *     new ChoiceMenuOption("Tinting Test", TintingTestLabel, {}, "jump"),
     *     new ChoiceMenuOption("Base Canvas Element Test", BaseCanvasElementTestLabel, {})
     * ]
     * ```
     */
    public get choiceMenuOptions(): ChoiceMenuOptionsType<{ [key: string | number | symbol]: any }> | undefined {
        let d = storage.getVariable<IStoratedChoiceMenuOption[]>(storage.keysSystem.CURRENT_MENU_OPTIONS_MEMORY_KEY);
        if (d) {
            let options: ChoiceMenuOptionsType = [];
            let onlyHaveNoChoice: ChoiceMenuOptionsType = [];
            d.forEach((option, index) => {
                if (option.type === Close) {
                    let itemLabel = newCloseLabel(index);
                    let choice = new ChoiceMenuOptionClose(option.text, {
                        closeCurrentLabel: option.closeCurrentLabel,
                        oneTime: option.oneTime,
                        onlyHaveNoChoice: option.onlyHaveNoChoice,
                        autoSelect: option.autoSelect,
                    });
                    choice.label = itemLabel;
                    options.push(choice);
                    return;
                }
                let label = getLabelById(option.label);
                if (label) {
                    let itemLabel = new Label(label.id, label.steps, {
                        onStepStart: label.onStepStart,
                        choiseIndex: index,
                    });
                    options.push(
                        new ChoiceMenuOption(option.text, itemLabel, option.props, {
                            type: option.type,
                            oneTime: option.oneTime,
                            onlyHaveNoChoice: option.onlyHaveNoChoice,
                            autoSelect: option.autoSelect,
                        })
                    );
                }
            });
            let alreadyChoices = this.alreadyCurrentStepMadeChoices;
            options = options.filter((option, index) => {
                if (option.oneTime) {
                    if (alreadyChoices && alreadyChoices.includes(index)) {
                        return false;
                    }
                }
                if (option.onlyHaveNoChoice) {
                    onlyHaveNoChoice.push(option);
                    return false;
                }
                return true;
            });
            if (options.length > 0) {
                return options;
            } else if (onlyHaveNoChoice.length > 0) {
                let firstOption = onlyHaveNoChoice[0];
                return [firstOption];
            }
        }
        return undefined;
    }
    public set choiceMenuOptions(options: ChoiceMenuOptionsType<any> | undefined) {
        if (!options) {
            storage.setVariable(storage.keysSystem.CURRENT_MENU_OPTIONS_MEMORY_KEY, undefined);
            return;
        }
        let value: IStoratedChoiceMenuOption[] = options.map((option) => {
            if (option instanceof ChoiceMenuOptionClose) {
                return {
                    text: option.text,
                    type: Close,
                    closeCurrentLabel: option.closeCurrentLabel,
                    oneTime: option.oneTime,
                    onlyHaveNoChoice: option.onlyHaveNoChoice,
                    autoSelect: option.autoSelect,
                };
            }
            return {
                ...option,
                label: option.label.id,
            };
        });
        storage.setVariable(storage.keysSystem.CURRENT_MENU_OPTIONS_MEMORY_KEY, value);
        storage.setVariable(storage.keysSystem.LAST_MENU_OPTIONS_ADDED_IN_STEP_MEMORY_KEY, this.lastStepIndex);
    }
    /**
     * If true, the next dialogue text will be added to the current dialogue text.
     */
    public get dialogGlue(): boolean {
        return storage.getFlag(storage.keysSystem.ADD_NEXT_DIALOG_TEXT_INTO_THE_CURRENT_DIALOG_FLAG_KEY);
    }
    public set dialogGlue(value: boolean) {
        storage.setFlag(storage.keysSystem.ADD_NEXT_DIALOG_TEXT_INTO_THE_CURRENT_DIALOG_FLAG_KEY, value);
    }
    /**
     * The input value to be inserted by the player.
     */
    public get inputValue(): unknown {
        return storage.getVariable(storage.keysSystem.CURRENT_INPUT_VALUE_MEMORY_KEY);
    }
    public set inputValue(value: StorageElementType) {
        this.removeInputRequest();
        storage.setVariable(storage.keysSystem.CURRENT_INPUT_VALUE_MEMORY_KEY, value);
        storage.setVariable(storage.keysSystem.LAST_INPUT_ADDED_IN_STEP_MEMORY_KEY, this.lastStepIndex);
    }
    /**
     * If true, the player must enter a value.
     */
    public get isRequiredInput(): boolean {
        return storage.getVariable<InputInfo>(storage.keysSystem.CURRENT_INPUT_INFO_MEMORY_KEY)?.isRequired || false;
    }
    public get inputType(): string | undefined {
        return storage.getVariable<InputInfo>(storage.keysSystem.CURRENT_INPUT_INFO_MEMORY_KEY)?.type;
    }
    /**
     * Request input from the player.
     * @param info The input value to be inserted by the player.
     * @param defaultValue The default value to be inserted.
     */
    public requestInput(info: Omit<InputInfo, "isRequired">, defaultValue?: StorageElementType) {
        (info as InputInfo).isRequired = true;
        storage.setVariable(storage.keysSystem.CURRENT_INPUT_INFO_MEMORY_KEY, info);
        if (defaultValue !== undefined) {
            storage.setVariable(storage.keysSystem.CURRENT_INPUT_VALUE_MEMORY_KEY, defaultValue);
        } else {
            storage.removeVariable(storage.keysSystem.CURRENT_INPUT_VALUE_MEMORY_KEY);
        }
    }
    /**
     * Remove the input request.
     */
    public removeInputRequest() {
        storage.removeVariable(storage.keysSystem.CURRENT_INPUT_INFO_MEMORY_KEY);
        storage.removeVariable(storage.keysSystem.CURRENT_INPUT_VALUE_MEMORY_KEY);
    }

    /**
     * Add a label to the history.
     */
    public clear() {
        NarrationManagerStatic._stepsHistory = [];
        NarrationManagerStatic._openedLabels = [];
        NarrationManagerStatic._lastStepIndex = 0;
        NarrationManagerStatic._originalStepData = undefined;
    }

    /* Export and Import Methods */

    /**
     * Export the history to a JSON string.
     * @returns The history in a JSON string.
     */
    public exportJson(): string {
        return JSON.stringify(this.export());
    }
    /**
     * Export the history to an object.
     * @returns The history in an object.
     */
    public export(): ExportedStep {
        return {
            stepsHistory: NarrationManagerStatic._stepsHistory,
            openedLabels: NarrationManagerStatic._openedLabels,
            lastStepIndex: this.lastStepIndex,
            originalStepData: NarrationManagerStatic._originalStepData,
        };
    }
    /**
     * Import the history from a JSON string.
     * @param dataString The history in a JSON string.
     */
    public async importJson(dataString: string) {
        await this.import(JSON.parse(dataString));
    }
    /**
     * Import the history from an object.
     * @param data The history in an object.
     */
    public async import(data: object) {
        this.clear();
        try {
            if (data.hasOwnProperty("stepsHistory")) {
                NarrationManagerStatic._stepsHistory = (data as ExportedStep)["stepsHistory"];
            } else {
                console.warn("[Pixi’VN] Could not import stepsHistory data, so will be ignored");
            }
            if (data.hasOwnProperty("openedLabels")) {
                NarrationManagerStatic._openedLabels = (data as ExportedStep)["openedLabels"];
            } else {
                console.warn("[Pixi’VN] Could not import openedLabels data, so will be ignored");
            }
            if (data.hasOwnProperty("lastStepIndex")) {
                NarrationManagerStatic._lastStepIndex = (data as ExportedStep)["lastStepIndex"];
            } else {
                console.warn("[Pixi’VN] Could not import lastStepIndex data, so will be ignored");
            }
            if (data.hasOwnProperty("originalStepData")) {
                NarrationManagerStatic._originalStepData = (data as ExportedStep)["originalStepData"];
            } else {
                console.warn("[Pixi’VN] Could not import originalStepData data, so will be ignored");
            }

            if (this.currentLabel && this.currentLabel.onLoadingLabel) {
                await this.currentLabel.onLoadingLabel(
                    NarrationManagerStatic.currentLabelStepIndex || 0,
                    this.currentLabel
                );
                for (let i = 0; i < this.openedLabels.length; i++) {
                    let labelInfo = this.openedLabels[i];
                    let label = getLabelById(labelInfo.label);
                    if (label && label.onLoadingLabel) {
                        await label.onLoadingLabel(labelInfo.currentStepIndex, label);
                    }
                }
            }
        } catch (e) {
            console.error("[Pixi’VN] Error importing data", e);
        }
    }
}
