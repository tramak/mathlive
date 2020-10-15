import type { Mathfield } from './public/mathfield';
import type { MathfieldOptions, TextToSpeechOptions } from './public/options';
import type {
    ErrorListener,
    ParserErrorCode,
    MathfieldErrorCode,
} from './public/core';

import { decompose } from './core/atom-utils';
import { parseString } from './core/parser';
import { coalesce, makeSpan, makeStruts } from './core/span';
import { MACROS, MacroDictionary } from './core/definitions';
import { MathfieldPrivate } from './editor/mathfield-class';
import AutoRender from './addons/auto-render';
import {
    MathJsonLatexOptions,
    MathJson,
    atomtoMathJson,
    jsonToLatex,
} from './addons/math-json';
import MathLiveDebug from './addons/debug';
import { MATHSTYLES } from './core/mathstyle';
import { defaultSpeakHook } from './editor/speech';
import {
    defaultReadAloudHook,
    readAloudStatus,
    pauseReadAloud,
    resumeReadAloud,
    playReadAloud,
} from './editor/speech-read-aloud';
import { atomToSpeakableText } from './editor/atom-to-speakable-text';
import { atomsToMathML } from './addons/math-ml';

import './addons/definitions-metadata';
import { AutoRenderOptionsPrivate } from './addons/auto-render';

export { MathfieldElement } from './public/mathfield-element';

export function makeMathField(
    element: HTMLElement,
    options: Partial<MathfieldOptions> = {}
): Mathfield {
    options.speakHook = options.speakHook ?? defaultSpeakHook;
    options.readAloudHook = options.readAloudHook ?? defaultReadAloudHook;
    return new MathfieldPrivate(getElement(element), options);
}

/** @deprecated */
function latexToMarkup(
    text: string,
    options?: {
        mathstyle?: 'displaystyle' | 'textstyle';
        letterShapeStyle?: 'tex' | 'french' | 'iso' | 'upright' | 'auto';
        macros?: MacroDictionary;
        onError?: ErrorListener<ParserErrorCode>;
        format?: string;
    }
): string {
    return convertLatexToMarkup(text, options);
}

export function convertLatexToMarkup(
    text: string,
    options?: {
        mathstyle?: 'displaystyle' | 'textstyle';
        letterShapeStyle?: 'tex' | 'french' | 'iso' | 'upright' | 'auto';
        macros?: MacroDictionary;
        onError?: ErrorListener<ParserErrorCode>;
        format?: string;
    }
): string {
    options = options ?? {};
    options.mathstyle = options.mathstyle || 'displaystyle';
    options.letterShapeStyle = options.letterShapeStyle || 'auto';
    options.macros = { ...MACROS, ...(options.macros ?? {}) };

    //
    // 1. Parse the formula and return a tree of atoms, e.g. 'genfrac'.
    //

    const atoms = parseString(
        text,
        'math',
        null,
        options.macros,
        false,
        options.onError
    );

    //
    // 2. Transform the math atoms into elementary spans
    //    for example from genfrac to vlist.
    //
    let spans = decompose(
        {
            mathstyle: MATHSTYLES[options.mathstyle],
            letterShapeStyle: options.letterShapeStyle,
        },
        atoms
    );

    //
    // 3. Simplify by coalescing adjacent nodes
    //    for example, from <span>1</span><span>2</span>
    //    to <span>12</span>
    //
    spans = coalesce(spans);

    if (options.format === 'span') return (spans as unknown) as string;

    //
    // 4. Wrap the expression with struts
    //
    const wrapper = makeStruts(makeSpan(spans, 'ML__base'), 'ML__mathlive');

    //
    // 5. Generate markup
    //

    return wrapper.toMarkup();
}

export function convertLatexToMathMl(
    latex: string,
    options: Partial<{
        macros: MacroDictionary;
        onError: ErrorListener<ParserErrorCode>;
        generateID: boolean;
    }> = {}
): string {
    options.macros = { ...MACROS, ...(options.macros ?? {}) };

    return atomsToMathML(
        parseString(latex, 'math', [], options.macros, false, options.onError),
        options
    );
}

/** @deprecated */
function latexToMathML(
    latex: string,
    options?: Partial<{
        macros: MacroDictionary;
        onError: ErrorListener<ParserErrorCode>;
        generateID: boolean;
    }>
): string {
    return convertLatexToMathMl(latex, options);
}

