export function make(difficulty, rows) {
    return rows.map(([id, category, title, prompt, visual, answer, hints, [clue, steps, aha, transfer], aliases = [], visualRequired = true]) => ({
        id, category, difficulty, title, prompt, visual, answer, aliases, hints,
        explanation: { clue, steps, aha, transfer }, visualRequired
    }));
}
