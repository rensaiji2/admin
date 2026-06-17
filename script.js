// ===== ADMIN SCRIPT =====
// Admin-only dashboard view - no personal tracker, just team overview

const ADMIN_PASSWORD = 'teamvhicoy'; // CHANGE THIS FOR PRODUCTION

// ===== ALLOWED TEAM MEMBERS =====
const ALLOWED_NAMES = ["Ahl", "Ali", "Princess", "Emjay", "Fairy", "Johara", "Jossa", "Krisha", "Lexter", "Luis", "Claire", "Melchor", "Reign", "Rose"];

// ===== PARTICLES =====
const particlesContainer = document.getElementById('particles');
for (let i = 0; i < 30; i++) {
  const p = document.createElement('div');
  p.className = 'particle';
  p.style.left = Math.random() * 100 + 'vw';
  p.style.animationDelay = Math.random() * 15 + 's';
  p.style.animationDuration = (10 + Math.random() * 10) + 's';
  particlesContainer.appendChild(p);
}

// ===== DOM ELEMENTS =====
const teamList = document.getElementById('teamList');
const syncDot = document.getElementById('syncDot');
const syncText = document.getElementById('syncText');

// ===== CONFIG =====
let githubToken = '';
let gistId = null;
let teamId = '';
let teamData = {};
let currentAdminTeam = '';

// Read token from config.js
if (typeof TEAM_CONFIG !== 'undefined' && TEAM_CONFIG.githubToken) {
  githubToken = TEAM_CONFIG.githubToken.trim();
}

// ===== ADMIN LOGIN =====
const adminPassInput = document.getElementById('adminPass');
const adminError = document.getElementById('adminError');

function adminLogin() {
  const pass = adminPassInput.value.trim();
  if (pass === ADMIN_PASSWORD) {
    localStorage.setItem('callTracker_admin', 'true');
    showAdminDashboard();
  } else {
    adminPassInput.classList.add('error');
    adminError.textContent = 'Incorrect password';
    adminError.classList.add('show');
    setTimeout(() => adminPassInput.classList.remove('error'), 400);
  }
}

function adminLogout() {
  localStorage.removeItem('callTracker_admin');
  location.reload();
}

function showAdminDashboard() {
  document.getElementById('adminLoginOverlay').classList.add('hidden');
  document.getElementById('adminApp').style.display = '';

  // Check for saved team
  const savedTeam = localStorage.getItem('callTracker_adminTeam');
  if (savedTeam) {
    document.getElementById('adminTeamId').value = savedTeam;
    adminLoadTeam();
  }
}

// Check if already logged in
if (localStorage.getItem('callTracker_admin') === 'true') {
  showAdminDashboard();
}

adminPassInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') adminLogin();
});
adminPassInput.addEventListener('input', () => {
  adminError.classList.remove('show');
  adminPassInput.classList.remove('error');
});

// ===== GITHUB GIST API (same as main app) =====
const GIST_API = 'https://api.github.com/gists';

function getGistDescription() {
  return 'CallTracker-' + teamId;
}

function getGistFilename() {
  return 'team-' + teamId + '.json';
}

async function findExistingGist() {
  try {
    const resp = await fetch(GIST_API + '?per_page=100', {
      headers: { 'Authorization': 'token ' + githubToken }
    });
    if (!resp.ok) throw new Error('Failed to list gists');
    const gists = await resp.json();
    const desc = getGistDescription();
    const found = gists.find(g => g.description === desc);
    return found ? found.id : null;
  } catch (e) {
    console.error('findExistingGist error:', e);
    return null;
  }
}

async function readGist() {
  if (!gistId) return null;
  const resp = await fetch(GIST_API + '/' + gistId, {
    headers: { 'Authorization': 'token ' + githubToken }
  });
  if (!resp.ok) {
    if (resp.status === 404) { gistId = null; return null; }
    throw new Error('Failed to read gist');
  }
  const data = await resp.json();
  const file = data.files[getGistFilename()];
  if (!file) return null;
  try {
    return JSON.parse(file.content);
  } catch (e) { return null; }
}

