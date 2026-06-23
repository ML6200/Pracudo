# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pracudo is a Hungarian pseudo code memorization and testing tool. It helps students learn algorithms from the "Programozási tételek" textbook style — with keywords like `függvény`, `ciklus amíg`, `ha...akkor`, and operators like `←` (assignment), `∧` (AND), `¬` (NOT).

## Commands

- `npm run dev` — start Vite dev server (port from `$PORT` or 3000)
- `npm run build` — type-check with `tsc` then bundle with Vite
- `tsc --noEmit` — type-check only (no test framework is configured)

## Architecture

Vanilla TypeScript + HTML, no framework. Single-page app with three views (library, view, quiz) toggled via CSS class `.active`. All state lives in localStorage.

### Data Flow

1. **Input** → text paste or OCR image → `postProcessOCR()` fixes misreads → `formatPseudoCode()` normalizes indentation → `applyAliases()` converts ASCII operators to Unicode
2. **Storage** → `Algorithm` objects (AST with tokenized lines) stored as JSON in localStorage
3. **Rendering** → `parseAlgorithm()` produces AST → `renderAlgorithm()` maps token types to styled `<span>` elements
4. **Quiz** → engine reads stored `Algorithm`, generates blanks or accepts full reproduction, uses `normalizeForComparison()` for tolerant matching

### Module Responsibilities

- **`parser.ts`** — tokenizer with Hungarian keyword set and compound keywords (`függvény vége`, `ciklus amíg`). Produces `Algorithm` AST with `Token[]` per line. `algorithmToText()` serializes back to plain text.
- **`aliases.ts`** — mutable operator alias system backed by localStorage. `applyAliases()` converts ASCII to Unicode (`<-` → `←`). `reverseAliases()` goes the other direction. `setupLiveAliasing()` attaches input listeners to textareas with prefix-aware deferred replacement — aliases like `!` that are prefixes of longer aliases like `!=` are not replaced until the next keystroke resolves the ambiguity. `normalizeForComparison()` normalizes all dash variants for quiz tolerance.
- **`formatter.ts`** — auto-indentation via opener/closer pattern matching. Openers use negative lookahead to avoid matching closers (e.g., `^ciklus\b(?!.*\bvége\b)`). Also normalizes operator spacing.
- **`ocr.ts`** — Tesseract.js with Hungarian language pack. `postProcessOCR()` has a 5-phase pipeline: character-level arrow fixes, logical operator recovery, keyword accent recovery, context-aware assignment arrow detection, bracket misread fixes.
- **`renderer.ts`** — converts `Algorithm` AST to styled HTML. `renderIOLine()` uses single-pass tokenize-then-render to avoid double-matching inside HTML tags.
- **`quiz.ts`** — two modes: fill-in-the-blanks (difficulty slider controls blank ratio) and full reproduction (line-by-line + word-level diff). `generateBlanks()` targets RHS of assignments and conditions.
- **`stats.ts`** — quiz attempt recording and progress analysis. `recordAttempt()` saves each quiz result with missed parts. `getAllAlgoProgress()` computes per-algorithm trends (improving/declining/stable by comparing last 3 vs older scores). `getSuggestions()` prioritizes: low-score algorithms > never-practiced > stale (3+ days) > declining trend. `getFrequentMistakes()` aggregates commonly missed expressions. All data in localStorage under `pracudo_stats`.
- **`storage.ts`** — thin localStorage CRUD wrapper for algorithms.
- **`main.ts`** — app entry wiring all modules. Manages view switching (library, view, quiz, stats), modal dialogs, event listeners.

### Key Design Decisions

- Algorithms are stored with canonical Unicode operators (`←`, `∧`, `¬`), never ASCII aliases. The alias toggle on the view page uses `reverseAliases()` at render time only.
- The formatter is applied on import (both text and OCR) but stored text preserves the formatted result. Re-formatting is available via explicit buttons.
- Quiz comparison uses `normalizeForComparison()` which applies aliases and normalizes all dash-like Unicode characters (`−`, `–`, `—`) to ASCII `-`, making answers forgiving of dash variants.
- OCR post-processing is aggressive: it uses line-level context (keyword detection) to decide whether `<` is a comparison or a misread `←`.

### Hungarian Pseudo Code Conventions

Keywords: `függvény`, `eljárás`, `ciklus amíg`, `ciklus vége`, `ha...akkor`, `különben`, `elágazás vége`, `vissza`, `címszerint`
Types: `egész`, `valós`, `logikai`, `karakter`, `szöveg`, `tömb`
Operators: `←` (assign), `∧` (AND), `∨` (OR), `¬` (NOT), `≤`, `≥`, `≠`, `≡`

## UI Language

The entire UI is in Hungarian. Button labels, error messages, and placeholder text should remain in Hungarian.
