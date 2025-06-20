import {
  wasmInstance,
  readRenderCommand,
  activeNodeIds,
  readWasmString,
  encodeString,
  rerenderRoute,
  root,
  allocString,
} from "./wasi_obj.js";
import {
  applyHoverClass,
  updateComponentStyle,
  checkMarkStyling,
} from "./wasi_styling.js";
import { domNodeRegistry, eventHandlers, eventStorage } from "./maps.js";
import { state } from "./state.js";

// Component type constants
const COMPONENT_TYPES = {
  RECTANGLE: 0,
  TEXT: 1,
  IMAGE: 2,
  FLEXBOX: 3,
  INPUT: 4,
  BUTTON: 5,
  BLOCK: 6,
  BOX: 7,
  HEADER: 8,
  SVG: 9,
  LINK: 10,
  EMBEDLINK: 11,
  LIST: 12,
  LISTITEM: 13,
  IF: 14,
  HOOKS: 15,
  LAYOUT: 16,
  PAGE: 17,
  BIND: 18,
  DIALOG: 19,
  DIALOG_SHOW: 20,
  DIALOG_CLOSE: 21,
  DRAGGABLE: 22,
  REDIRECT_LINK: 23,
  SELECT: 24,
  SELECT_ITEM: 25,
  BUTTON_CTX: 26,
  EMBEDICON: 27,
  ICON: 28,
  LABEL: 29,
  FORM: 30,
  ALLOC_TEXT: 31,
  TABLE: 32,
  TABLE_ROW: 33,
  TABLE_CELL: 34,
  TABLE_HEADER: 35,
  TABLE_BODY: 36,
  TEXT_AREA: 37,
  CANVAS: 38,
  SUBMIT_BUTTON_CTX: 39,
  HOOKS_CTX: 40,
  JSON_EDITOR: 41,
};

// Store intervals by route for cleanup
const routeIntervals = new Map();

/**
 * Clear all intervals for a specific route
 * @param {string} path - The route path to clear intervals for
 */
export function clearIntervalsForRoute(path) {
  if (routeIntervals.has(path)) {
    routeIntervals.get(path).forEach((intervalId) => {
      clearInterval(intervalId);
    });
    routeIntervals.delete(path);
  }
}

/**
 * Process input elements based on their type
 * @param {HTMLElement} element - The input element
 * @param {Object} renderCmd - The render command
 */
