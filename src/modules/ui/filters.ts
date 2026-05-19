// ═══════════════════════════════════════════════════════════════
// FILTER CHIPS
// ═══════════════════════════════════════════════════════════════

/**
 * Renders a row of filter chip buttons into the given container element.
 *
 * @param containerId - ID of the element to render into
 * @param values      - Domain-specific filter values (without "all")
 * @param activeFilter - Currently active filter value
 * @param onSelect    - Called with the selected value when a chip is clicked
 */
export function buildFilterChips(
  containerId: string,
  values: string[],
  activeFilter: string,
  onSelect: (value: string) => void,
): void {
  const row = document.getElementById(containerId)!;
  const all = ["all", ...values];

  row.innerHTML =
    '<span class="filter-label">Filter:</span>' +
    all
      .map(
        (v) =>
          `<button class="filter-chip${v === activeFilter ? " active" : ""}"
          data-value="${v}">${v === "all" ? "All" : v}</button>`,
      )
      .join("");

  row.querySelectorAll<HTMLButtonElement>(".filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      row
        .querySelectorAll(".filter-chip")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      onSelect(btn.dataset.value!);
    });
  });
}
