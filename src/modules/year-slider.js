/**
 * Creates a dual-thumb year range slider matching the requested UI.
 *
 * @param {Object} config
 * @param {HTMLElement} config.container
 * @param {HTMLInputElement} config.minSlider
 * @param {HTMLInputElement} config.maxSlider
 * @param {HTMLElement} config.fillEl
 * @param {HTMLElement} config.minBadge
 * @param {HTMLElement} config.maxBadge
 * @param {number} [config.minYear=1917]
 * @param {number} [config.maxYear=2027]
 * @param {string|number} [config.valueFrom="all"]
 * @param {string|number} [config.valueTo="all"]
 * @param {(values: {yearFrom: string, yearTo: string}) => void} [config.onChange]
 */
export function createYearSlider({
  container,
  minSlider,
  maxSlider,
  fillEl,
  minBadge,
  maxBadge,
  minYear = 1917,
  maxYear = 2027,
  valueFrom = "all",
  valueTo = "all",
  onChange,
}) {
  let boundMin = minYear;
  let boundMax = maxYear;

  let currentMin = valueFrom === "all" ? boundMin : Math.max(boundMin, Math.min(boundMax, Number(valueFrom)));
  let currentMax = valueTo === "all" ? boundMax : Math.max(boundMin, Math.min(boundMax, Number(valueTo)));

  function syncDom() {
    minSlider.min = String(boundMin);
    minSlider.max = String(boundMax);
    minSlider.value = String(currentMin);

    maxSlider.min = String(boundMin);
    maxSlider.max = String(boundMax);
    maxSlider.value = String(currentMax);

    updateVisuals();
  }

  function updateVisuals() {
    const range = Math.max(1, boundMax - boundMin);
    const leftPercent = Math.max(0, Math.min(100, ((currentMin - boundMin) / range) * 100));
    const rightPercent = Math.max(0, Math.min(100, 100 - ((currentMax - boundMin) / range) * 100));

    if (fillEl) {
      fillEl.style.left = `${leftPercent}%`;
      fillEl.style.right = `${rightPercent}%`;
    }

    if (minBadge) {
      minBadge.textContent = String(currentMin);
    }
    if (maxBadge) {
      maxBadge.textContent = String(currentMax);
    }

    // Dynamic z-index for thumbs when they are close
    if (currentMin > boundMin + range / 2) {
      minSlider.style.zIndex = "5";
      maxSlider.style.zIndex = "4";
    } else {
      minSlider.style.zIndex = "4";
      maxSlider.style.zIndex = "5";
    }
  }

  function handleMinInput() {
    let val = Number(minSlider.value);
    if (val > currentMax) {
      val = currentMax;
      minSlider.value = String(val);
    }
    currentMin = val;
    updateVisuals();
    notifyChange();
  }

  function handleMaxInput() {
    let val = Number(maxSlider.value);
    if (val < currentMin) {
      val = currentMin;
      maxSlider.value = String(val);
    }
    currentMax = val;
    updateVisuals();
    notifyChange();
  }

  function notifyChange() {
    const isAtFullRange = currentMin === boundMin && currentMax === boundMax;
    const yearFrom = isAtFullRange ? "all" : String(currentMin);
    const yearTo = isAtFullRange ? "all" : String(currentMax);

    if (typeof onChange === "function") {
      onChange({ yearFrom, yearTo });
    }
  }

  minSlider.addEventListener("input", handleMinInput);
  maxSlider.addEventListener("input", handleMaxInput);

  syncDom();

  return {
    getValues: () => ({
      yearFrom: currentMin === boundMin && currentMax === boundMax ? "all" : String(currentMin),
      yearTo: currentMin === boundMin && currentMax === boundMax ? "all" : String(currentMax),
    }),
    setValues: (newFrom, newTo, notify = false) => {
      currentMin = newFrom === "all" ? boundMin : Math.max(boundMin, Math.min(boundMax, Number(newFrom)));
      currentMax = newTo === "all" ? boundMax : Math.max(boundMin, Math.min(boundMax, Number(newTo)));
      if (currentMin > currentMax) {
        currentMin = currentMax;
      }
      syncDom();
      if (notify) {
        notifyChange();
      }
    },
    setBounds: (newMin, newMax) => {
      const wasAtFullMin = currentMin === boundMin;
      const wasAtFullMax = currentMax === boundMax;
      boundMin = newMin;
      boundMax = Math.max(boundMin, newMax);
      currentMin = wasAtFullMin ? boundMin : Math.max(boundMin, Math.min(boundMax, currentMin));
      currentMax = wasAtFullMax ? boundMax : Math.max(boundMin, Math.min(boundMax, currentMax));
      syncDom();
    },
  };
}