function processInputElement(element, renderCmd) {
  const nodePtr = renderCmd.nodePtr;
  const type = wasmInstance.getInputType(nodePtr);
  const inputPtr = wasmInstance.createInput(nodePtr);
  const inputSize = wasmInstance.getInputSize(nodePtr);
  const inputCallback = wasmInstance.getOnInputCallback(nodePtr);
  const inputView = new DataView(
    wasmInstance.memory.buffer,
    inputPtr,
    inputSize,
  );

  let offset = 0;
  offset += 8; // Skip initial bytes

  // Process name attribute
  const namePtr = inputView.getUint32(offset, true);
  offset += 4;
  if (namePtr) {
    const nameLen = inputView.getUint32(offset, true);
    const name = readWasmString(namePtr, nameLen);
    element.name = name;
  }
  offset += 8;

  // Process type-specific attributes
  if (type === 0) {
    // Number input
    const placeholder = inputView.getUint32(offset, true);
    if (placeholder) {
      element.placeholder = placeholder;
    }
    offset += 8;
    const value = inputView.getUint32(offset, true);
    if (value) {
      element.value = value;
    }
    element.type = "number";
  } else if (type === 2) {
    // Text input
    const placeholderPtr = inputView.getUint32(offset, true);
    offset += 4;
    if (placeholderPtr) {
      const placeholderLen = inputView.getUint32(offset, true);
      const placeholder = readWasmString(placeholderPtr, placeholderLen);
      element.placeholder = placeholder;
    }
    offset += 8;
    const valuePtr = inputView.getUint32(offset, true);
    offset += 4;
    if (valuePtr) {
      const valueLen = inputView.getUint32(offset, true);
      const value = readWasmString(valuePtr, valueLen);
      element.value = value;
    }
    offset += 8;
    const minLen = inputView.getUint32(offset, true);
    if (minLen) {
      element.ariaValueMin = minLen;
      element.minLength = minLen;
    }
    offset += 8;
    const maxLen = inputView.getUint32(offset, true);
    if (maxLen) {
      element.ariaValueMin = maxLen;
      element.maxLength = maxLen;
      console.log(maxLen);
    }

    element.type = "text";
  } else if (type === 4) {
    // Radio input
    const valuePtr = inputView.getUint32(offset, true);
    offset += 4;
    if (valuePtr) {
      const valueLen = inputView.getUint32(offset, true);
      const value = readWasmString(valuePtr, valueLen);
      element.value = value;
    }
    element.type = "radio";

    // Apply checkmark styling if available
    const cssCheckMarkPtr = wasmInstance.getCheckMarkStylePtr(nodePtr);
    if (cssCheckMarkPtr > 0) {
      const cssCheckMarkLen = wasmInstance.getCheckMarkLen();
      const checkMarkCss = readWasmString(cssCheckMarkPtr, cssCheckMarkLen);
      if (checkMarkCss.length > 0) {
        checkMarkStyling(
          renderCmd.id,
          element,
          renderCmd.styleId,
          checkMarkCss,
        );
      }
    }
  } else if (type === 5) {
    console.log("Password");
    // Text input
    const placeholderPtr = inputView.getUint32(offset, true);
    offset += 4;
    if (placeholderPtr) {
      const placeholderLen = inputView.getUint32(offset, true);
      const placeholder = readWasmString(placeholderPtr, placeholderLen);
      element.placeholder = placeholder;
    }
    offset += 8;
    const valuePtr = inputView.getUint32(offset, true);
    offset += 4;
    if (valuePtr) {
      const valueLen = inputView.getUint32(offset, true);
      const value = readWasmString(valuePtr, valueLen);
      element.value = value;
    }
    offset += 8;
    const minLen = inputView.getUint32(offset, true);
    if (minLen) {
      element.ariaValueMin = minLen;
      element.minLength = minLen;
    }
    offset += 8;
    const maxLen = inputView.getUint32(offset, true);
    if (maxLen) {
      element.ariaValueMin = maxLen;
      element.maxLength = maxLen;
      console.log(maxLen);
    }
    element.type = "password";
  } else if (type === 6) {
    console.log("Email");
    // Text input
    const placeholderPtr = inputView.getUint32(offset, true);
    offset += 4;
    if (placeholderPtr) {
      const placeholderLen = inputView.getUint32(offset, true);
      const placeholder = readWasmString(placeholderPtr, placeholderLen);
      element.placeholder = placeholder;
    }
    offset += 8;
    const valuePtr = inputView.getUint32(offset, true);
    offset += 4;
    if (valuePtr) {
      const valueLen = inputView.getUint32(offset, true);
      const value = readWasmString(valuePtr, valueLen);
      element.value = value;
    }
    offset += 8;
    const minLen = inputView.getUint32(offset, true);
    if (minLen) {
      element.ariaValueMin = minLen;
      element.minLength = minLen;
    }
    offset += 8;
    const maxLen = inputView.getUint32(offset, true);
    if (maxLen) {
      element.ariaValueMin = maxLen;
      element.maxLength = maxLen;
      console.log(maxLen);
    }
    element.type = "email";
  } else if (type === 7) {
    element.type = "file";
  }
  if (inputCallback) {
    requestAnimationFrame(() => {
      eventHandlers.set(
        `fb-evt-hd-${inputCallback}-${renderCmd.id}`,
        (event) => {
          eventStorage[inputCallback] = event;
          // console.log(event, event.srcElement);
          wasmInstance.eventCallback(inputCallback);
        },
      );
      element.addEventListener(
        "input",
        eventHandlers.get(`fb-evt-hd-${inputCallback}-${renderCmd.id}`),
      );
    });
  }
}