/** @deprecated Use MathJSON */
function latexToAST(
    latex: string,
    options?: MathJsonLatexOptions & {
        macros?: MacroDictionary;
        onError?: ErrorListener<ParserErrorCode | string>;
    }
): MathJson {
    options = options ?? {};
    options.macros = { ...MACROS, ...(options.macros ?? {}) };

    // return parseLatex(latex, options);

    return atomtoMathJson(
        parseString(
            latex,
            'math',
            null,
            options.macros,
            false,
            options.onError
        ),
        options
    );
}

/** @deprecated Use MathJSON */
export function astToLatex(
    expr: MathJson,
    options: MathJsonLatexOptions
): string {
    return jsonToLatex(
        typeof expr === 'string' ? JSON.parse(expr) : expr,
        options
    );
    // return emitLatex(expr, options);
}

export function convertLatexToSpeakableText(
    latex: string,
    options: Partial<
        TextToSpeechOptions & {
            macros?: MacroDictionary;
            onError?: ErrorListener<ParserErrorCode | MathfieldErrorCode>;
        }
    > = {}
): string {
    options.macros = options.macros ?? {};
    Object.assign(options.macros, MACROS);

    const mathlist = parseString(
        latex,
        'math',
        null,
        options.macros,
        false,
        options.onError
    );

    return atomToSpeakableText(
        mathlist,
        options as Required<TextToSpeechOptions>
    );
}
/** @deprecated */
function latexToSpeakableText(
    latex: string,
    options?: Partial<
        TextToSpeechOptions & {
            macros?: MacroDictionary;
            onError?: ErrorListener<ParserErrorCode | MathfieldErrorCode>;
        }
    >
): string {
    return convertLatexToSpeakableText(latex, options);
}

function renderMathInDocument(options: AutoRenderOptionsPrivate): void {
    renderMathInElement(document.body, options);
}

function getElement(element: string | HTMLElement): HTMLElement {
    if (typeof element === 'string') {
        const result: HTMLElement = document.getElementById(element);
        if (result === null) {
            throw Error(`The element with ID "${element}" could not be found.`);
        }
        return result;
    }
    return element;
}

function renderMathInElement(
    element: HTMLElement,
    options: AutoRenderOptionsPrivate
): void {
    options = options ?? {};
    options.renderToMarkup = options.renderToMarkup ?? convertLatexToMarkup;
    options.renderToMathML = options.renderToMathML ?? convertLatexToMathMl;
    options.renderToSpeakableText =
        options.renderToSpeakableText ?? convertLatexToSpeakableText;
    options.macros = options.macros ?? MACROS;
    AutoRender.renderMathInElement(getElement(element), options);
}

function validateNamespace(options): void {
    if (typeof options.namespace === 'string') {
        if (!/^[a-z]+[-]?$/.test(options.namespace)) {
            throw Error(
                'options.namespace must be a string of lowercase characters only'
            );
        }
        if (!/-$/.test(options.namespace)) {
            options.namespace += '-';
        }
    }
}

/** @deprecated */
function revertToOriginalContent(
    element: string | HTMLElement,
    options: AutoRenderOptionsPrivate
): void {
    deprecated('revertToOriginalContent');
    //  if (element instanceof MathfieldPrivate) {
    //      element.$revertToOriginalContent();
    //    } else {
    // element is a pair: accessible span, math -- set it to the math part
    element = getElement(element).children[1] as HTMLElement;
    options = options ?? {};
    validateNamespace(options);
    const html = element.getAttribute(
        'data-' + (options.namespace ?? '') + 'original-content'
    );
    element.innerHTML =
        typeof options.createHTML === 'function'
            ? options.createHTML(html)
            : html;
    //  }
}

/** @deprecated */
function getOriginalContent(
    element: string | HTMLElement,
    options: AutoRenderOptionsPrivate
): string {
    deprecated('getOriginalContent');
    if (element instanceof MathfieldPrivate) {
        return element.originalContent;
    }
    // element is a pair: accessible span, math -- set it to the math part
    element = getElement(element).children[1] as HTMLElement;
    options = options ?? {};
    validateNamespace(options);
    return element.getAttribute(
        'data-' + (options.namespace ?? '') + 'original-content'
    );
}

// This SDK_VERSION variable will be replaced during the build process.
const version = '{{SDK_VERSION}}';

