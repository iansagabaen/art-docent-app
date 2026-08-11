/**
 * Netlify Function: Recalculate Art Docent Stats
 *
 * Fetches the Google Sheet CSV, parses lesson data, and generates
 * stats JSON with tier structure (3+ times, 2 times, 1 time).
 *
 * Environment variables needed:
 * - GOOGLE_SHEET_ID: Published Google Sheet ID
 * - GOOGLE_SHEET_GID: Sheet tab ID (default 0)
 * - GITHUB_TOKEN: For committing stats updates (optional)
 * - GITHUB_REPO: Repo in format "owner/repo" (optional)
 */

const https = require('https');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');

// Configuration
const SHEET_ID = process.env.GOOGLE_SHEET_ID || '2PACX-1vQj04ZOaev6TJ1MTMeEphGMNps96WhCnB29JpzUGx1cr3wJjWCsGC2x5cVMDier6PXQNkZzIA_DlmmJ';
const SHEET_GID = process.env.GOOGLE_SHEET_GID || '0';
const LESSON_COLUMN = process.env.LESSON_COLUMN || 'Lesson'; // Column header name
const STATS_FILE = process.env.STATS_FILE || 'data/stats.json';

/**
 * Fetch Google Sheet CSV from published URL
 */
async function fetchSheetCSV() {
  return new Promise((resolve, reject) => {
    const url = `https://docs.google.com/spreadsheets/d/e/${SHEET_ID}/pub?output=csv&gid=${SHEET_GID}`;

    https.get(url, (res) => {
      let data = '';

      // Check for redirect or errors
      if (res.statusCode >= 300 && res.statusCode < 400) {
        return reject(new Error(`Sheet fetch redirected: ${res.statusCode}`));
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Sheet fetch failed: ${res.statusCode}`));
      }

      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Parse CSV and extract lessons
 */
function parseSheetData(csvData) {
  try {
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
    });

    return records;
  } catch (error) {
    console.error('CSV Parse Error:', error);
    throw new Error('Failed to parse sheet CSV');
  }
}

/**
 * Calculate stats from lesson data
 */
function calculateStats(records) {
  const lessonCounts = {};
  let totalEntries = 0;

  // Count each lesson occurrence
  records.forEach(record => {
    // Try multiple possible column names
    const lesson = record[LESSON_COLUMN] ||
                  record.Lesson ||
                  record.lesson ||
                  record['Lesson Type'];

    if (lesson && lesson.trim()) {
      const cleanLesson = lesson.trim();
      lessonCounts[cleanLesson] = (lessonCounts[cleanLesson] || 0) + 1;
      totalEntries++;
    }
  });

  // Group into tiers
  const stats = {
    lastUpdated: new Date().toISOString(),
    totalEntries,
    lessons: {
      qualified: [],        // 3+ times
      potential: [],        // 2 times
      single: [],          // 1 time
    },
    byLesson: lessonCounts,
  };

  // Sort lessons into tiers
  Object.entries(lessonCounts).forEach(([lesson, count]) => {
    const item = { lesson, count };

    if (count >= 3) {
      stats.lessons.qualified.push(item);
    } else if (count === 2) {
      stats.lessons.potential.push(item);
    } else {
      stats.lessons.single.push(item);
    }
  });

  // Sort each tier by count (descending)
  stats.lessons.qualified.sort((a, b) => b.count - a.count);
  stats.lessons.potential.sort((a, b) => b.count - a.count);
  stats.lessons.single.sort((a, b) => b.count - a.count);

  return stats;
}

/**
 * Update local stats file (for local preview/testing)
 */
function updateLocalStats(stats) {
  try {
    const dir = path.dirname(STATS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
    console.log(`Stats updated locally: ${STATS_FILE}`);
  } catch (error) {
    console.warn('Local stats update skipped:', error.message);
  }
}

/**
 * Commit stats to GitHub (optional)
 */
async function commitToGitHub(stats) {
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
    console.log('GitHub commit skipped (no credentials)');
    return null;
  }

  // This would require implementing GitHub API calls
  // For now, return a placeholder
  console.log('GitHub integration not yet implemented');
  return null;
}

/**
 * Main handler function
 */
exports.handler = async (event, context) => {
  try {
    console.log('Fetching Google Sheet...');
    const csvData = await fetchSheetCSV();

    console.log('Parsing sheet data...');
    const records = parseSheetData(csvData);

    console.log(`Found ${records.length} entries`);
    const stats = calculateStats(records);

    console.log('Updating stats...');
    updateLocalStats(stats);
    await commitToGitHub(stats);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Stats recalculated successfully',
        stats,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};

/**
 * Webhook handler for Google Apps Script
 */
exports.webhookHandler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  return exports.handler(event, context);
};