/**
 * Create a link element with route handling
 * @param {Object} renderCmd - The render command
 * @param {HTMLElement} tree_node - The current tree node
 * @param {Object} layout - The layout information
 * @returns {HTMLAnchorElement} - The created link element
 */
function createLinkElement(renderCmd, tree_node, layout) {
  const element = document.createElement("a");
  element.href = renderCmd.href;

  element.addEventListener("click", function (event) {
    event.preventDefault();

    const currentPath = window.location.pathname;
    // clearIntervalsForRoute(currentPath);

    const clickedHref = event.currentTarget.href;
    const urlObj = new URL(clickedHref);
    const path = urlObj.pathname;

    // root.innerHTML = "";
    // this set the route render tree
    // and marks all dirty
    // let route_ptr = null;
    // if (currentPath === "/") {
    //   route_ptr = allocString("/root");
    // } else {
    //   route_ptr = allocString(currentPath);
    // }

    // We first mark all non layout nodes as dirty this way we can traverse and remove
    // we use the dirty flag to indicate for removal
    wasmInstance.markAllNonLayoutNodesDirty();

    // wasmInstance.renderCommands(
    //   window.innerWidth,
    //   window.innerHeight,
    //   route_ptr,
    // );
    // we get the current tree pointer and traverse it to remove all the nodes that are not part of the layout
    const current_tree = wasmInstance.getRenderTreePtr();
    traverseRemove(root, current_tree, layout);

    // we push the state and renderCycle the new path
    window.history.pushState({}, "", path);
    rerenderRoute(path === "/" ? "/root" : path);

    // const newTreeNode = wasmInstance.getRenderTreePtr();
    // wasmInstance.markAllNonLayoutNodesDirty();
    requestAnimationFrame(wasmInstance.setRerenderTrue);
    // state.initial_render = true;
    //
    // activeNodeIds.clear();
    // domNodeRegistry.clear();
    // traverse(root, newTreeNode, layout);
    // removeInactiveNodes();
    // state.initial_render = false;
  });

  return element;
}

