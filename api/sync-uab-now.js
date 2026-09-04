import syncRoster from './sync-roster-uab.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Method not allowed.' }));
  }

  // Fixed one-time Week 2 UAB sync. No caller-controlled URL or destination.
  req.body = {
    adminKey: process.env.SPECIAL_TEAMS_ADMIN_KEY || '',
    url: 'https://uabsports.com/sports/football/roster',
    teamName: 'UAB',
    nickname: 'Blazers',
    teamCode: 'ALBI'
  };

  return syncRoster(req, res);
}
