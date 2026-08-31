import { iconMarkup } from "./icons.js";

/**
 * Creates a styled custom select dropdown component with full keyboard support.
 *
 * @param {Object} config
 * @param {HTMLElement} config.container
 * @param {string} [config.id]
 * @param {string} [config.name]
 * @param {Array<{value: string, label: string}>} config.options
 * @param {string} [config.value]
 * @param {(value: string) => void} [config.onChange]
 */
export function createCustomSelect({ container, id, options = [], value = "", onChange }) {
  container.classList.add("custom-select-wrap");

  const trigger = document.createElement("button");
  trigger.className = "custom-select__trigger";
  trigger.type = "button";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  if (id) {
    trigger.id = `${id}-trigger`;
  }

  const labelSpan = document.createElement("span");
  labelSpan.className = "custom-select__label";

  const iconSpan = document.createElement("span");
  iconSpan.className = "custom-select__icon";
  iconSpan.innerHTML = iconMarkup("chevron-down", 16);

  trigger.append(labelSpan, iconSpan);

  const panel = document.createElement("div");
  panel.className = "custom-select__panel";
  panel.setAttribute("role", "listbox");
  panel.hidden = true;
  if (id) {
    panel.id = `${id}-panel`;
  }

  container.replaceChildren(trigger, panel);

  let currentOptions = [...options];
  let currentValue = value || (currentOptions[0] ? currentOptions[0].value : "");

  function renderOptions() {
    panel.replaceChildren();

    for (const opt of currentOptions) {
      const optionBtn = document.createElement("button");
      optionBtn.className = "custom-select__option";
      optionBtn.type = "button";
      optionBtn.setAttribute("role", "option");
      optionBtn.dataset.value = opt.value;
      const isSelected = opt.value === currentValue;
      optionBtn.setAttribute("aria-selected", String(isSelected));
      if (isSelected) {
        optionBtn.classList.add("custom-select__option--selected");
      }

      const optLabel = document.createElement("span");
      optLabel.className = "custom-select__option-label";
      optLabel.textContent = opt.label;

      const optCheck = document.createElement("span");
      optCheck.className = "custom-select__option-check";
      optCheck.innerHTML = iconMarkup("check", 14);

      optionBtn.append(optLabel, optCheck);

      optionBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        selectValue(opt.value);
        closePanel();
        trigger.focus();
      });

      panel.append(optionBtn);
    }

    updateTriggerLabel();
  }

  function updateTriggerLabel() {
    const selectedOpt = currentOptions.find((opt) => opt.value === currentValue);
    labelSpan.textContent = selectedOpt ? selectedOpt.label : (currentOptions[0]?.label ?? "");
  }

  function selectValue(newValue, notify = true) {
    if (currentValue === newValue && !notify) {
      return;
    }
    currentValue = newValue;
    for (const optBtn of panel.querySelectorAll(".custom-select__option")) {
      const isSelected = optBtn.dataset.value === currentValue;
      optBtn.setAttribute("aria-selected", String(isSelected));
      optBtn.classList.toggle("custom-select__option--selected", isSelected);
    }
    updateTriggerLabel();
    if (notify && typeof onChange === "function") {
      onChange(currentValue);
    }
  }

  function openPanel() {
    // Close other open custom select panels or genre panel
    document.querySelectorAll(".custom-select__panel:not([hidden])").forEach((el) => {
      if (el !== panel) {
        el.hidden = true;
        el.previousElementSibling?.setAttribute("aria-expanded", "false");
      }
    });

    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    const selectedEl = panel.querySelector(".custom-select__option--selected");
    if (selectedEl) {
      selectedEl.focus();
    }
  }

  function closePanel() {
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }

  trigger.addEventListener("click", () => {
    panel.hidden ? openPanel() : closePanel();
  });

  document.addEventListener("click", (event) => {
    if (!panel.hidden && !container.contains(event.target)) {
      closePanel();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (panel.hidden) {
      return;
    }

    if (event.key === "Escape") {
      closePanel();
      trigger.focus();
      return;
    }

    const optionsList = Array.from(panel.querySelectorAll(".custom-select__option"));
    const currentIndex = optionsList.indexOf(document.activeElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = currentIndex < optionsList.length - 1 ? currentIndex + 1 : 0;
      optionsList[nextIndex]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : optionsList.length - 1;
      optionsList[prevIndex]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      optionsList[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      optionsList[optionsList.length - 1]?.focus();
    }
  });

  renderOptions();

  return {
    getValue: () => currentValue,
    setValue: (newValue, notify = false) => selectValue(newValue, notify),
    setOptions: (newOptions, newValue) => {
      currentOptions = [...newOptions];
      const hasValue = currentOptions.some((opt) => opt.value === (newValue ?? currentValue));
      currentValue = hasValue ? (newValue ?? currentValue) : (currentOptions[0]?.value ?? "");
      renderOptions();
    },
    close: closePanel,
  };
}
