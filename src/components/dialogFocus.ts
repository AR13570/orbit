/** Focus only controls that are exposed by the current dialog state. */
export function dialogControls(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,a[href],[tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => {
    if (element.closest('[hidden],[inert],[aria-hidden="true"]')) return false;
    for (
      let current: HTMLElement | null = element;
      current && current !== container;
      current = current.parentElement
    ) {
      const style = window.getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden")
        return false;
    }
    return true;
  });
}