function initJsonEditor(parent, element) {
  element.style.caretColor = "white";
  // ——— Setup status/log pane ———
  const status = document.createElement("div");
  status.className = "json-editor-status";
  Object.assign(status.style, {
    fontFamily: "monospace",
    fontSize: "0.9em",
    marginTop: "12px",
    maxHeight: "160px",
    minHeight: "60px",
    width: "100%",
    overflowY: "auto",
    padding: "8px",
    border: "1px solid #27272a",
    borderRadius: "8px",
    boxSizing: "border-box",
  });
  parent.parentNode.insertBefore(status, element.nextSibling);

  function log(msg, isError = false) {
    // console[isError ? "error" : "log"](msg);
    const p = document.createElement("div");
    p.textContent = msg;
    p.style.color = isError ? "#FF3838" : "#555";
    status.appendChild(p);
    status.scrollTop = status.scrollHeight;
  }

  function clearStatus() {
    status.textContent = "";
  }

  function showError(err) {
    clearStatus();
    const msg = err.message || err;
    const m = msg.match(/position (\d+)/);
    let info = msg;
    if (m) {
      const pos = +m[1];
      const before = element.value.slice(0, pos);
      const line = before.split("\n").length;
      const col = pos - (before.lastIndexOf("\n") + 1);
      info = `Line ${line}, Col ${col}: ${msg}`;
      element.setSelectionRange(pos, pos);
    }
    log(`❌ ${info}`, true);
    element.style.borderColor = "#FF3838";
  }

  // ——— New: detect duplicate keys at the same depth ———
  function detectDuplicateKeys(str) {
    const duplicates = [];
    const seen = Object.create(null); // { depth: { key: true } }
    let depth = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        // clear seen for this depth when exiting object
        delete seen[depth];
        depth = Math.max(depth - 1, 0);
      } else if (ch === '"') {
        // read string literal
        let j = i + 1,
          esc = false,
          key = "";
        while (j < str.length) {
          const c = str[j];
          if (!esc && c === "\\") {
            esc = true;
            j++;
          } else if (!esc && c === '"') {
            break;
          } else {
            key += c;
            esc = false;
            j++;
          }
        }
        if (str[j] === '"') {
          // check for colon after it
          const rest = str.slice(j + 1);
          if (/^\s*:/.test(rest)) {
            seen[depth] = seen[depth] || Object.create(null);
            if (seen[depth][key]) {
              duplicates.push({ key, position: i });
            } else {
              seen[depth][key] = true;
            }
          }
          i = j;
        }
      }
    }
    return duplicates;
  }

  // ——— Pretty-print on Ctrl+S, with duplicate-check ———
  function formatJSON() {
    clearStatus();
    const dups = detectDuplicateKeys(element.value);
    if (dups.length) {
      const keys = [...new Set(dups.map((d) => d.key))].join(", ");
      showError(new Error(`Duplicate keys found: ${keys}`));
      return;
    }
    try {
      const obj = JSON.parse(element.value);
      element.value = JSON.stringify(obj, null, 2) + "\n";
      element.style.borderColor = "";
      log("✅ JSON formatted");
      element.dispatchEvent(new Event("input", { bubbles: true }));
    } catch (err) {
      showError(err);
    }
  }

  // ——— Wrap helpers ———
  function wrapSelection(open, close = open) {
    const { selectionStart: s, selectionEnd: e, value: v } = element;
    element.value = v.slice(0, s) + open + v.slice(s, e) + close + v.slice(e);
    element.setSelectionRange(s + 1, e + 1);
    element.focus();
    log(`Wrapped selection with "${open}${close}"`);
  }

  // ——— Debounced live validation + duplicate-check ———
  let tid;
  element.addEventListener("input", () => {
    clearTimeout(tid);
    tid = setTimeout(() => {
      try {
        const dups = detectDuplicateKeys(element.value);
        if (dups.length) {
          const keys = [...new Set(dups.map((d) => d.key))].join(", ");
          throw new Error(`Duplicate keys found: ${keys}`);
        }
        JSON.parse(element.value);
        element.style.borderColor = "";
        clearStatus();
      } catch (err) {
        showError(err);
      }
    }, 300);
  });

  // ——— Key handling ———
  const pairs = { "{": "}", "[": "]", '"': '"' };
  element.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: e0, value: v } = element;
      const lineStart = v.lastIndexOf("\n", s - 1) + 1;
      const prefix = v.slice(lineStart, s).match(/^[ \t]*/)[0];
      const insert = "\n" + prefix;
      element.value = v.slice(0, s) + insert + v.slice(e0);
      const pos = s + insert.length;
      element.setSelectionRange(pos, pos);
      log("↵ Auto-indented");
      element.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (e.key === "Tab") {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: e0, value: v } = element;
      const tab = "  ";
      element.value = v.slice(0, s) + tab + v.slice(e0);
      element.setSelectionRange(s + tab.length, s + tab.length);
      log("⇥ Inserted tab");
      element.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (pairs[e.key] && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: e0, value: v } = element;
      const open = e.key,
        close = pairs[open];
      element.value = v.slice(0, s) + open + close + v.slice(e0);
      element.setSelectionRange(s + 1, s + 1);
      log(`Auto-paired "${open}${close}"`);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    } else if ((e.key === "}" || e.key === "]") && !e.ctrlKey) {
      // e.preventDefault();
      // smartOutdent(e.key);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      formatJSON();
    } else if ((e.ctrlKey || e.metaKey) && e.key === "'") {
      e.preventDefault();
      wrapSelection('"');
    } else if (e.ctrlKey && e.shiftKey && e.key === "{") {
      e.preventDefault();
      wrapSelection("{", "}");
    } else if (e.ctrlKey && e.shiftKey && e.key === "[") {
      e.preventDefault();
      wrapSelection("[", "]");
    }
  });

  // ——— Paste → pretty-format if valid ———
  element.addEventListener("paste", (e) => {
    e.preventDefault();
    const paste = (e.clipboardData || window.clipboardData).getData("text");
    try {
      const obj = JSON.parse(paste);
      const pretty = JSON.stringify(obj, null, 2) + "\n";
      const { selectionStart: s, selectionEnd: e0, value: v } = element;
      element.value = v.slice(0, s) + pretty + v.slice(e0);
      const pos = s + pretty.length;
      element.setSelectionRange(pos, pos);
      log("📋 Pasted & formatted JSON");
      element.dispatchEvent(new Event("input", { bubbles: true }));
    } catch {
      document.execCommand("insertText", false, paste);
      log("📋 Pasted raw text");
    }
  });
}

