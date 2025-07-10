import { wasmInstance } from "./wasi_obj.js";
export const styleSheet =
  document.styleSheets[0] ||
  document.head.appendChild(document.createElement("style")).sheet;
const styleRuleCache = new Map(); // Track rule indices for fast updates

export function addKeyframesToStylesheet(keyframesCSS) {
  // Get or create stylesheet
  const styleSheet =
    document.styleSheets[0] ||
    document.head.appendChild(document.createElement("style")).sheet;

  // Insert keyframes rule into the stylesheet
  styleSheet.insertRule(keyframesCSS, styleSheet.cssRules.length);
}

// Function to add or update a component's style
export function updateComponentStyle(
  nodePtr,
  specified_className,
  styleString,
  element,
) {
  let className = `fabric-component-${element.id}`;
  // Here we check if the user specfied a class name
  if (styleRuleCache.has(className)) {
    // Update existing rule
    const ruleIndex = styleRuleCache.get(className);
    // To ensure proper update, delete and re-insert
    styleSheet.deleteRule(ruleIndex);
    styleSheet.insertRule(`.${className} { ${styleString} }`, ruleIndex);
    element.className = className;
  } else if (
    specified_className.length > 0 &&
    styleRuleCache.has(specified_className)
  ) {
    // Update existing rule
    const ruleIndex = styleRuleCache.get(className);
    styleSheet.deleteRule(ruleIndex);
    styleSheet.insertRule(`.${className} { ${styleString} }`, ruleIndex);
    element.className = className;
    // Here we check if the user specfied a class name
  } else if (
    element.className.length === 0 &&
    specified_className.length === 0
  ) {
    if ("carousel-component-1" === element.id) {
      console.log(styleString);
      console.log(element, specified_className, nodePtr);
    }
    // Add new rule
    const newIndex = styleSheet.cssRules.length;
    styleSheet.insertRule(`.${className} { ${styleString} }`, newIndex);
    styleRuleCache.set(className, newIndex);

    // 2. Conditionally hide the scrollbar in WebKit if showScrollBar() === 0
    if (wasmInstance.showScrollBar(nodePtr) === 0) {
      const webkitRule = `
                                                                                                                                .${className}::-webkit-scrollbar {
                                                                                                                                  display: none;
                                                                                                                                }
                                                                                                                              `;
      styleSheet.insertRule(webkitRule, styleSheet.cssRules.length);
    }
    element.className = className;
  } else if (specified_className.length > 0 && element.localName !== "i") {
    element.className = specified_className;
    // element.style = styleString;
    const newIndex = styleSheet.cssRules.length;
    styleSheet.insertRule(
      `.${specified_className} { ${styleString} }`,
      newIndex,
    );
    styleRuleCache.set(specified_className, newIndex);
  } else {
    // This is for icons
    className = element.className;
    // element.style = styleString;
    const newIndex = styleSheet.cssRules.length;
    styleSheet.insertRule(
      `.${className.split(" ").pop()} { ${styleString} }`,
      newIndex,
    );
    styleRuleCache.set(className, newIndex);
  }

  // Apply class to element

  return className;
}

export function checkMarkStyling(id, element, styleId, checkmarkstyle) {
  if (styleId.length > 0) {
    styleId = "." + styleId;
  }
  // const className = `check-mark-${Math.random().toString(36).substr(2, 9)}`;
  const className = `fabric-component-${id}`;
  // const className = `hover-${element.id}`;

  // Check if we already have this class
  if (styleRuleCache.has(className)) {
    // Update existing rule
    // const ruleIndex = styleRuleCache.get(className);
    // styleSheet.deleteRule(ruleIndex);
    // styleSheet.insertRule(
    //   `.${className} { ${checkmarkstyle} }`,
    //   ruleIndex,
    // );
  } else {
    try {
      // const checkmarkCSS = `.${className}:checked::after {${checkmarkstyle}}`;

      const checkedStyle = `.${className}:checked {${checkmarkstyle}}`;
      const checkedAfter = `.${className}:checked::after {
                                        content: '';
                                        position: absolute;
                                        top: 50%;
                                        left: 50%;
                                        transform: translate(-50%, -50%);
                                        width: 10px;
                                        height: 10px;
                                        border-radius: 50%;
                                        ${checkmarkstyle}
                                    }`;

      // 4. Insert the rule
      styleSheet.insertRule(checkedStyle, styleSheet.cssRules.length);
      styleSheet.insertRule(checkedAfter, styleSheet.cssRules.length);
      // 5. Apply the class to your element
      // styleRuleCache.set(className, newIndex);
      element.classList.add(className);
    } catch (error) {
      console.error("Failed to add CSS rule:", error);
      console.log("Attempted CSS:", checkedStyle);
    }
  }
}

export function applyHoverClass(element, styleId, hoverStyles) {
  const styleName = `hover-${element.id}`;

  // Determine the correct selector
  let selector;
  if (styleId.length > 0) {
    // If styleId is provided, we need to target the element with this class
    // when the parent is hovered
    selector = `.${element.className}:hover ${styleId.startsWith(".") ? styleId : "." + styleId}`;
  } else {
    // If no styleId, apply hover directly to the element
    if (element.localName === "i") {
      console.log();
      selector = `.${element.className.split(" ").pop()}:hover`;
    } else {
      selector = `.${element.className}:hover`;
    }
  }

  // Check if we already have this class
  if (styleRuleCache.has(styleName)) {
    // Update existing rule
    const ruleIndex = styleRuleCache.get(styleName);
    const hoverCSS = `${selector} { ${hoverStyles} }`;
    styleSheet.deleteRule(ruleIndex);
    styleSheet.insertRule(hoverCSS, ruleIndex);
  } else {
    // Define and insert the hover rule
    const hoverCSS = `${selector} { ${hoverStyles} }`;
    const newIndex = styleSheet.cssRules.length;
    styleSheet.insertRule(hoverCSS, newIndex);
    // Cache the rule
    styleRuleCache.set(styleName, newIndex);
  }
}
