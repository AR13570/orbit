/** Only gameplay fixtures opt out. Tutorial tests use fresh browser storage. */
export function markTutorialSeen() {
  localStorage.setItem("orbit.walkthrough.zen.v1", "complete");
  localStorage.setItem("orbit.walkthrough.gravity.v1", "complete");
  localStorage.setItem("orbit.walkthrough.gravity.v2", "complete");
}
