import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

// CodeMirror needs these browser globals beyond window and document.
export const CODEMIRROR_GLOBALS = ["MutationObserver", "ResizeObserver", "requestAnimationFrame", "cancelAnimationFrame", "getComputedStyle", "DOMRect", "Range"] as const;

export interface MountedDom {
  root: Root;
  container: HTMLElement;
  cleanup: () => Promise<void>;
}

// Installs a happy-dom window as the global window and document, marks the React act environment,
// and copies each named extra global (MutationObserver, HTMLElement, …) from the window.
export function mountDom(extraGlobals: readonly string[] = []): MountedDom {
  const dom = new Window();
  const names = ["window", "document", "IS_REACT_ACT_ENVIRONMENT", ...extraGlobals];
  const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const name of names) {
    const value = name === "window" ? dom : name === "document" ? dom.document : name === "IS_REACT_ACT_ENVIRONMENT" ? true : (dom as unknown as Record<string, unknown>)[name];
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  const container = dom.document.createElement("div") as unknown as HTMLElement;
  dom.document.body.append(container as unknown as never);
  const root = createRoot(container);
  const cleanup = async () => {
    await act(async () => root.unmount());
    await dom.happyDOM.close();
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  };
  return { root, container, cleanup };
}

// Types text into a field the way a browser does: the prototype's value setter bypasses React's
// value tracker, then an input event lets React see the change.
export async function inputText(field: HTMLInputElement | HTMLTextAreaElement, text: string): Promise<void> {
  await act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), "value")!.set!.call(field, text);
    field.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}
