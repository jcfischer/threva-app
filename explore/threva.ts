import { always } from "@antithesishq/bombadil";
import { extract } from "@antithesishq/bombadil/browser";

export { noUncaughtExceptions, noUnhandledPromiseRejections, noConsoleErrors } from "@antithesishq/bombadil/browser/defaults/properties";
export { clicks, inputs, scroll, back, reload } from "@antithesishq/bombadil/browser/defaults/actions";

const unnamedButtons = extract((state) =>
  [...state.document.querySelectorAll("button, [role=button]")]
    .filter((button) => button instanceof HTMLElement && button.offsetParent !== null)
    .filter((button) => !(button.getAttribute("aria-label") ?? button.getAttribute("aria-labelledby") ?? button.getAttribute("title") ?? button.textContent.trim()))
    .map((button) => button.outerHTML.slice(0, 120)),
);

export const everyVisibleButtonHasAName = always(() => unnamedButtons.current.length === 0);

const rendered = extract((state) => state.document.querySelector("#root")?.childElementCount ?? 0);

export const theAppNeverBlanks = always(() => rendered.current > 0);