/**
 * Create an element based on its type
 * @param {Object} renderCmd - The render command
 * @param {HTMLElement} tree_node - The current tree node
 * @param {Object} layout - The layout information
 * @returns {HTMLElement} - The created element
 */
function createElementByType(renderCmd, tree_node, layout) {
  let element;

  switch (renderCmd.elemType) {
    case COMPONENT_TYPES.TEXT:
      element = document.createElement("p");
      element.textContent = renderCmd.text;
      break;

    case COMPONENT_TYPES.TEXT_AREA:
      element = document.createElement("textarea");
      element.textContent = renderCmd.text;
      break;

    case COMPONENT_TYPES.JSON_EDITOR:
      element = document.createElement("textarea");
      element.textContent = renderCmd.text;
      break;

    case COMPONENT_TYPES.ALLOC_TEXT:
      element = document.createElement("p");
      element.textContent = renderCmd.text;
      break;

    case COMPONENT_TYPES.IMAGE:
      element = document.createElement("img");
      element.src = renderCmd.href;
      break;

    case COMPONENT_TYPES.FLEXBOX:
    case COMPONENT_TYPES.BOX:
    case COMPONENT_TYPES.HOOKS:
    case COMPONENT_TYPES.BIND:
    case COMPONENT_TYPES.RECTANGLE:
      element = document.createElement("div");
      break;

    case COMPONENT_TYPES.DIALOG:
      element = document.createElement("dialog");
      break;

    case COMPONENT_TYPES.DIALOG_SHOW:
      if (renderCmd.props.dialogId.length === 0) {
        console.error(
          "DialogId not valid please add an id to the dialog show component",
        );
        return null;
      }
      element = document.createElement("button");
      element.type = "button";
      element.addEventListener("click", (event) => {
        const dialog = document.getElementById(renderCmd.props.dialogId);
        wasmInstance.buttonCallback(renderCmd.props.btnId);
        dialog.showModal();
      });
      break;

    case COMPONENT_TYPES.DIALOG_CLOSE:
      if (renderCmd.props.dialogId.length === 0) {
        console.error(
          "DialogId not valid please add an id to the dialog close component",
        );
        return null;
      }
      element = document.createElement("button");
      element.type = "button";
      element.addEventListener("click", (event) => {
        const dialog = document.getElementById(renderCmd.props.dialogId);
        event.preventDefault();
        event.stopPropagation();
        wasmInstance.buttonCallback(renderCmd.props.btnId);
        dialog.close();
      });
      break;

    case COMPONENT_TYPES.DRAGGABLE:
      element = document.createElement("div");
      break;

    case COMPONENT_TYPES.INPUT:
      element = document.createElement("input");
      processInputElement(element, renderCmd);
      break;

    case COMPONENT_TYPES.BUTTON:
      element = document.createElement("button");
      element.type = "button";
      element.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const idPtr = allocString(renderCmd.id);
        wasmInstance.buttonCallback(idPtr);
      });
      break;

    case COMPONENT_TYPES.BUTTON_CTX:
      element = document.createElement("button");
      element.type = "button";
      element.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const idPtr = allocString(renderCmd.id);
        wasmInstance.ctxButtonCallback(idPtr);
      });
      break;

    case COMPONENT_TYPES.SUBMIT_BUTTON_CTX:
      element = document.createElement("button");
      element.type = "submit";
      break;

    case COMPONENT_TYPES.BLOCK:
      element = document.createElement("div");
      element.textContent = renderCmd.text;
      break;

    case COMPONENT_TYPES.HEADER:
      element = document.createElement("h1");
      element.textContent = renderCmd.text;
      break;

    case COMPONENT_TYPES.SVG:
      element = document.createElement("div");
      element.innerHTML = renderCmd.text;
      break;

    case COMPONENT_TYPES.LINK:
      element = createLinkElement(renderCmd, tree_node, layout);
      break;

    case COMPONENT_TYPES.REDIRECT_LINK:
      element = document.createElement("a");
      element.href = renderCmd.href;
      break;

    case COMPONENT_TYPES.EMBEDLINK:
      element = document.createElement("link");
      element.rel = "stylesheet";
      element.crossorigin = "anonymous";
      element.href = renderCmd.href;
      break;

    case COMPONENT_TYPES.EMBEDICON:
      element = document.createElement("link");
      element.rel = "icon";
      element.crossorigin = "anonymous";
      element.href = renderCmd.href;
      break;

    case COMPONENT_TYPES.ICON:
      element = document.createElement("i");
      element.className = renderCmd.href;
      break;

    case COMPONENT_TYPES.LIST:
      element = document.createElement("ul");
      break;

    case COMPONENT_TYPES.LISTITEM:
      element = document.createElement("li");
      break;

    case COMPONENT_TYPES.SELECT:
      element = document.createElement("select");
      break;

    case COMPONENT_TYPES.SELECT_ITEM:
      element = document.createElement("option");
      break;

    case COMPONENT_TYPES.LABEL:
      element = document.createElement("label");
      element.htmlFor = renderCmd.href;
      element.textContent = renderCmd.text;
      break;

    case COMPONENT_TYPES.FORM:
      element = document.createElement("form");
      element.action = "";
      break;

    case COMPONENT_TYPES.TABLE:
      element = document.createElement("table");
      break;

    case COMPONENT_TYPES.TABLE_ROW:
      element = document.createElement("tr");
      break;

    case COMPONENT_TYPES.TABLE_CELL:
      element = document.createElement("td");
      break;

    case COMPONENT_TYPES.TABLE_HEADER:
      element = document.createElement("th");
      break;

    case COMPONENT_TYPES.TABLE_BODY:
      element = document.createElement("tbody");
      break;

    case COMPONENT_TYPES.CANVAS:
      element = document.createElement("canvas");
      break;

    default:
      element = document.createElement("div");
      break;
  }
  element.id = renderCmd.id;

  return element;
}

