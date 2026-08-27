Special Teams Analytics V12.4

Fix:
- V12.3 contained one invalid JavaScript team-map key: M-OH.
- That single syntax error stopped the app from rendering, which caused the blank dashboard seen in the screenshot.
- V12.4 quotes that key correctly and the full application JavaScript passes Node syntax validation.

V12.3 features retained:
- expanded readable team-name mapping, including MSSO -> Missouri
- green kicker/punter outline unless tackle red overrides it
- jersey number inside player circles with role beneath
- current-roster / not-on-current-roster status in player hover information