function deprecated(method: string) {
    console.warn(`Function "${method}" is deprecated`);
}
export const debug = {
    getStyle: MathLiveDebug.getStyle,
    getType: MathLiveDebug.getType,
    spanToString: MathLiveDebug.spanToString,
    hasClass: MathLiveDebug.hasClass,
    latexToAsciiMath: MathLiveDebug.latexToAsciiMath,
    asciiMathToLatex: MathLiveDebug.asciiMathToLatex,
    FUNCTIONS: MathLiveDebug.FUNCTIONS,
    MATH_SYMBOLS: MathLiveDebug.MATH_SYMBOLS,
    TEXT_SYMBOLS: MathLiveDebug.TEXT_SYMBOLS,
    ENVIRONMENTS: MathLiveDebug.ENVIRONMENTS,
    MACROS: MathLiveDebug.MACROS,
    DEFAULT_KEYBINDINGS: MathLiveDebug.DEFAULT_KEYBINDINGS,
    getKeybindingMarkup: MathLiveDebug.getKeybindingMarkup,
};

export default {
    version: (): string => {
        deprecated('export default version');
        return version;
    },
    latexToMarkup: (
        text: string,
        options?: {
            mathstyle?: 'displaystyle' | 'textstyle';
            letterShapeStyle?: 'tex' | 'french' | 'iso' | 'upright' | 'auto';
            macros?: MacroDictionary;
            onError?: ErrorListener<ParserErrorCode>;
            format?: string;
        }
    ): string => {
        deprecated('export default latexToMarkup');
        return latexToMarkup(text, options);
    },
    latexToMathML: (
        latex: string,
        options?: Partial<{
            macros: MacroDictionary;
            onError: ErrorListener<ParserErrorCode>;
            generateID: boolean;
        }>
    ): string => {
        deprecated('export default latexToMathML');
        return latexToMathML(latex, options);
    },
    latexToSpeakableText: (
        latex: string,
        options: Partial<
            TextToSpeechOptions & {
                macros?: MacroDictionary;
                onError?: ErrorListener<ParserErrorCode | MathfieldErrorCode>;
            }
        >
    ): string => {
        deprecated('export default latexToSpeakableText');
        return latexToSpeakableText(latex, options);
    },
    latexToAST: (
        latex: string,
        options?: MathJsonLatexOptions & {
            macros?: MacroDictionary;
            onError?: ErrorListener<ParserErrorCode | string>;
        }
    ): string => {
        deprecated('export default latexToAST: use MathJSON');
        return latexToAST(latex, options);
    },
    astToLatex: (expr: MathJson, options: MathJsonLatexOptions): string => {
        deprecated('export default astToLatex: use MathJSON');
        return astToLatex(expr, options);
    },
    makeMathField: (
        element: HTMLElement,
        options: Partial<MathfieldOptions>
    ): Mathfield => {
        deprecated('export default makeMathField');
        return makeMathField(element, options);
    },
    renderMathInDocument: (options?: AutoRenderOptionsPrivate): void => {
        deprecated('export default renderMathInDocument');
        renderMathInDocument(options);
    },
    renderMathInElement: (
        el: HTMLElement,
        options: AutoRenderOptionsPrivate
    ): void => {
        deprecated('export default renderMathInElement');
        renderMathInElement(el, options);
    },
    revertToOriginalContent: (
        el: string | HTMLElement,
        options: AutoRenderOptionsPrivate
    ): void => {
        deprecated('export default revertToOriginalContent');
        revertToOriginalContent(el, options);
    },
    getOriginalContent: (
        el: string | HTMLElement,
        options: AutoRenderOptionsPrivate
    ): void => {
        deprecated('export default getOriginalContent');
        getOriginalContent(el, options);
    },

    readAloud: (
        element: HTMLElement,
        text: string,
        config: Partial<MathfieldOptions>
    ): void => {
        deprecated('export default readAloud');
        return defaultReadAloudHook(element, text, config);
    },
    readAloudStatus: (): string => {
        deprecated('export default readAloudStatus');
        return readAloudStatus();
    },
    pauseReadAloud: (): void => {
        deprecated('export default pauseReadAloud');
        pauseReadAloud();
    },
    resumeReadAloud: (): void => {
        deprecated('export default resumeReadAloud');
        resumeReadAloud();
    },
    playReadAloud: (token: string, count: number): void => {
        deprecated('export default playReadAloud');
        playReadAloud(token, count);
    },
};