// ===== ADMIN LOAD TEAM =====
async function adminLoadTeam() {
  showSkeletonLoading();
  const input = document.getElementById('adminTeamId');
  const team = input.value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

  if (!team) {
    input.classList.add('error');
    setTimeout(() => input.classList.remove('error'), 400);
    return;
  }

  teamId = team;
  currentAdminTeam = team;
  localStorage.setItem('callTracker_adminTeam', team);
  gistId = null;

  if (!githubToken) {
    setSyncStatus('offline', 'No token - local mode');
    teamList.innerHTML = '<div class="team-empty">No GitHub token configured. Add one in config.js to sync.</div>';
    return;
  }

  setSyncStatus('syncing', 'Loading team...');
  const btn = document.getElementById('adminRefresh');
  btn.classList.add('spinning');

  try {
    gistId = await findExistingGist();
    if (!gistId) {
      teamList.innerHTML = '<div class="team-empty">No data found for team "' + escapeHtml(teamId) + '"</div>';
      document.getElementById('teamStatsBar').style.display = 'none';
      setSyncStatus('offline', 'Team not found');
      btn.classList.remove('spinning');
      return;
    }

    const data = await readGist();
    if (!data || !data.members) {
      teamList.innerHTML = '<div class="team-empty">No member data for this team</div>';
      document.getElementById('teamStatsBar').style.display = 'none';
      setSyncStatus('offline', 'Empty team');
      btn.classList.remove('spinning');
      return;
    }

    teamData = data.members;
    renderTeamDashboard();
  initTiltCards();
    setSyncStatus('online', 'Live - ' + escapeHtml(teamId));
  } catch (e) {
    console.error('Admin load error:', e);
    teamList.innerHTML = '<div class="team-empty">Error loading team data</div>';
    setSyncStatus('offline', 'Load failed');
  }

  btn.classList.remove('spinning');
}

function adminRefresh() {
  if (!currentAdminTeam) {
    const input = document.getElementById('adminTeamId');
    if (input.value.trim()) adminLoadTeam();
    return;
  }
  adminLoadTeam();
}

function retrySync() {
  gistId = null;
  adminLoadTeam();
}

function setSyncStatus(status, text) {
  syncDot.className = 'sync-dot ' + status;
  syncText.textContent = text;
  const retryBtn = document.getElementById('syncRetry');
  if (retryBtn) {
    if (status === 'offline') retryBtn.classList.add('show');
    else retryBtn.classList.remove('show');
  }
}


// ===== 3D TILT CARDS =====
function initTiltCards() {
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -5;
      const rotateY = ((x - centerX) / centerX) * 5;
      card.classList.add('tilted');
      card.style.transform = 'rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg) scale(1.02)';
    });
    card.addEventListener('mouseleave', () => {
      card.classList.remove('tilted');
      card.style.transform = 'rotateX(0) rotateY(0) scale(1)';
    });
  });
}


// ===== LOADING SKELETON SCREENS =====
function showSkeletonLoading() {
  const teamList = document.getElementById('teamList');
  if (!teamList) return;

  let html = '';
  for (let i = 0; i < 6; i++) {
    html += '<div class="skeleton skeleton-row"></div>';
  }
  teamList.innerHTML = html;
}

function hideSkeletonLoading() {
  // renderTeamDashboard will replace the skeleton with real content
}

// ===== RANK TRACKING =====
let previousRanks = {};

function getRankChangeClass(name, newRank) {
  const oldRank = previousRanks[name];
  if (!oldRank || oldRank === newRank) return '';
  if (newRank < oldRank) return 'rank-change-up';
  return 'rank-change-down';
}

