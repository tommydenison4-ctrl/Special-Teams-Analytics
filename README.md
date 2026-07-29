{
  "name": "special-teams-intelligence-v7",
  "version": "7.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "check": "node --check api/import-roster.js && node --check api/project.js"
  },
  "dependencies": {
    "cheerio": "1.1.2"
  },
  "engines": {
    "node": ">=22"
  }
}
