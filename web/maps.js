// Global registry of all created DOM nodes
export const domNodeRegistry = new Map(); // Maps: vNodeId -> domNode
export const eventHandlers = new Map(); // Maps: vNodeId -> domNode
export const elementDimensions = new Map(); // Maps: vNodeId -> domNode
export const moduleCache = new Map(); // Maps: path -> wasi_exports
export const charts = new Map(); // Maps: path -> wasi_exports
export const moduleRoutes = new Set(); // Maps: path -> wasi_exports
export const hooksHandlers = new Map();
export let eventStorage = {};