// ===== TEAM DASHBOARD RENDER (same logic as main app) =====
function renderTeamDashboard() {
  // Build full roster: merge allowed names with synced data
  const fullRoster = {};
  ALLOWED_NAMES.forEach(name => {
    fullRoster[name] = {
      release: 0,
      drop: 0,
      calls: 0,
      percentage: 0,
      streak: 0,
      goal: 50,
      lastActive: null,
      ...teamData[name]
    };
  });

  const members = Object.entries(fullRoster);

  document.getElementById('teamStatsBar').style.display = 'grid';

  let totalReleases = 0, totalDrops = 0, totalCalls = 0, scoreSum = 0, scoredMembers = 0;
  members.forEach(([name, m]) => {
    totalReleases += m.release || 0;
    totalDrops += m.drop || 0;
    totalCalls += m.calls || 0;
    if (m.percentage > 0) { scoreSum += m.percentage; scoredMembers++; }
  });

  const teamPassRate = totalCalls > 0 ? (totalReleases / totalCalls) * 100 : 0;

  let releasesNeeded = 0;
  if (teamPassRate < 85 && totalCalls > 0) {
    releasesNeeded = Math.ceil((0.85 * totalCalls - totalReleases) / 0.15);
  } else if (totalCalls === 0) {
    releasesNeeded = 0;
  }

  const absentCount = getAbsentMembers().length;
  const activeCount = members.length - absentCount;
  document.getElementById('teamMemberCount').innerHTML = members.length + (absentCount > 0 ? ' <span style="color:var(--accent-red);font-size:0.85rem;">(' + absentCount + ' absent)</span>' : '');
  document.getElementById('teamAvgScore').textContent = teamPassRate.toFixed(1) + '%';
  document.getElementById('teamAvgScore').style.color = teamPassRate >= 85 ? 'var(--accent-green)' : teamPassRate >= 80 ? 'var(--accent-yellow)' : 'var(--accent-red)';
  document.getElementById('teamTotalCalls').textContent = totalCalls;
  document.getElementById('teamTotalReleases').textContent = totalReleases;
  document.getElementById('teamTotalDrops').textContent = totalDrops;
  const needEl = document.getElementById('teamReleasesNeeded');
  if (releasesNeeded <= 0 && totalCalls > 0) {
    needEl.textContent = 'PASS';
    needEl.style.color = 'var(--accent-green)';
  } else if (releasesNeeded > 0) {
    needEl.textContent = releasesNeeded;
    needEl.style.color = 'var(--accent-yellow)';
  } else {
    needEl.textContent = '--';
    needEl.style.color = '';
  }

  const sorted = members
    .sort((a, b) => (b[1].percentage || 0) - (a[1].percentage || 0));

  teamList.innerHTML = '';
  sorted.forEach(([name, member], idx) => {
    const pct = member.percentage || 0;
    const total = member.calls || 0;
    const status = pct >= 85 ? 'pass' : pct >= 80 ? 'warning' : total > 0 ? 'fail' : 'start';
    const color = status === 'pass' ? '#10b981' : status === 'warning' ? '#f59e0b' : status === 'fail' ? '#ef4444' : '#64748b';
    const statusText = status === 'pass' ? 'Pass' : status === 'warning' ? 'Warn' : status === 'fail' ? 'Fail' : 'Start';
    const isRecent = member.lastActive && (Date.now() - member.lastActive < 5 * 60 * 1000);
    const hasData = member.calls > 0;

    const isAbsent = isMemberAbsent(name);

    const el = document.createElement('div');
    el.className = 'team-member-full' + (!hasData ? ' offline' : '') + (isAbsent ? ' absent' : '');
    el.style.cursor = 'pointer';
    el.onclick = (e) => {
      // Don't open detail if clicking the absent toggle
      if (e.target.closest('.absent-toggle')) return;
      currentDetailName = name;
      openMemberDetail(name, member, idx + 1, sorted.length);
    };

    const absentBtnClass = isAbsent ? 'absent-btn active' : 'absent-btn';
    const absentBtnText = isAbsent ? '&#10003; ABSENT' : 'Mark Absent';

    el.innerHTML = `
      <div class="team-rank-full ${idx < 3 ? 'top' : ''} ${getRankChangeClass(name, idx + 1)}">${idx + 1}</div>
      <div class="team-name-full">
        ${getMemberAvatar(name) ? '<img class="team-avatar-full" src="' + getMemberAvatar(name) + '" style="object-fit:cover;">' : '<div class="team-avatar-full" style="background:' + color + '22;color:' + color + '">' + name.charAt(0).toUpperCase() + '</div>'}
        ${escapeHtml(name)}
        ${isAbsent ? '<span class="absent-badge">ABSENT</span>' : ''}
      </div>
      <div class="team-pct-full ${status}">${pct.toFixed(1)}%</div>
      <div class="team-bar-track-full">
        <div class="team-bar-fill-full" style="width:${Math.min(pct,100)}%;background:${color}"></div>
      </div>
      <div class="team-num-full">${member.release || 0}</div>
      <div class="team-num-full">${member.drop || 0}</div>
      <div class="team-num-full">${total}</div>
      <div class="team-status-badge ${status}">${statusText}</div>
      <div class="team-status-dot-full ${hasData && isRecent ? 'online' : 'away'}"></div>
      <div class="absent-toggle" onclick="event.stopPropagation(); setAbsentStatus('${name}', !isMemberAbsent('${name}'))">
        <button class="${absentBtnClass}">${absentBtnText}</button>
      </div>
    `;
    teamList.appendChild(el);
  });

  // Save current ranks for next comparison
  previousRanks = {};
  sorted.forEach(([name, member], idx) => {
    previousRanks[name] = idx + 1;
  });
}

