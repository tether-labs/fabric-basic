import {
  eventHandlers,
  elementDimensions,
  charts,
  hooksHandlers,
  eventStorage,
} from "./maps.js";
import { styleSheet } from "./wasi_styling.js";
import {
  allocString,
  readWasmString,
  encodeString,
  rootNodeId,
  layoutInfo,
} from "./wasi_obj.js";
import { traverse, clearIntervalsForRoute } from "./traversal.js";
import { state } from "./state.js";

let wasmInstance = null;

export const importObject = {
  wasi_snapshot_preview1: {
    proc_exit: (code) => {
      // console.error("Exiting with code:", code);
    },
    clock_time_get: (clockId, precision, resultPtr) => {
      // clock_time_get: (code) => {
      const now = BigInt(Date.now()) * 1000000n;
      const view = new DataView(wasmInstance.memory.buffer);
      view.setBigUint64(resultPtr, now, true);
      return 0;
    },
    poll_oneoff: async (
      inSubscriptionsPtr,
      outEventsPtr,
      nSubscriptions,
      neventsPtr,
    ) => {
      // promiseResolved = false; // Reset before new call
      const CLOCK_TIMEOUT_OFFSET = 24; // Make sure this offset is correct
      const view = new DataView(wasmInstance.memory.buffer);

      // Read timeout from WASM memory
      const timeoutNanoSeconds = view.getBigUint64(
        inSubscriptionsPtr + CLOCK_TIMEOUT_OFFSET,
        true,
      );

      const timeoutMillis = Number(timeoutNanoSeconds / 1000000n);

      console.log("Timeout duration (ms):", timeoutMillis);
      // await sleep(2000);

      // if (is_in_timeout === false) {
      // is_in_timeout = true;
      new Promise((resolve) => {
        console.log("Starting", timeoutMillis);
        setTimeout(() => {
          console.log(`setTimeout resolved after ${timeoutMillis}ms`);
          promiseResolved = true; // Mark as resolved
          resolve(0); // Resolve with success code
        }, timeoutMillis);
      });
      return 0;
    },

    random_get: (bufPtr, bufLen) => {
      const randomBuffer = new Uint8Array(
        wasmInstance.memory.buffer,
        bufPtr,
        bufLen,
      );
      crypto.getRandomValues(randomBuffer);
      return 0;
    },
    fd_write: (fd, iovs_ptr, iovs_len, nwritten_ptr) => {
      if (fd === 1) {
        const memory = new Uint8Array(wasmInstance.memory.buffer);
        let written = 0;
        for (let i = 0; i < iovs_len; i++) {
          const iov = new Uint32Array(memory.buffer, iovs_ptr + i * 8, 2);
          const ptr = iov[0];
          const len = iov[1];
          const str = new TextDecoder().decode(memory.subarray(ptr, ptr + len));
          console.log("[Zig stdout]", str);
          written += len;
        }
        // Write the total bytes written back to memory
        new Uint32Array(memory.buffer)[nwritten_ptr / 4] = written;
        return 0; // Success
      }
      return 8; // EBADF: Bad file descriptor
    },
    // Other WASI stubs (minimal implementation)
    fd_close: () => 0,
    fd_seek: () => 0,
    fd_read: () => {
      console.log("fakjsdhflkajsdhflkajsdfh;laksfj");
    },
    environ_sizes_get: () => 0,
    environ_get: () => 0,
  }, // Link WASI stubs
  env: {
    consoleLog: (ptr, len) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }
      const memory = new Uint8Array(wasmInstance.memory.buffer);
      const str = new TextDecoder().decode(memory.subarray(ptr, ptr + len));
      console.log("[Fabric]", str);
    },

    consoleLogColored: (
      ptr,
      len,
      stylePtr1,
      styleLen1,
      stylePtr2,
      styleLen2,
    ) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }
      const str = readWasmString(ptr, len);
      const style1 = readWasmString(stylePtr1, styleLen1);
      const style2 = readWasmString(stylePtr2, styleLen2);
      console.log(str, style1, style2);
    },

    trackAlloc: () => {
      const err = new Error();
      Error.captureStackTrace(err, wasmInstance.trackAlloc);
      console.log(err.stack);
    },

    copyText: (ptr, len) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }
      const memory = new Uint8Array(wasmInstance.memory.buffer);
      const text = new TextDecoder().decode(memory.subarray(ptr, ptr + len));

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).catch((err) => {
          console.error("Clipboard write failed:", err);
        });
      }
    },
    removeElementEventListener: (idPtr, idLen, ptr, len, id) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }
      const memory = new Uint8Array(wasmInstance.memory.buffer);

      const elementId = new TextDecoder().decode(
        memory.subarray(idPtr, idPtr + idLen),
      );

      const element = document.getElementById(elementId);

      const event_type = new TextDecoder().decode(
        memory.subarray(ptr, ptr + len),
      );

      const cb = eventHandlers.get(`fb-evt-hd-${id}-${elementId}`);
      element.removeEventListener(event_type, cb);
    },
    createElementEventInstListener: (idPtr, idLen, ptr, len, id) => {
      requestAnimationFrame(() => {
        if (!wasmInstance) {
          console.error("WASM instance not initialized");
          return;
        }
        const memory = new Uint8Array(wasmInstance.memory.buffer);

        const elementId = new TextDecoder().decode(
          memory.subarray(idPtr, idPtr + idLen),
        );

        const element = document.getElementById(elementId);
        const event_type = new TextDecoder().decode(
          memory.subarray(ptr, ptr + len),
        );
        eventHandlers.set(`fb-inst-evt-hd-${id}-${elementId}`, (event) => {
          eventStorage[id] = event;
          wasmInstance.eventInstCallback(id);
        });
        element.addEventListener(
          event_type,
          eventHandlers.get(`fb-inst-evt-hd-${id}-${elementId}`),
        );
      });
    },

    createElementEventListener: (idPtr, idLen, ptr, len, id) => {
      requestAnimationFrame(() => {
        if (!wasmInstance) {
          console.error("WASM instance not initialized");
          return;
        }
        const memory = new Uint8Array(wasmInstance.memory.buffer);

        const elementId = new TextDecoder().decode(
          memory.subarray(idPtr, idPtr + idLen),
        );

        const element = document.getElementById(elementId);
        const event_type = new TextDecoder().decode(
          memory.subarray(ptr, ptr + len),
        );
        eventHandlers.set(`fb-evt-hd-${id}-${elementId}`, (event) => {
          eventStorage[id] = event;
          // console.log(event, event.srcElement);
          wasmInstance.eventCallback(id);
        });
        element.addEventListener(
          event_type,
          eventHandlers.get(`fb-evt-hd-${id}-${elementId}`),
        );
      });
    },
    elementFocus: (idPtr, idLen) => {
      requestAnimationFrame(() => {
        if (!wasmInstance) {
          console.error("WASM instance not initialized");
          return;
        }

        const memory = new Uint8Array(wasmInstance.memory.buffer);
        const elementId = new TextDecoder().decode(
          memory.subarray(idPtr, idPtr + idLen),
        );
        const element = document.getElementById(elementId);
        if (element) {
          element.focus();
          return;
        }
        console.log("Element is null, could not add focus", elementId);
      });
    },
    createEventListener: (ptr, len, id) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }

      const memory = new Uint8Array(wasmInstance.memory.buffer);
      const event_type = new TextDecoder().decode(
        memory.subarray(ptr, ptr + len),
      );
      document.addEventListener(event_type, (event) => {
        eventStorage[id] = event;
        wasmInstance.eventCallback(id);
      });
    },
    getEventDataInputWasm: (id) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }

      const event = eventStorage[id];
      const value = event.target.value;
      return allocString(value);
    },
    getEventDataWasm: (id, ptr, len) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }

      const memory = new Uint8Array(wasmInstance.memory.buffer);
      const key = new TextDecoder().decode(memory.subarray(ptr, ptr + len));
      const event = eventStorage[id];
      const keyValue = event[key];
      return allocString(keyValue);
    },

    getAttributeWasmNumber: (ptr, len, attributePtr, attributeLen) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }
      const memory = new Uint8Array(wasmInstance.memory.buffer);
      const id = new TextDecoder().decode(memory.subarray(ptr, ptr + len));
      const attribute = new TextDecoder().decode(
        memory.subarray(attributePtr, attributePtr + attributeLen),
      );
      const element = document.getElementById(id);
      const value = element[attribute];
      return value;
    },

    getInputValueWasm: (ptr, len) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }

      const memory = new Uint8Array(wasmInstance.memory.buffer);
      const id = new TextDecoder().decode(memory.subarray(ptr, ptr + len));
      const element = document.getElementById(id);
      const value = element.value;
      return allocString(value);
    },
    setInputValueWasm: (ptr, len, textPtr, textLen) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }

      const id = readWasmString(ptr, len);
      const text = readWasmString(textPtr, textLen);
      const element = document.getElementById(id);
      element.value = text;
    },

    getEventDataNumberWasm: (id, ptr, len) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }

      const memory = new Uint8Array(wasmInstance.memory.buffer);
      const key = new TextDecoder().decode(memory.subarray(ptr, ptr + len));
      const event = eventStorage[id];
      const keyValue = event[key];
      return keyValue;
    },
    getOffsetsWasm: (idPtr, idLen) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }
      const memory = new Uint8Array(wasmInstance.memory.buffer);

      const id = new TextDecoder().decode(
        memory.subarray(idPtr, idPtr + idLen),
      );

      const element = document.getElementById(id);
      if (!element) {
        console.error(`Element with id ${id} not found`);
        return 0; // Return null pointer if element doesn't exist
      }

      const currentTime = performance.now();
      const cachedDimensions = elementDimensions.get(id);

      // Use cached dimensions if they exist and are recent enough
      if (
        cachedDimensions &&
        currentTime - cachedDimensions.lastUpdateTime < 16
      ) {
        // Reuse existing dimensions without querying the DOM
        const ptr = wasmInstance.allocate(6);
        const bounds = new Float32Array(memory.buffer, ptr, 6);
        bounds[0] = cachedDimensions.offsetTop;
        bounds[1] = cachedDimensions.offsetLeft;
        bounds[2] = cachedDimensions.offsetRight;
        bounds[3] = cachedDimensions.offsetBottom;
        bounds[4] = cachedDimensions.offsetWidth;
        bounds[5] = cachedDimensions.offsetHeight;

        return ptr;
      }

      // Otherwise read from DOM and update cache
      const dimensions = {
        offsetTop: element.offsetTop,
        offsetLeft: element.offsetLeft,
        offsetRight: element.offsetLeft + element.offsetWidth, // offsetRight is not a standard property
        offsetBottom: element.offsetTop + element.offsetHeight, // offsetBottom is not a standard property
        offsetWidth: element.offsetWidth,
        offsetHeight: element.offsetHeight,
        lastUpdateTime: currentTime,
      };

      // Store in cache
      elementDimensions.set(id, dimensions);

      // Allocate memory and return pointer to WASM
      const ptr = wasmInstance.allocate(6);
      const bounds = new Float32Array(memory.buffer, ptr, 6);

      bounds[0] = dimensions.offsetTop;
      bounds[1] = dimensions.offsetLeft;
      bounds[2] = dimensions.offsetRight;
      bounds[3] = dimensions.offsetBottom;
      bounds[4] = dimensions.offsetWidth;
      bounds[5] = dimensions.offsetHeight;

      return ptr;
    },
    getClientPos: (idPtr, idLen) => {
      requestAnimationFrame(() => {
        if (!wasmInstance) {
          console.error("WASM instance not initialized");
          return;
        }
        const memory = new Uint8Array(wasmInstance.memory.buffer);

        const elementId = new TextDecoder().decode(
          memory.subarray(idPtr, idPtr + idLen),
        );

        const ptr = wasmInstance.allocate(6);
        const bounds = new Float32Array(memory.buffer, ptr, 6);

        const element = document.getElementById(elementId);
        const rectBounds = element.getBoundingClientRect();
        bounds[0] = rectBounds.top;
        bounds[1] = rectBounds.left;
        bounds[2] = rectBounds.right;
        bounds[3] = rectBounds.bottom;
        bounds[4] = rectBounds.width;
        bounds[5] = rectBounds.height;
        return ptr;
      });
    },

    getBoundingClientRectWasm: (idPtr, idLen) => {
      requestAnimationFrame(() => {
        if (!wasmInstance) {
          console.error("WASM instance not initialized");
          return;
        }
        const memory = new Uint8Array(wasmInstance.memory.buffer);

        const elementId = new TextDecoder().decode(
          memory.subarray(idPtr, idPtr + idLen),
        );

        const ptr = wasmInstance.allocate(6);
        const bounds = new Float32Array(memory.buffer, ptr, 6);

        const element = document.getElementById(elementId);
        const rectBounds = element.getBoundingClientRect();
        bounds[0] = rectBounds.top;
        bounds[1] = rectBounds.left;
        bounds[2] = rectBounds.right;
        bounds[3] = rectBounds.bottom;
        bounds[4] = rectBounds.width;
        bounds[5] = rectBounds.height;
        return ptr;
      });
    },
    getElementData: (id, ptr, len) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }

      const memory = new Uint8Array(wasmInstance.memory.buffer);
      const key = new TextDecoder().decode(memory.subarray(ptr, ptr + len));
      const event = eventStorage[id];
      const keyValue = event[key];
      return allocString(keyValue);
    },

    eventPreventDefault: (id, ptr, len) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }
      const event = eventStorage[id];
      console.log("Preventing first");
      event.preventDefault();
    },
    checkFutureResolved(futureId) {
      const future = futureRegistry[futureId];
      if (!future) return 0; // Not found
      return future.resolved ? 1 : 0;
    },
    getFutureValue(futureId) {
      const future = futureRegistry[futureId];
      if (!future || !future.resolved) return undefined;

      // Clean up the registry
      const value = future.value;
      delete futureRegistry[futureId];
      return value;
    },

    registerTimeout(ms) {
      // Create a unique ID for this timeout
      const futureId = nextFutureId++;

      // Create a promise that will resolve after the timeout
      futureRegistry[futureId] = {
        resolved: false,
        value: undefined,
        error: undefined,
      };

      // Start the timeout
      setTimeout(() => {
        futureRegistry[futureId].resolved = true;
        futureRegistry[futureId].value = true;
      }, ms);

      // Return the ID to WASM so it can check status later
      return futureId;
    },

    createPromise() {
      const promiseId = nextPromiseId++;

      // Create the promise and store its resolve/reject functions
      let promiseResolve, promiseReject;
      const promise = new Promise((resolve, reject) => {
        promiseResolve = resolve;
        promiseReject = reject;
      });

      // Store everything in the registry
      promiseRegistry[promiseId] = {
        promise,
        resolve: promiseResolve,
        reject: promiseReject,
      };

      return promiseId;
    },

    // Function to resolve a promise from WASM side
    resolvePromise(promiseId, value) {
      const entry = promiseRegistry[promiseId];
      if (entry) {
        entry.resolve(value);
        delete promiseRegistry[promiseId];
      }
    },

    // Function to get a promise by ID (to await it)
    getPromiseById(promiseId) {
      const entry = promiseRegistry[promiseId];
      return entry ? entry.promise : null;
    },

    // This  sets a timeout and resolves a promise when done
    promiseTimeout(promiseId, ms) {
      setTimeout(() => {
        resolvePromise(promiseId, true);
      }, ms);
    },

    // Wrapper to make WASM s return promises
    zigFunctionReturningPromise(wasmInstance) {
      return async function (arg1, arg2) {
        // Call the WASM function which returns a promise ID
        const promiseId = wasmInstance.exports.onMount(arg1, arg2);

        // Get the actual promise to await
        const promise = getPromiseById(promiseId);
        if (!promise) {
          throw new Error("WASM function did not return a valid promise ID");
        }

        // Await and return the result
        return await promise;
      };
    },

    zig_sleep: async (ms) => {
      const asyncExample = createAsyncWasmFunction(wasmInstance, "wasm_sleep");
      const result = await asyncExample(2000);
    },

    timeout: (ms, callbackId) => {
      console.log(`Setting timeout for ${ms}ms with callback ID ${callbackId}`);
      setTimeout(() => {
        console.log(
          `Timeout complete, resuming with callback ID ${callbackId}`,
        );
        wasmInstance.buttonCallback(callbackId);
      }, ms);
    },

    timeoutCtx: (ms, callbackId) => {
      console.log(`Setting timeout for ${ms}ms with callback ID ${callbackId}`);
      setTimeout(() => {
        console.log(
          `Timeout complete, resuming with callback ID ${callbackId}`,
        );
        wasmInstance.ctxButtonCallback(callbackId);
      }, ms);
    },

    // id element_type function
    createElement: (
      idPtr,
      idLen,
      elementType,
      btnId,
      // btnIdPtr,
      // btnIdLen,
      textPtr,
      textLen,
    ) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }
      const memory = new Uint8Array(wasmInstance.memory.buffer);
      const id = new TextDecoder().decode(
        memory.subarray(idPtr, idPtr + idLen),
      );
      // const btnId = new TextDecoder().decode(
      //   memory.subarray(btnIdPtr, btnIdPtr + btnIdLen),
      // );
      const text = new TextDecoder().decode(
        memory.subarray(textPtr, textPtr + textLen),
      );

      const elementDetails = {
        id,
        elementType,
        btnId,
        text,
      };
      // const elementDetails = readElementDetails(
      //   elementDeclarationPtr,
      //   layout,
      // );
      console.log("[Fabric]", elementDetails);
    },
    createInterval: (namePtr, nameLen, delay) => {
      const name = readWasmString(namePtr, nameLen);
      setInterval(() => {
        const ptr = allocString(name);
        wasmInstance.timeOutCtxCallback(ptr);
      }, delay);
    },
    showDialog: (idPtr, idLen) => {
      requestAnimationFrame(() => {
        if (!wasmInstance) {
          console.error("WASM instance not initialized");
          return;
        }
        const memory = new Uint8Array(wasmInstance.memory.buffer);
        const id = new TextDecoder().decode(
          memory.subarray(idPtr, idPtr + idLen),
        );
        const dialog = document.getElementById(id);
        if (dialog === null) {
          console.log("Is Null");
          return;
        }
        dialog.showModal();
      });
    },
    closeDialog: (idPtr, idLen) => {
      requestAnimationFrame(() => {
        if (!wasmInstance) {
          console.error("WASM instance not initialized");
          return;
        }
        const memory = new Uint8Array(wasmInstance.memory.buffer);
        const id = new TextDecoder().decode(
          memory.subarray(idPtr, idPtr + idLen),
        );
        const dialog = document.getElementById(id);
        if (dialog === null) {
          console.log("Is Null");
          return;
        }
        dialog.close();
      });
    },
    callClickWASM: (idPtr, idLen) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }
      const id = readWasmString(idPtr, idLen);
      const element = document.getElementById(id);
      if (element === null) {
        console.log("Is Null");
        return;
      }

