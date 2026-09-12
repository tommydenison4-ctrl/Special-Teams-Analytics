import syncRoster from './sync-roster-sela.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Method not allowed.' }));
  }

  // Fixed one-time Week 3 Southeastern Louisiana sync. No caller-controlled URL or destination.
  req.body = {
    adminKey: process.env.SPECIAL_TEAMS_ADMIN_KEY || '',
    url: 'https://lionsports.net/sports/football/roster',
    teamName: 'Southeastern Louisiana',
    nickname: 'Lions',
    teamCode: 'LASE'
  };

  return syncRoster(req, res);
}