// ===== MEMBER DETAIL OVERLAY =====
function openMemberDetail(name, member, rank, totalMembers) {
  const pct = member.percentage || 0;
  const total = member.calls || 0;
  const status = pct >= 85 ? 'pass' : pct >= 80 ? 'warning' : total > 0 ? 'fail' : 'start';
  const color = status === 'pass' ? '#10b981' : status === 'warning' ? '#f59e0b' : status === 'fail' ? '#ef4444' : '#64748b';
  const scoreColor = pct >= 85 ? 'var(--accent-green)' : pct >= 80 ? 'var(--accent-yellow)' : 'var(--accent-red)';

  const avatarData = getMemberAvatar(name);
  const avatarEl = document.getElementById('detailAvatar');
  if (avatarData) {
    avatarEl.innerHTML = '<img src="' + avatarData + '" style="width:100%;height:100%;object-fit:cover;border-radius:16px;">';
    avatarEl.style.background = 'transparent';
  } else {
    avatarEl.textContent = name.charAt(0).toUpperCase();
    avatarEl.style.background = color + '22';
    avatarEl.style.color = color;
    avatarEl.innerHTML = '';
  }
  document.getElementById('detailName').textContent = escapeHtml(name);
  document.getElementById('detailRank').textContent = 'Rank #' + rank + ' of ' + totalMembers;
  document.getElementById('detailScore').textContent = pct.toFixed(1) + '%';
  document.getElementById('detailScore').style.color = scoreColor;

  document.getElementById('detailReleases').textContent = member.release || 0;
  document.getElementById('detailDrops').textContent = member.drop || 0;
  document.getElementById('detailCalls').textContent = total;
  document.getElementById('detailStreak').textContent = member.streak || 0;
  document.getElementById('detailStreakCount').textContent = member.streak || 0;

  const fill = document.getElementById('detailProgressFill');
  fill.style.width = Math.min(pct, 100) + '%';
  fill.style.background = scoreColor;
  document.getElementById('detailProgressText').textContent = (member.release || 0) + ' / ' + total + ' calls';
  document.getElementById('detailProgressPct').textContent = pct.toFixed(1) + '%';

  const targetBox = document.getElementById('detailTargetBox');
  const targetValue = document.getElementById('detailTargetValue');
  const targetDetail = document.getElementById('detailTargetDetail');

  if (total === 0) {
    targetBox.className = 'detail-target-box';
    targetValue.textContent = 'Start tracking';
    targetValue.style.color = '';
    targetDetail.textContent = 'No data yet for this member';
  } else if (pct >= 85) {
    targetBox.className = 'detail-target-box on-track';
    targetValue.textContent = 'Above 85%!';
    targetValue.style.color = 'var(--accent-green)';
    targetDetail.textContent = (pct - 85).toFixed(1) + '% above target. Keep it up!';
  } else {
    const needed = Math.ceil((0.85 * total - (member.release || 0)) / 0.15);
    const projectedTotal = total + needed;
    const projectedPct = (((member.release || 0) + needed) / projectedTotal * 100);
    if (pct >= 80) {
      targetBox.className = 'detail-target-box needs-work';
      targetValue.style.color = 'var(--accent-yellow)';
    } else {
      targetBox.className = 'detail-target-box critical';
      targetValue.style.color = 'var(--accent-red)';
    }
    targetValue.textContent = 'Need ' + needed + ' more release' + (needed > 1 ? 's' : '');
    targetDetail.textContent = 'Projected: ' + projectedPct.toFixed(1) + '% after ' + needed + ' more release' + (needed > 1 ? 's' : '') + ' (no more drops)';
  }

  const lastActive = document.getElementById('detailLastActive');
  if (member.lastActive) {
    const diff = Date.now() - member.lastActive;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) lastActive.textContent = 'Just now';
    else if (mins < 60) lastActive.textContent = mins + ' min' + (mins > 1 ? 's' : '') + ' ago';
    else {
      const hrs = Math.floor(mins / 60);
      lastActive.textContent = hrs + ' hr' + (hrs > 1 ? 's' : '') + ' ago';
    }
  } else {
    lastActive.textContent = 'Unknown';
  }

  // Load admin note
  const noteInput = document.getElementById('detailNoteInput');
  if (noteInput) {
    noteInput.value = getMemberNote(name);
    document.getElementById('detailNoteSaved').classList.remove('show');
  }
  document.getElementById('memberDetailOverlay').classList.add('active');
}

