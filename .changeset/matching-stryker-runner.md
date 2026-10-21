---
"tautest": patch
"@tautest/core": patch
---

Keep newly added Stryker runners on the existing core version during `tautest init`, preserving exact, caret and tilde version declarations from either dependencies section. Projects without Stryker still receive version 10. Existing declarations are not overwritten.

When a missing runner cannot be selected safely from a custom core declaration (such as a workspace reference, alias or open-ended range), init stops without retaining file changes and asks for manual runner installation.