/**
 * Setup element with common properties and register it
 * @param {HTMLElement} element - The element to set up
 * @param {Object} renderCmd - The render command
 */
function setupElement(element, renderCmd) {
  element.id = renderCmd.id;

  // Apply styles

  updateComponentStyle(
    renderCmd.nodePtr,
    renderCmd.styleId,
    renderCmd.props.css,
    element,
  );

  if (renderCmd.props.hoverCss.length > 0) {
    applyHoverClass(element, renderCmd.styleId, renderCmd.props.hoverCss);
  }

  // Register the element

  domNodeRegistry.set(renderCmd.id, {
    domNode: element,
    exitAnimationId: renderCmd.exitAnimationId,
    destroyId: renderCmd.hooks.destroyId > 0 ? renderCmd.hooks.destroyId : null,
  });
}

/**
 * Update an existing element
 * @param {HTMLElement} element - The element to update
 * @param {Object} renderCmd - The render command
 */
function updateElement(element, renderCmd) {
  // Update text content if needed
  if (
    renderCmd.elemType === COMPONENT_TYPES.TEXT ||
    renderCmd.elemType === COMPONENT_TYPES.HEADER ||
    renderCmd.elemType === COMPONENT_TYPES.ALLOC_TEXT ||
    renderCmd.elemType === COMPONENT_TYPES.TEXT_AREA
  ) {
    element.textContent = renderCmd.text;
  } else if (renderCmd.elemType === COMPONENT_TYPES.INPUT) {
    element.value = renderCmd.text;
  } else if (renderCmd.elemType === COMPONENT_TYPES.ICON) {
    element.className = renderCmd.href;
  }

  // Update styling
  updateComponentStyle(
    renderCmd.nodePtr,
    renderCmd.styleId,
    renderCmd.props.css,
    element,
  );

  if (renderCmd.props.hoverCss.length > 0) {
    applyHoverClass(element, renderCmd.styleId, renderCmd.props.hoverCss);
  }
}

