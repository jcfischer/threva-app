import type { OutlineDetails, OutlineRow } from "../api/types";
import type { I18n } from "../i18n";

// Cortex refuses a note past 10,000 characters; the page shows the count before that point.
export const NOTE_LIMIT = 10_000;
export const NOTE_WARN = 8_000;
export const SAVE_PAUSE = 1_200;

const word = /[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu;

/** Words are runs of letters and digits, so Markdown marks alone are not words and `**bold**` is one. */
export function wordCount(text: string): number {
  return text.match(word)?.length ?? 0;
}

/** What a row's line says about its page, or null when the row has no page yet. */
export function pageLine(note: string | undefined, i18n: I18n): string | null {
  if (!note || !note.trim()) return null;
  return i18n.tn("everything.pageWords", wordCount(note));
}

/** The row's own details, unchanged, with the page as the only new value. */
export function detailsOf(row: OutlineRow, date: string, note: string): OutlineDetails {
  return {
    title: row.title,
    weight: row.weight,
    note,
    ordering: row.ordering,
    focus: row.focusMonth === date.slice(0, 7),
    dueDate: row.dueDate ?? "",
    context: row.context ?? "",
    effort: row.effort ?? 1,
    estimateMinutes: row.estimateMinutes ?? null,
  };
}

// The cursor place per row, kept in the browser so returning to a page resumes there.
export interface PlaceStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const placeKey = (row: string) => `threva.everything.place.${row}`;

export function keptPlace(store: PlaceStore, row: string, length: number): number | null {
  const raw = store.getItem(placeKey(row));
  if (raw === null || raw.trim() === "") return null;
  const stored = Number(raw);
  if (!Number.isInteger(stored) || stored < 0) return null;
  if (stored > length) {
    store.removeItem(placeKey(row));
    return null;
  }
  return stored;
}

export function keepPlace(store: PlaceStore, row: string, at: number): void {
  store.setItem(placeKey(row), String(at));
}

export interface SaveTimer {
  after(callback: () => void, ms: number): unknown;
  cancel(handle: unknown): void;
}

export const browserTimer: SaveTimer = {
  after: (callback, ms) => setTimeout(callback, ms),
  cancel: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export type SaveResult = { ok: true; revision: number } | { ok: false; message: string | null };

export interface NoteNotice {
  row: string;
  state: "saved" | "refused" | "lifted";
  message: string | null;
}

export interface NoteSaverOptions {
  save(row: OutlineRow, note: string, revision: number, date: string): Promise<SaveResult>;
  reload(): Promise<number | null>;
  row(id: string): OutlineRow | null;
  date(): string;
  revision(): number;
  notice(notice: NoteNotice): void;
  timer?: SaveTimer;
  pause?: number;
}

/**
 * Holds the text typed on a page until it is saved: 1.2 seconds after typing pauses, or as soon as the
 * editor loses focus. A refused save keeps the text and retries on the newest revision after the next pause.
 */
export class NoteSaver {
  readonly #options: NoteSaverOptions;
  readonly #timer: SaveTimer;
  readonly #pause: number;
  #pending = new Map<string, string>();
  #saving = new Map<string, string>();
  #saved = new Map<string, string>();
  #handle: unknown = null;
  #running = false;
  #again = false;
  #revision: number | null = null;

  constructor(options: NoteSaverOptions) {
    this.#options = options;
    this.#timer = options.timer ?? browserTimer;
    this.#pause = options.pause ?? SAVE_PAUSE;
  }

  /** The newest revision Threva knows of, from the outline it was given or from a save. */
  setRevision(revision: number): void {
    this.#revision = revision;
  }

  get waiting(): { row: string; text: string }[] {
    return [...this.#pending].map(([row, text]) => ({ row, text }));
  }

  /** The newest revision Threva knows of. */
  get revision(): number {
    return this.#revision ?? this.#options.revision();
  }

  /** True when this text still needs saving: it is neither saved nor already in flight. */
  needsSave(row: string, text: string): boolean {
    if (this.#saving.get(row) === text) return false;
    if (this.#saving.has(row)) return true;
    return this.#saved.get(row) !== text;
  }

  /** True while this row has text waiting for the timer or for a save in flight. */
  holding(row: string): boolean {
    return this.#pending.has(row) || this.#saving.has(row);
  }

  /** A reloaded outline is the new truth for a row the user is not editing. */
  adopt(row: string, text: string): void {
    if (this.#pending.has(row) || this.#saving.has(row)) return;
    this.#saved.set(row, text);
  }

  /** The text changed: save it once typing pauses and no sooner. */
  type(row: string, text: string): void {
    if (!this.needsSave(row, text)) {
      this.#pending.delete(row);
      if (this.#pending.size === 0) this.#cancel();
      return;
    }
    this.#pending.set(row, text);
    this.#restart();
  }

  /** The editor lost focus or its row closed: save everything typed so far. */
  leave(row: string, text: string): void {
    if (this.needsSave(row, text)) this.#pending.set(row, text);
    else this.#pending.delete(row);
    void this.flush();
  }

  async flush(): Promise<void> {
    this.#cancel();
    if (this.#running) {
      this.#again = true;
      return;
    }
    this.#running = true;
    try {
      do {
        this.#again = false;
        for (const [row, text] of [...this.#pending]) {
          this.#pending.delete(row);
          const detail = this.#options.row(row);
          if (!detail) continue;
          this.#saving.set(row, text);
          let result: SaveResult;
          try {
            result = await this.#options.save(detail, text, this.#revision ?? this.#options.revision(), this.#options.date());
          } finally {
            this.#saving.delete(row);
          }
          if (result.ok) {
            this.#revision = result.revision;
            this.#saved.set(row, text);
            if (!this.#pending.has(row)) this.#options.notice({ row, state: "saved", message: null });
            continue;
          }
          if (!this.#pending.has(row)) this.#pending.set(row, text);
          this.#options.notice({ row, state: "refused", message: result.message });
          const latest = await this.#options.reload();
          if (latest !== null) this.#revision = latest;
          return;
        }
      } while (this.#again);
    } finally {
      this.#running = false;
    }
  }

  #restart(): void {
    this.#cancel();
    this.#handle = this.#timer.after(() => {
      this.#handle = null;
      void this.flush();
    }, this.#pause);
  }

  #cancel(): void {
    if (this.#handle === null) return;
    this.#timer.cancel(this.#handle);
    this.#handle = null;
  }
}
