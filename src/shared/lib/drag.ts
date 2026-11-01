/**
 * What a file drag toward a chat reports. Used by both drag events below:
 * Explorer rows and open file tabs.
 */
export type FilePointerDragDetail =
  | { type: "move" | "drop"; path: string; x: number; y: number }
  | { type: "end"; path: string };

export const EXPLORER_FILE_POINTER_DRAG_EVENT =
  "monocode:explorer-file-pointer-drag";

export function emitExplorerFilePointerDrag(detail: FilePointerDragDetail) {
  window.dispatchEvent(
    new CustomEvent<FilePointerDragDetail>(EXPLORER_FILE_POINTER_DRAG_EVENT, {
      detail,
    }),
  );
}

export const FILE_TAB_POINTER_DRAG_EVENT = "monocode:file-tab-pointer-drag";

export function emitFileTabPointerDrag(detail: FilePointerDragDetail) {
  window.dispatchEvent(
    new CustomEvent<FilePointerDragDetail>(FILE_TAB_POINTER_DRAG_EVENT, {
      detail,
    }),
  );
}

export function setGrabbing(on: boolean) {
  document.body.style.cursor = on ? "grabbing" : "";
}

/** Block native text selection for the duration of a reorder gesture. */
export function suppressTextSelection() {
  const onSelectStart = (event: Event) => {
    event.preventDefault();
  };
  window.addEventListener("selectstart", onSelectStart);
  document.documentElement.classList.add("is-reordering");
  window.getSelection()?.removeAllRanges();
  return () => {
    window.removeEventListener("selectstart", onSelectStart);
    document.documentElement.classList.remove("is-reordering");
    window.getSelection()?.removeAllRanges();
  };
}

/**
 * The icon-and-name chip that follows the pointer while a file is dragged
 * toward a chat. The caller names its styling class and passes clones;
 * missing nodes are skipped.
 */
export function createFileDragPreview(
  className: string,
  icon: Node | undefined,
  label: Node | undefined,
) {
  const preview = document.createElement("div");
  preview.setAttribute("aria-hidden", "true");
  preview.classList.add(className);
  if (icon) preview.append(icon);
  if (label) preview.append(label);

  document.body.append(preview);
  return preview;
}

/** Keep a file drag preview beside the pointer and inside the window. */
export function moveFileDragPreview(
  preview: HTMLElement | null,
  lastX: number,
  lastY: number,
) {
  if (!preview) return;
  const edge = 8;
  const grabX = 12;
  const grabY = 13;
  const width = preview.offsetWidth;
  const height = preview.offsetHeight;
  const x = Math.min(
    Math.max(edge, lastX - grabX),
    Math.max(edge, window.innerWidth - width - edge),
  );
  const y = Math.min(
    Math.max(edge, lastY - grabY),
    Math.max(edge, window.innerHeight - height - edge),
  );
  preview.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(
    y,
  )}px, 0)`;
}