/**
 * Traverse and render the component tree
 * @param {HTMLElement} parent - The parent element
 * @param {HTMLElement} tree_node - The current tree node
 * @param {Object} layout - The layout information
 */
export function traverse(parent, tree_node, layout) {
  if (!parent) return;

  const children_count = wasmInstance.getTreeNodeChildrenCount(tree_node);

  for (let i = 0; i < children_count; i++) {
    const child_ptr = wasmInstance.getTreeNodeChild(tree_node, i);
    const rndcmd_ptr = wasmInstance.getRenderCommandPtr(child_ptr);
    const renderCmd = readRenderCommand(rndcmd_ptr, layout);

    activeNodeIds.add(renderCmd.id);

    // Skip processing if the element has invalid dialog ID
    if (
      (renderCmd.elemType === COMPONENT_TYPES.DIALOG_SHOW ||
        renderCmd.elemType === COMPONENT_TYPES.DIALOG_CLOSE) &&
      renderCmd.props.dialogId.length === 0
    ) {
      continue;
    }

    if (renderCmd.isDirty) {
      // Mark as processed
      wasmInstance.setDirtyToFalse(renderCmd.nodePtr);

      let element = document.getElementById(renderCmd.id);

      if (!element || state.initial_render) {
        // Create new element
        element = createElementByType(renderCmd, tree_node, layout);

        if (!element) continue; // Skip if element creation failed

        // Set up the element
        setupElement(element, renderCmd);
        // Process children
        traverse(element, child_ptr, layout);

        // Append to parent
        parent.appendChild(element);
        if (renderCmd.elemType === COMPONENT_TYPES.JSON_EDITOR) {
          requestAnimationFrame(() => {
            initJsonEditor(parent, element);
          });
        }

        // Trigger hooks
        if (renderCmd.elemType === COMPONENT_TYPES.HOOKS_CTX) {
          if (renderCmd.hooks.mountedId > 0) {
            wasmInstance.ctxHooksMountedCallback(renderCmd.hooks.mountedId);
          }
        } else {
          if (renderCmd.hooks.mountedId > 0) {
            wasmInstance.hooksMountedCallback(renderCmd.hooks.mountedId);
          }
          if (renderCmd.hooks.createdId > 0) {
            wasmInstance.hooksCreatedCallback(renderCmd.hooks.createdId);
          }
          if (renderCmd.hooks.updatedId > 0) {
            wasmInstance.hooksUpdatedCallback(renderCmd.hooks.updatedId);
          }
        }
      } else {
        // Update existing element
        updateElement(element, renderCmd);

        // Process children
        traverse(element, child_ptr, layout);
      }
    } else {
      // Element is not dirty, just process its children
      const element = document.getElementById(renderCmd.id);
      traverse(element, child_ptr, layout);
    }
  }
}

export function traverseRemove(parent, tree_node, layout) {
  if (!parent) return;

  const children_count = wasmInstance.getTreeNodeChildrenCount(tree_node);

  for (let i = 0; i < children_count; i++) {
    const child_ptr = wasmInstance.getTreeNodeChild(tree_node, i);
    const rndcmd_ptr = wasmInstance.getRenderCommandPtr(child_ptr);
    const renderCmd = readRenderCommand(rndcmd_ptr, layout);

    if (renderCmd.isDirty) {
      const node = domNodeRegistry.get(renderCmd.id);
      const el = node.domNode;
      domNodeRegistry.delete(renderCmd.id);
      el.remove();
      wasmInstance.setDirtyToFalse(renderCmd.nodePtr);
    }
  }
}
