// @vitest-environment happy-dom
import { act, createElement, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EXPLORER_FILE_POINTER_DRAG_EVENT,
  FILE_TAB_POINTER_DRAG_EVENT,
  type FilePointerDragDetail,
} from "../../../shared/lib/drag";
import {
  newChangesTab,
  newTerminalFile,
  type FilePaneTab,
} from "../model/layout";
import { SurfaceTabs } from "./SurfaceTabs";

vi.mock("../../files/ui/FileTypeIcon", () => ({
  FileTypeIcon: ({ name }: { name: string }) =>
    createElement("span", { "data-icon": name }),
}));

let container: HTMLDivElement;
let root: Root;
let props: ComponentProps<typeof SurfaceTabs>;
let chat: HTMLDivElement;
let fileTabEvents: FilePointerDragDetail[];
let explorerEvents: FilePointerDragDetail[];

const files: FilePaneTab[] = [
  { id: "first", path: "/repo/README.md", cwd: "/repo" },
  { id: "second", path: "/repo/src/app.ts", cwd: "/repo" },
];

const onFileTabDrag = (event: Event) => {
  fileTabEvents.push((event as CustomEvent<FilePointerDragDetail>).detail);
};
const onExplorerDrag = (event: Event) => {
  explorerEvents.push((event as CustomEvent<FilePointerDragDetail>).detail);
};

function render() {
  act(() => root.render(createElement(SurfaceTabs, props)));
  // Lay the tabs out side by side and let them capture the pointer.
  container
    .querySelectorAll<HTMLElement>("[data-tab-slot-id]")
    .forEach((item, index) => {
      item.getBoundingClientRect = () => new DOMRect(index * 100, 0, 100, 32);
      const captured = new Set<number>();
      item.setPointerCapture = (id) => captured.add(id);
      item.hasPointerCapture = (id) => captured.has(id);
      item.releasePointerCapture = (id) => captured.delete(id);
    });
}

function tab(path: string) {
  return container.querySelector<HTMLButtonElement>(
    `[role="tab"][title="${path}"]`,
  )!;
}

function pointer(
  target: EventTarget,
  type: string,
  clientX: number,
  clientY: number,
) {
  act(() =>
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        button: 0,
        pointerId: 1,
        clientX,
        clientY,
      }),
    ),
  );
}

function over(element: Element) {
  vi.spyOn(document, "elementFromPoint").mockReturnValue(element);
}

function preview() {
  return document.querySelector<HTMLElement>(".file-tab-drag-preview");
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(
    () => {},
  );
  props = {
    files,
    activeFileId: "first",
    dirtyFileIds: new Set(),
    fileErrorCounts: new Map(),
    onSelectFile: vi.fn(),
    onCloseFile: vi.fn(),
    onCloseOtherFiles: vi.fn(),
    onReorder: vi.fn(),
  };
  chat = document.createElement("div");
  chat.dataset.sessionDrop = "session-one";
  document.body.append(chat);
  fileTabEvents = [];
  explorerEvents = [];
  window.addEventListener(FILE_TAB_POINTER_DRAG_EVENT, onFileTabDrag);
  window.addEventListener(EXPLORER_FILE_POINTER_DRAG_EVENT, onExplorerDrag);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  render();
});

