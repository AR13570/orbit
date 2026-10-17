# Orbit home menu design review

The game designer and UI/UX designer agreed on option A, refined into compact flat play stations. The composition carries the game identity while keeping entry actions and help easy to find.

| Before | After | Why |
| --- | --- | --- |
| Large illustrations above tall card bodies | Mode heading across the top, short description and actions on the left, animated world on the right | Each choice uses its space efficiently without hiding either mode. |
| Separator rules and floating or recessed surfaces | Matching flat tonal fields with no shadow, border, bevel, or divider between modes | Two choices stay distinct while fitting the page's minimalist visual language. |
| Small corner branding | Centered logo with the Orbit name and subtitle beside it | The brand reads as one clear header without repeating introductory copy. |
| Progress separated from mode identity | Checkpoint or level badge beside the mode name with a subtle vertical divider | Returning players can identify their saved state immediately. |
| Tall dark button faces around small labels | Approximately 30px visible faces inside at least 44px hit areas | The actions match the quiet visual scale while retaining usable touch targets. |
| Action rows shift when descriptions wrap differently | Primary and help actions align across equal-height desktop stations | Matching choices have a consistent entry baseline. |
| Help detached from the primary action | How to play and its question-mark icon sit beside Play or Continue | The help destination is clear before entering a mode. |

## Accepted elements

- Existing Avenir typography, pale gray page background, flat #e1e7eb station fills, teal and coral bodies, and colored moving projectiles.
- Both animated previews, stopped for reduced motion and hidden tabs.
- Equal dark Play or Continue actions. Fresh users see Play. Saved progress shows Continue; a badge and divider appear only after advancing beyond the initial checkpoint or level.
- A compact centered brand header, two side-by-side stations on wide screens, and stacked stations in portrait.
- A quiet Create a gravity puzzle action below the two modes and attribution at the bottom.
- At least 44px action targets, visible keyboard focus, and no interaction that depends on hover.
- Ordinary vertical menu scrolling on unusually short screens, rather than shrinking readable content to force attribution above the fold.

## Rejected directions

Option B's open-world presentation was too close to the earlier open layout and could detach actions from their mode. Option C's joined console weakened the independence of the two choices. Neumorphic bevels, blur shadows, hover elevation, numbered mode labels, default-selected modes, hidden-mode accordions, and full-background color washes were also rejected.

## Final iterative review

Both designers reviewed the implemented markup, responsive styles, and refreshed screenshots at 1280x900, 390x844, 844x390, and 320x568, including saved progress at 320px. The first review identified two meaningful issues: oversized visible button faces and an approximately 8px desktop action-baseline mismatch. Those corrections were implemented separately and the refreshed views were reviewed again.

The compact faces now fit the menu's scale, desktop action rows align, saved badges remain readable, and Continue plus How to play fit comfortably at 320px. Previews stay clear of copy and controls. Both mode actions and creator access remain reachable on the narrow screen; its attribution can sit below the fold.

Both designers signed off with no further meaningful design suggestions. The implementation agent separately confirmed six browser checks covering action alignment, compact visible faces, 44px targets, adjacent help, progressed badges, preview movement and reduced motion, plus a successful production build.
