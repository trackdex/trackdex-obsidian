/**
 * Entry for scripts/measure-bundle.mjs — fit-file-parser candidate weight.
 * Not loaded by the Obsidian plugin at runtime.
 */
import FitParser from "fit-file-parser";

export function touchFitFileParserBundle(): void {
	void FitParser;
}

touchFitFileParserBundle();