afterEach(() => {
  window.dispatchEvent(new Event("blur"));
  act(() => root.unmount());
  container.remove();
  chat.remove();
  window.removeEventListener(FILE_TAB_POINTER_DRAG_EVENT, onFileTabDrag);
  window.removeEventListener(EXPLORER_FILE_POINTER_DRAG_EVENT, onExplorerDrag);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("file tab drags into a chat", () => {
  it("publishes a file tab drop with a preview that follows the pointer", () => {
    over(chat);
    pointer(tab("/repo/src/app.ts"), "pointerdown", 150, 16);
    pointer(window, "pointermove", 390, 200);

    const chip = preview();
    expect(chip).not.toBeNull();
    expect(chip?.getAttribute("aria-hidden")).toBe("true");
    expect(chip?.textContent).toContain("app.ts");
    expect(chip?.children).toHaveLength(2);
    expect(chip?.querySelectorAll('[data-icon="app.ts"]')).toHaveLength(1);
    expect(chip?.style.transform).toBe("translate3d(378px, 187px, 0)");

    pointer(window, "pointermove", 396, 208);
    expect(chip?.style.transform).toBe("translate3d(384px, 195px, 0)");

    pointer(window, "pointerup", 396, 208);

    expect(preview()).toBeNull();
    expect(fileTabEvents.some((event) => event.type === "move")).toBe(true);
    expect(fileTabEvents.slice(-2)).toEqual([
      { type: "drop", path: "/repo/src/app.ts", x: 396, y: 208 },
      { type: "end", path: "/repo/src/app.ts" },
    ]);
    expect(explorerEvents).toEqual([]);
    expect(props.onReorder).not.toHaveBeenCalled();
  });

  it("ends without a drop when released outside a chat", () => {
    over(document.body);
    pointer(tab("/repo/src/app.ts"), "pointerdown", 150, 16);
    pointer(window, "pointermove", 390, 200);
    expect(preview()).not.toBeNull();

    pointer(window, "pointerup", 390, 200);

    expect(preview()).toBeNull();
    expect(fileTabEvents.some((event) => event.type === "drop")).toBe(false);
    expect(fileTabEvents.at(-1)).toEqual({
      type: "end",
      path: "/repo/src/app.ts",
    });
  });

  it("drags a lone file tab into a chat", () => {
    props = { ...props, files: [files[0]] };
    render();
    over(chat);
    pointer(tab("/repo/README.md"), "pointerdown", 50, 16);
    pointer(window, "pointermove", 390, 200);
    expect(preview()).not.toBeNull();

    pointer(window, "pointerup", 390, 200);

    expect(preview()).toBeNull();
    expect(fileTabEvents.slice(-2)).toEqual([
      { type: "drop", path: "/repo/README.md", x: 390, y: 200 },
      { type: "end", path: "/repo/README.md" },
    ]);
  });

  it("leaves Changes and terminal tabs out of file drags", () => {
    const changes = newChangesTab("/repo");
    const terminal = newTerminalFile("/repo");
    props = { ...props, files: [changes, terminal], activeFileId: changes.id };
    render();
    over(chat);

    for (const id of [changes.id, terminal.id]) {
      const button = container.querySelector<HTMLElement>(
        `[data-tab-slot-id="${id}"] [role="tab"]`,
      )!;
      pointer(button, "pointerdown", 50, 16);
      pointer(window, "pointermove", 390, 200);
      expect(preview()).toBeNull();
      pointer(window, "pointerup", 390, 200);
    }

    expect(fileTabEvents).toEqual([]);
  });

  it("does not start a drag from a lone Changes tab", () => {
    const changes = newChangesTab("/repo");
    props = { ...props, files: [changes], activeFileId: changes.id };
    render();
    over(chat);
    const item = container.querySelector<HTMLElement>(
      `[data-tab-slot-id="${changes.id}"]`,
    )!;

    pointer(item.querySelector('[role="tab"]')!, "pointerdown", 50, 16);
    pointer(window, "pointermove", 390, 200);

    expect(item.dataset.dragging).toBeUndefined();
    expect(document.body.style.cursor).toBe("");
    pointer(window, "pointerup", 390, 200);
    expect(fileTabEvents).toEqual([]);
  });

  it("still reorders file tabs dragged along the tab bar", async () => {
    over(document.body);
    const first = tab("/repo/README.md");
    pointer(first, "pointerdown", 50, 16);
    pointer(window, "pointermove", 160, 16);
    // The dragged tab follows the pointer instead of waiting in its slot.
    await act(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    );
    expect(first.parentElement?.style.transform).toBe(
      "translate3d(100px, 0, 0)",
    );
    pointer(window, "pointerup", 160, 16);

    expect(props.onReorder).toHaveBeenCalledExactlyOnceWith(
      ["second", "first"],
      "first",
    );
    expect(preview()).toBeNull();
    expect(fileTabEvents.some((event) => event.type === "drop")).toBe(false);
  });

  it("keeps a click on a file tab a plain selection", () => {
    over(chat);
    const button = tab("/repo/src/app.ts");
    pointer(button, "pointerdown", 150, 16);
    pointer(window, "pointerup", 150, 16);
    act(() => button.click());

    expect(props.onSelectFile).toHaveBeenCalledWith("second");
    expect(preview()).toBeNull();
    expect(fileTabEvents).toEqual([]);
    expect(props.onReorder).not.toHaveBeenCalled();
  });

  it("cancels a file tab drag on Escape without dropping", () => {
    over(chat);
    pointer(tab("/repo/src/app.ts"), "pointerdown", 150, 16);
    pointer(window, "pointermove", 390, 200);
    expect(preview()).not.toBeNull();

    act(() =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    );

    expect(preview()).toBeNull();
    expect(fileTabEvents.some((event) => event.type === "drop")).toBe(false);
    expect(fileTabEvents.at(-1)).toEqual({
      type: "end",
      path: "/repo/src/app.ts",
    });
    pointer(window, "pointerup", 390, 200);
    expect(fileTabEvents.some((event) => event.type === "drop")).toBe(false);
  });

  it("does not drop once the pointer has left the chat", () => {
    over(chat);
    pointer(tab("/repo/src/app.ts"), "pointerdown", 150, 16);
    pointer(window, "pointermove", 390, 200);
    over(document.body);
    pointer(window, "pointermove", 700, 500);
    pointer(window, "pointerup", 700, 500);

    expect(preview()).toBeNull();
    expect(fileTabEvents.some((event) => event.type === "drop")).toBe(false);
    expect(fileTabEvents.at(-1)).toEqual({
      type: "end",
      path: "/repo/src/app.ts",
    });
  });

  it("cleans up a file tab drag when the tabs unmount", () => {
    over(chat);
    pointer(tab("/repo/src/app.ts"), "pointerdown", 150, 16);
    pointer(window, "pointermove", 390, 200);
    expect(preview()).not.toBeNull();

    act(() => root.unmount());
    root = createRoot(container);

    expect(preview()).toBeNull();
    expect(fileTabEvents.at(-1)).toEqual({
      type: "end",
      path: "/repo/src/app.ts",
    });
  });
});
