import PixiVNJsonIfElse from "./PixiVNJsonIfElse"
import { PixiVNJsonStorageSet } from "./PixiVNJsonStorage"

type PixiVNJsonOperation = PixiVNJsonStorageSet

type PixiVNJsonOperations = (PixiVNJsonOperation | PixiVNJsonIfElse<PixiVNJsonOperation>)[]

export default PixiVNJsonOperations