console.log(element);
      element.click();
    },
    mutateDomElementStyleWasm: (
      idPtr,
      idLen,
      attributePtr,
      attributeLen,
      value,
    ) => {
      requestAnimationFrame(() => {
        if (!wasmInstance) {
          console.error("WASM instance not initialized");
          return;
        }
        const memory = new Uint8Array(wasmInstance.memory.buffer);
        const id = new TextDecoder().decode(
          memory.subarray(idPtr, idPtr + idLen),
        );
        const attribute = new TextDecoder().decode(
          memory.subarray(attributePtr, attributePtr + attributeLen),
        );
        const element = document.getElementById(id);
        if (element === null) {
          console.log("Is Null");
          return;
        }

        if (attribute === "top" || attribute === "left") {
          element.style[attribute] = `${value}px`;
        } else {
          element.style[attribute] = value;
        }
      });
    },
    removeFromParent: (idPtr, idLen) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }
      const memory = new Uint8Array(wasmInstance.memory.buffer);
      const id = new TextDecoder().decode(
        memory.subarray(idPtr, idPtr + idLen),
      );
      const element = document.getElementById(id);
      if (element === null) {
        console.log("Is Null");
        return;
      }
      const parent = element.parentNode;
      parent.removeChild(element);
    },
    addChild: (idPtr, idLen, idChildPtr, idChildLen) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }
      const memory = new Uint8Array(wasmInstance.memory.buffer);
      const id = new TextDecoder().decode(
        memory.subarray(idPtr, idPtr + idLen),
      );
      const element = document.getElementById(id);
      if (element === null) {
        console.log("Is Null");
        return;
      }
      const childId = new TextDecoder().decode(
        memory.subarray(idChildPtr, idChildPtr + idChildLen),
      );
      const childElement = document.getElementById(childId);
      if (childElement === null) {
        console.log("Is Null");
        return;
      }
      element.appendChild(childElement);
    },
    // this is not synchornous
    addClass: (idPtr, idLen, idClassPtr, idClassLen) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }
      const memory = new Uint8Array(wasmInstance.memory.buffer);
      const id = new TextDecoder().decode(
        memory.subarray(idPtr, idPtr + idLen),
      );
      const element = document.getElementById(id);
      if (element === null) {
        console.log("Is Null");
        return;
      }
      const classId = new TextDecoder().decode(
        memory.subarray(idClassPtr, idClassPtr + idClassLen),
      );
      element.classList.add(classId);
    },
    createClass: (classPtr, classLen) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }
      const memory = new Uint8Array(wasmInstance.memory.buffer);
      const classStyle = new TextDecoder().decode(
        memory.subarray(classPtr, classPtr + classLen),
      );
      // Check if we already have this class
      const newIndex = styleSheet.cssRules.length;

      styleSheet.insertRule(`${classStyle}`, newIndex);
    },
    removeClass: (idPtr, idLen, idClassPtr, idClassLen) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }
      const memory = new Uint8Array(wasmInstance.memory.buffer);
      const id = new TextDecoder().decode(
        memory.subarray(idPtr, idPtr + idLen),
      );
      const element = document.getElementById(id);
      if (element === null) {
        console.log("Is Null");
        return;
      }
      const classId = new TextDecoder().decode(
        memory.subarray(idClassPtr, idClassPtr + idClassLen),
      );
      element.classList.remove(classId);
    },
    mutateDomElementStyleStringWasm: (
      idPtr,
      idLen,
      attributePtr,
      attributeLen,
      valuePtr,
      valueLen,
    ) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }
      const memory = new Uint8Array(wasmInstance.memory.buffer);
      const id = new TextDecoder().decode(
        memory.subarray(idPtr, idPtr + idLen),
      );
      const attribute = new TextDecoder().decode(
        memory.subarray(attributePtr, attributePtr + attributeLen),
      );
      const value = new TextDecoder().decode(
        memory.subarray(valuePtr, valuePtr + valueLen),
      );
      const element = document.getElementById(id);
      if (element === null) {
        console.log("Is Null");
        return;
      }

      console.log(value, attribute);
      element.style[attribute] = value;
    },
    mutateDomElementWasm: (idPtr, idLen, attributePtr, attributeLen, value) => {
      requestAnimationFrame(() => {
        if (!wasmInstance) {
          console.error("WASM instance not initialized");
          return;
        }
        const memory = new Uint8Array(wasmInstance.memory.buffer);
        const id = new TextDecoder().decode(
          memory.subarray(idPtr, idPtr + idLen),
        );
        const attribute = new TextDecoder().decode(
          memory.subarray(attributePtr, attributePtr + attributeLen),
        );
        const element = document.getElementById(id);
        if (element === null) {
          console.log("Is Null");
          return;
        }

        element[attribute] = value;
      });
    },

    setLocalStorageStringWasm: (ptr, len, valuePtr, valueLen) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }
      const key = readWasmString(ptr, len);
      const value = readWasmString(valuePtr, valueLen);
      localStorage.setItem(key, value);
    },

    setLocalStorageNumberWasm: (ptr, len, value) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }
      const key = readWasmString(ptr, len);
      localStorage.setItem(key, value);
    },

    getLocalStorageNumberWasm: (ptr, len) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }
      const key = readWasmString(ptr, len);
      const value = localStorage.getItem(key);
      return value;
    },

    getLocalStorageStringWasm: (ptr, len) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }
      const key = readWasmString(ptr, len);
      const value = localStorage.getItem(key);
      return allocString(value);
    },

    removeLocalStorageWasm: (ptr, len) => {
      if (!wasmInstance) {
        console.error("WASM instance not initialized");
        return;
      }
      const key = readWasmString(ptr, len);
      localStorage.removeItem(key);
    },

    clearLocalStorageWasm: () => {
      localStorage.clear();
    },

    getWindowInformationWasm: () => {
      return allocString(window.location.pathname);
    },

    getWindowParamsWASM: () => {
      return allocString(window.location.search);
    },

    setWindowLocationWASM: (urlPtr, urlLen) => {
      const url = readWasmString(urlPtr, urlLen);
      window.location.href = url;
    },

    navigateWASM: (pathPtr, pathLen) => {
      const path = readWasmString(pathPtr, pathLen);

      const currentPath = window.location.pathname;
      clearIntervalsForRoute(currentPath);

      window.history.pushState({}, "", path);

      encodeString(path === "/" ? "/root" : path);
      const rootElement = document.getElementById(rootNodeId);
      rootElement.innerHTML = "";
      const newTreeNode = wasmInstance.getRenderTreePtr();
      state.initial_render = true;
      traverse(rootElement, newTreeNode, layoutInfo);
      state.initial_render = false;
    },

    routePushWASM: (pathPtr, pathLen) => {
      const path = readWasmString(pathPtr, pathLen);
      window.location.href = path;
    },

    createHookWASM: (endpointPtr, endpointLen, id) => {
      const endpoint = readWasmString(endpointPtr, endpointLen);
      const hookId = `${endpoint}-${id}`;

      console.log(hookId);
      hooksHandlers.set(hookId, () => {
        wasmInstance.hookInstCallback(id);
      });
    },

    setCookieWASM: (cookieStrPtr, cookieStrLen) => {
      const cookie = readWasmString(cookieStrPtr, cookieStrLen);
      document.cookie = cookie;
    },

    getCookiesWASM: () => {
      return allocString(document.cookie);
    },

    getCookieWASM: (cookieStrPtr, cookieStrLen) => {
      const cookie = readWasmString(cookieStrPtr, cookieStrLen);
      const match = document.cookie.match(new RegExp(`(^| )${cookie}=([^;]+)`));
      return match ? allocString(decodeURIComponent(match[2])) : null;
    },

    js_fetch_params: (urlPtr, urlLen, callback_id, httpPtr, httpLen) => {
      // Decode URL string out of WASM memory

      const url = readWasmString(urlPtr, urlLen);
      const data = readWasmString(httpPtr, httpLen);

      const Request = JSON.parse(data);

      // Fire off the fetch
      const response = {};
      fetch(url, Request)
        .then((res) => {
          response.code = res.status;
          response.text = res.statusText;
          response.type = res.type;
          return res.text();
        })
        .then((text) => {
          // Encode the response back into WASM memory
          response.body = text;
          const respString = JSON.stringify(response);
          const ptr = allocString(respString); // assume you exposed an `alloc` func

          // Call back into Zig
          wasmInstance.resumeCallback(callback_id, ptr);
        })
        .catch((err) => {
          console.error("Fetch failed:", err);
          // You could call callback with ptr=0,len=0 or export an error handler
        });
    },

    // callHooks: () => {
    //   for (const [key, handler] of hooksHandlers.entries()) {
    //     const pathEnd = key.indexOf("-");
    //     const path = key.substring(0, pathEnd);
    //     if (path === "/nightwatch/auth") {
    //       handler();
    //     } else if (path === "*") {
    //       handler();
    //     }
    //   }
    // },

    js_fetch: (urlPtr, urlLen, callback_id) => {
      // Decode URL string out of WASM memory
      const urlBytes = new Uint8Array(
        wasmInstance.memory.buffer,
        urlPtr,
        urlLen,
      );
      const url = new TextDecoder().decode(urlBytes);

      // Fire off the fetch
      fetch(url)
        .then((res) => res.text())
        .then((text) => {
          // Encode the response back into WASM memory
          const ptr = allocString(text); // assume you exposed an `alloc` func

          // Call back into Zig
          wasmInstance.resumeCallback(callback_id, ptr);
        })
        .catch((err) => {
          console.error("Fetch failed:", err);
          // You could call callback with ptr=0,len=0 or export an error handler
        });
    },
    createChartWasm: (idPtr, idLen, configPtr, configLen) => {
      requestAnimationFrame(() => {
        const id = readWasmString(idPtr, idLen);
        const config = readWasmString(configPtr, configLen);
        const configJson = JSON.parse(config);
        const ctx = document.getElementById(id);
        const newChart = new Chart(ctx, configJson);
        charts.set(id, newChart);
      });
    },
    updateChartWasm: (idChartPtr, idChartLen, index, arrPtr, arrLen) => {
      const id = readWasmString(idChartPtr, idChartLen);
      const array = new Float64Array(
        wasmInstance.memory.buffer,
        arrPtr,
        arrLen,
      );
      const chart = charts.get(id);
      chart.data.datasets[index].data = array;
      chart.update();
    },
    initEditor: (idPtr, idLen) => {
      const id = new TextDecoder().decode(
        memory.subarray(idPtr, idPtr + idLen),
      );

      const ta = document.getElementById(id);

      // 1) Auto-indent on Enter
      ta.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const { selectionStart, selectionEnd, value } = ta;
          const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
          const lineSoFar = value.slice(lineStart, selectionStart);
          const indent = (lineSoFar.match(/^[ \t]*/) || [""])[0];
          const insert = "\n" + indent;
          ta.value =
            value.slice(0, selectionStart) + insert + value.slice(selectionEnd);
          const pos = selectionStart + insert.length;
          ta.setSelectionRange(pos, pos);
        }
      });

      // 2) Insert Tab (or spaces) instead of leaving textarea
      ta.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          const { selectionStart, selectionEnd, value } = ta;
          const tab = "  "; // two spaces—or use "\t"
          ta.value =
            value.slice(0, selectionStart) + tab + value.slice(selectionEnd);
          const pos = selectionStart + tab.length;
          ta.setSelectionRange(pos, pos);
        }
      });

      // 3) Auto-close braces/brackets/quotes
      ta.addEventListener("keydown", (e) => {
        const pairs = { "{": "}", "[": "]", '"': '"' };
        if (pairs[e.key]) {
          e.preventDefault();
          const { selectionStart, selectionEnd, value } = ta;
          const open = e.key;
          const close = pairs[e.key];
          ta.value =
            value.slice(0, selectionStart) +
            open +
            close +
            value.slice(selectionEnd);
          // place cursor between the pair
          const pos = selectionStart + 1;
          ta.setSelectionRange(pos, pos);
        }
      });

      // 4) Smart outdent on closing brace/bracket
      ta.addEventListener("keydown", (e) => {
        if (e.key === "}" || e.key === "]") {
          e.preventDefault();
          const { selectionStart, selectionEnd, value } = ta;
          // remove any indent on the current line
          const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
          const afterLine = value.slice(selectionStart);
          const beforeLine =
            value.slice(0, lineStart) +
            value.slice(lineStart).replace(/^[ \t]*/, "");
          // insert the closing char at the (outdented) line start
          ta.value =
            beforeLine.slice(0, lineStart) +
            e.key +
            beforeLine.slice(lineStart) +
            afterLine;
          const pos = lineStart + 1;
          ta.setSelectionRange(pos, pos);
        }
      });

      // 5) Paste → pretty-format JSON if valid
      ta.addEventListener("paste", async (e) => {
        e.preventDefault();
        const paste = (e.clipboardData || window.clipboardData).getData("text");
        try {
          const obj = JSON.parse(paste);
          const pretty = JSON.stringify(obj, null, 2) + "\n";
          const { selectionStart, selectionEnd, value } = ta;
          ta.value =
            value.slice(0, selectionStart) + pretty + value.slice(selectionEnd);
          const pos = selectionStart + pretty.length;
          ta.setSelectionRange(pos, pos);
        } catch {
          // not valid JSON: just insert raw
          document.execCommand("insertText", false, paste);
        }
      });

      // 6) Live validation (red border on invalid JSON)
      ta.addEventListener("input", () => {
        try {
          JSON.parse(ta.value);
          ta.style.borderColor = "";
        } catch {
          ta.style.borderColor = "red";
        }
      });

      // // 7) Ctrl+S to download current content as .json file
      // window.addEventListener("keydown", (e) => {
      //   if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      //     e.preventDefault();
      //     const blob = new Blob([ta.value], { type: "application/json" });
      //     const url = URL.createObjectURL(blob);
      //     const a = document.createElement("a");
      //     a.href = url;
      //     a.download = "data.json";
      //     a.click();
      //     URL.revokeObjectURL(url);
      //   }
      // });
    },
  },
};

export function setWasiInstance(instance) {
  wasmInstance = instance;
}