let currentDetailName = '';

function updateDetailNote() {
  const noteInput = document.getElementById('detailNoteInput');
  const savedIndicator = document.getElementById('detailNoteSaved');
  if (noteInput && currentDetailName) {
    setMemberNote(currentDetailName, noteInput.value);
    savedIndicator.classList.add('show');
    setTimeout(() => savedIndicator.classList.remove('show'), 1500);
    // Re-render to update note indicator
    renderTeamDashboard();
  initTiltCards();
  }
}

function closeMemberDetail(e) {
  if (!e || e.target === document.getElementById('memberDetailOverlay')) {
    document.getElementById('memberDetailOverlay').classList.remove('active');
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMemberDetail();
});

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}



// ===== MEMBER NOTES =====
const NOTES_KEY = 'callTracker_notes_' + teamId;

function getMemberNotes() {
  const saved = localStorage.getItem(NOTES_KEY);
  return saved ? JSON.parse(saved) : {};
}

function setMemberNote(name, note) {
  const notes = getMemberNotes();
  if (note.trim()) {
    notes[name] = note.trim();
  } else {
    delete notes[name];
  }
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function getMemberNote(name) {
  return getMemberNotes()[name] || '';
}


// ===== AVATAR STORAGE =====
const AVATAR_KEY = 'callTracker_avatars_' + teamId;

function getMemberAvatars() {
  const saved = localStorage.getItem(AVATAR_KEY);
  return saved ? JSON.parse(saved) : {};
}

function setMemberAvatar(name, dataUrl) {
  const avatars = getMemberAvatars();
  if (dataUrl) {
    avatars[name] = dataUrl;
  } else {
    delete avatars[name];
  }
  localStorage.setItem(AVATAR_KEY, JSON.stringify(avatars));
}

function getMemberAvatar(name) {
  return getMemberAvatars()[name] || null;
}

function handleAvatarUpload(input) {
  const file = input.files[0];
  if (!file || !currentDetailName) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    setMemberAvatar(currentDetailName, dataUrl);

    // Update avatar in detail view
    const avatarEl = document.getElementById('detailAvatar');
    avatarEl.innerHTML = '<img src="' + dataUrl + '" style="width:100%;height:100%;object-fit:cover;border-radius:16px;">';

    // Re-render team list
    renderTeamDashboard();
  initTiltCards();
  };
  reader.readAsDataURL(file);
}

// ===== ABSENT STATUS MANAGEMENT =====
const ABSENT_KEY = 'callTracker_absent_' + teamId;

function getAbsentMembers() {
  const saved = localStorage.getItem(ABSENT_KEY);
  return saved ? JSON.parse(saved) : [];
}

function setAbsentStatus(name, isAbsent) {
  let absent = getAbsentMembers();
  if (isAbsent) {
    if (!absent.includes(name)) absent.push(name);
  } else {
    absent = absent.filter(n => n !== name);
  }
  localStorage.setItem(ABSENT_KEY, JSON.stringify(absent));
  renderTeamDashboard();
  initTiltCards();
}

function isMemberAbsent(name) {
  return getAbsentMembers().includes(name);
}

function clearAllAbsent() {
  localStorage.removeItem(ABSENT_KEY);
  renderTeamDashboard();
  initTiltCards();
}