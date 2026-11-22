export const normalizePrompt = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function parseCsv(source) {
  const input = String(source ?? '').replace(/^\\uFEFF/, '');
  const rows = [];
  let row = [], cell = '', quoted = false, closedQuote = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else cell += char;
      continue;
    }
    if (closedQuote && char !== ',' && char !== '\\r' && char !== '\\n' && char !== ' ' && char !== '\\t') {
      throw new Error('CSV has unexpected characters after a closing quote.');
    }
    if (char === '"' && !cell.length && !closedQuote) quoted = true;
    else if (char === ',' ) { row.push(cell); cell = ''; closedQuote = false; }
    else if (char === '\\n' || char === '\\r') {
      if (char === '\\r' && input[i + 1] === '\\n') i++;
      row.push(cell);
      if (row.some(value => value.trim())) rows.push(row);
      row = []; cell = ''; closedQuote = false;
    } else if (!closedQuote || (char !== ' ' && char !== '\\t')) cell += char;
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field.');
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map(value => value.trim().toLowerCase().replace(/[\\s-]+/g, '_'));
  if (headers.some(header => !header)) throw new Error('CSV contains an empty column heading.');
  if (new Set(headers).size !== headers.length) throw new Error('CSV contains duplicate column headings. Rename each column so every heading is unique.');
  return rows.map((values, index) => ({
    ...Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ''])),
    __sourceRow: index + 2,
  }));
}

export function toImportRow(raw, sourceRow, existing = new Set()) {
  const choicesRaw = raw.choices ?? raw.options;
  const letters = ['a', 'b', 'c', 'd', 'e', 'f'];
  const structuredChoices = letters.map((letter, index) =>
    raw['choice_' + letter] ?? raw['option_' + letter] ??
    raw['choice' + letter.toUpperCase()] ?? raw['option' + letter.toUpperCase()] ??
    raw['choice_' + (index + 1)] ?? raw['option_' + (index + 1)]
  ).filter(value => value !== undefined && value !== null && String(value).trim() !== '');
  let listedChoices = [];
  if (Array.isArray(choicesRaw)) {
    listedChoices = choicesRaw.map(value => typeof value === 'string' ? value : String(value?.text ?? value?.label ?? '')).filter(Boolean);
  } else if (choicesRaw !== undefined && choicesRaw !== null && String(choicesRaw).trim()) {
    const rawText = String(choicesRaw).trim();
    try {
      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed)) listedChoices = parsed.map(value => typeof value === 'string' ? value : String(value?.text ?? value?.label ?? '')).filter(Boolean);
    } catch { /* Plain newline-delimited choices are supported below. */ }
    if (!listedChoices.length) listedChoices = rawText.split(/\\r?\\n/).map(value => value.trim()).filter(Boolean);
  }
  const choices = (listedChoices.length ? listedChoices : structuredChoices.map(value => String(value).trim())).map(value => value.trim());
  const prompt = String(raw.prompt ?? raw.question ?? raw.question_text ?? '').trim();
  const type = String(raw.question_type ?? raw.type ?? 'multiple_choice').toLowerCase().replace(/[ -]/g, '_');
  const answer = String(raw.answer_key ?? raw.answer ?? raw.correct_answer ?? '').trim();
  const answerLetter = answer.match(/^([A-F])(?:[).:]|$)/i);
  const answerIndex = answerLetter ? answerLetter[1].toUpperCase().charCodeAt(0) - 65 : -1;
  const normalizedAnswer = answerIndex >= 0 ? (choices[answerIndex] ?? answer) : answer;
  const points = Number(raw.points ?? 1);
  const row = {
    sourceRow,
    exam_program: String(raw.exam_program ?? raw.program ?? 'SAT English').trim(),
    topic: String(raw.topic ?? raw.skill ?? raw.domain ?? 'General').trim(),
    difficulty: String(raw.difficulty ?? 'medium').toLowerCase(),
    passage: String(raw.passage ?? raw.reading_passage ?? '').trim(),
    prompt,
    question_type: type,
    choices,
    answer_key: normalizedAnswer,
    explanation: String(raw.explanation ?? raw.rationale ?? '').trim(),
    points,
    errors: [],
    duplicate: false,
  };
  if (!prompt) row.errors.push('Question prompt is required.');
  if (!['multiple_choice', 'short_answer', 'essay'].includes(type)) row.errors.push('Unsupported question type.');
  if (!['easy', 'medium', 'hard'].includes(row.difficulty)) row.errors.push('Difficulty must be easy, medium or hard.');
  if (type === 'multiple_choice') {
    if (choices.length < 2 || choices.length > 6) row.errors.push('Multiple-choice questions need between 2 and 6 answer choices.');
    if (new Set(choices.map(value => normalizePrompt(value))).size !== choices.length) row.errors.push('Answer choices must be unique.');
    if (!answer || !choices.some(choice => normalizePrompt(choice) === normalizePrompt(normalizedAnswer))) {
      row.errors.push('Multiple-choice answer must match one of the supplied choices or use its letter (A–F).');
    }
  }
  if (!row.exam_program) row.errors.push('Exam program is required.');
  if (!row.topic) row.errors.push('Topic is required.');
  if (!Number.isFinite(points) || points <= 0 || points > 100) row.errors.push('Points must be between 0 and 100.');
  const key = normalizePrompt(prompt);
  row.duplicate = !!key && existing.has(key);
  if (row.duplicate) row.errors.push('Possible duplicate of an existing question.');
  return row;
}
