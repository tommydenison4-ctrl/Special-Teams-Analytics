SPECIAL TEAMS INTELLIGENCE V9.8 — FULL PLAYER IMAGES

The actual crop was caused by the original GLOBAL CSS rule:
.playerPhoto img { object-fit: cover; object-position: top center; }

V9.8 overrides that on desktop and mobile:
- 4:5 portrait photo area
- object-fit: contain
- object-position: center bottom
- expanded player report uses the same full-photo treatment
- keeps V9.7 mobile cleanup and strict player identity logic
