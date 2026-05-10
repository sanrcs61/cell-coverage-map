// Global variables
let map;
let coverageLayers = [];
let userLocationMarker;
let cellTowerData = {};
let cookieConsent = false;

// Timeline playback variables
let timelineData = [];
let timelineAllData = [];
let timelineIndex = 0;
let timelineInterval = null;
let timelineLayers = [];
let timelineMarker = null;
let timelinePath = null;
let isPlaying = false;

const operatorDisclaimers = {
    grameenphone: "সেপ্টেম্বর ২০২৫ পর্যন্ত কিছু জেলার তথ্য পাওয়া যাবে",
    robi: "অক্টোবর ২০২৫ সাল পর্যন্ত কিছু জেলার 2G ও 4G সেলের তথ্য পাওয়া যাবে। 4G এর জন্য ল্যাক এর স্থলে ট্যাক এবং সেল আইডি এর স্থলে eNB ID ও LCID একসাথে লিখে ইনপুট দিতে হবে। যেমন: eNB ID: 620086 ও LCID 21 হলে ইনপুট দিতে হবে 62008621",
    airtel: "মার্চ ২০২৩ সাল পর্যন্ত শুধুমাত্র রাজশাহী জেলার 4G সেলের তথ্য পাওয়া যাবে। 4G এর জন্য ল্যাক এর স্থলে ট্যাক এবং সেল আইডি এর স্থলে eNB ID ও LCID একসাথে লিখে ইনপুট দিতে হবে। যেমন: eNB ID: 620086 ও LCID 21 হলে ইনপুট দিতে হবে 62008621",
    banglalink: "আনুমানিক ২০২৪ সাল পর্যন্ত শুধুমাত্র রাজশাহী জেলার 4G ও 2G সেলের তথ্য পাওয়া যাবে।",
    teletalk: "এখনো কোনো ডাটা আপলোড করা হয়নি"
};

const defaultSettings = {
    '2G': { radius: 1, beamWidth: 120, color: '#FF0000' },
    '3G': { radius: 0.8, beamWidth: 120, color: '#00FF00' },
    '4G': { radius: 0.5, beamWidth: 120, color: '#0000FF' }
};

function initMap() {
    const bangladeshCenter = [23.6850, 90.3563];
    const defaultZoom = 7;

    map = L.map('map').setView(bangladeshCenter, defaultZoom);
    L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(map);

    const bangladeshBounds = L.latLngBounds(
        [20.7472, 88.0833],
        [26.6375, 92.6810]
    );
    map.setMaxBounds(bangladeshBounds);

    updateColorFromDefault();

    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);
}

function loadOperatorData(operator) {
    const baseUrl = 'https://sanrcs61.github.io/cell-coverage-map/data/';
    fetch(`${baseUrl}${operator}.json`)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
        })
        .then(data => {
            if (!data || !Array.isArray(data)) throw new Error('Invalid data format');
            cellTowerData[operator] = data;
            console.log(`Successfully loaded ${operator} data with ${data.length} entries`);
        })
        .catch(error => {
            console.error(`Error loading ${operator} data:`, error);
            document.getElementById('disclaimerBox').innerHTML += `<br><span style="color: red;">Error loading data: ${error.message}</span>`;
        });
}

function updateOperatorDisclaimer() {
    const operator = document.getElementById('operator').value;
    const disclaimer = operatorDisclaimers[operator];
    document.getElementById('disclaimerBox').innerHTML = disclaimer;
    loadOperatorData(operator);
}

function updateAngleDisplay(angle) {
    document.getElementById('angleDisplay').textContent = angle + '°';
}

function updateColorFromDefault() {
    const network = document.getElementById('network').value;
    document.getElementById('sectorColor').value = defaultSettings[network].color;
}

function updateDefaultColor() {
    const network = document.getElementById('network').value;
    defaultSettings[network].color = document.getElementById('sectorColor').value;
}

function resetDefaultColor() {
    const network = document.getElementById('network').value;
    const originalColors = { '2G': '#FF0000', '3G': '#00FF00', '4G': '#0000FF' };
    defaultSettings[network].color = originalColors[network];
    document.getElementById('sectorColor').value = originalColors[network];
}

function generateCoverage() {
    const lat = parseFloat(document.getElementById('lat').value);
    const lon = parseFloat(document.getElementById('lon').value);
    const angle = parseFloat(document.getElementById('angle').value);
    const network = document.getElementById('network').value;

    if (isNaN(lat) || isNaN(lon)) {
        alert('Please enter valid coordinates');
        return;
    }

    const radius = parseFloat(document.getElementById(network.toLowerCase() + '-radius').value) * 1000;
    const beamWidth = parseFloat(document.getElementById(network.toLowerCase() + '-beam').value);
    const sectorColor = document.getElementById('sectorColor').value;

    const points = calculateCoveragePoints(lat, lon, radius, angle, beamWidth);

    const coverageLayer = L.featureGroup([
        L.polygon(points, { color: sectorColor, fillColor: sectorColor, fillOpacity: 0.3 }),
        L.circleMarker([lat, lon], { radius: 5, color: 'black', fillColor: 'red', fillOpacity: 1 }),
        L.polyline([[lat, lon], calculateDirectionEndPoint(lat, lon, radius, angle)], {
            color: 'red', weight: 2, dashArray: '5, 5'
        })
    ]).addTo(map);

    coverageLayers.push(coverageLayer);
    map.setView([lat, lon], 13);
}

function calculateCoveragePoints(lat, lon, radius, angle, beamWidth) {
    const points = [[lat, lon]];
    const steps = 32;
    const startAngle = (angle - beamWidth / 2) * Math.PI / 180;
    const endAngle = (angle + beamWidth / 2) * Math.PI / 180;

    for (let i = 0; i <= steps; i++) {
        const currentAngle = startAngle + (endAngle - startAngle) * (i / steps);
        const newLat = lat + (radius * Math.cos(currentAngle)) / 111320;
        const newLon = lon + (radius * Math.sin(currentAngle)) / (111320 * Math.cos(lat * Math.PI / 180));
        points.push([newLat, newLon]);
    }
    points.push([lat, lon]);
    return points;
}

function calculateDirectionEndPoint(lat, lon, radius, angle) {
    const radians = angle * Math.PI / 180;
    const endLat = lat + (radius * 0.5 * Math.cos(radians)) / 111320;
    const endLon = lon + (radius * 0.5 * Math.sin(radians)) / (111320 * Math.cos(lat * Math.PI / 180));
    return [endLat, endLon];
}

function clearAllCoverage() {
    coverageLayers.forEach(layer => map.removeLayer(layer));
    coverageLayers = [];
}

function toggleSettings() {
    const content = document.querySelector('.settings-content');
    const button = document.querySelector('.settings-panel .collapsible');
    if (content.style.maxHeight) {
        content.style.maxHeight = null;
        content.style.display = 'none';
        button.classList.remove('active');
    } else {
        content.style.display = 'block';
        content.style.maxHeight = content.scrollHeight + "px";
        button.classList.add('active');
    }
}

function getUserLocation() {
    if ("geolocation" in navigator) {
        const consentMessage =
            "এই ওয়েবসাইট ব্যবহার করতে আপনাকে লোকেশন পারমিশন দিতে হবে। " +
            "লোকেশন পারমিশন না দিলে অনেকসময় এটি ভুল তথ্য দিতে পারে তাই অনুগ্রহ করে OK তে " +
            "ট্যাপ করুন এবং পরবর্তীতে Location পারমিশন দিন।";

        if (confirm(consentMessage)) {
            navigator.geolocation.getCurrentPosition(
                function (position) {
                    const userLat = position.coords.latitude;
                    const userLon = position.coords.longitude;
                    try {
                        if (userLocationMarker) map.removeLayer(userLocationMarker);
                        userLocationMarker = L.marker([userLat, userLon], {
                            icon: L.icon({
                                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
                                iconSize: [25, 41], iconAnchor: [12, 41],
                                popupAnchor: [1, -34],
                                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                                shadowSize: [41, 41]
                            })
                        }).addTo(map);
                        userLocationMarker.bindPopup("Your Location").openPopup();
                        map.setView([userLat, userLon], 13);
                        saveUserLocation(userLat, userLon);
                    } catch (error) {
                        console.error("Error handling location:", error);
                        alert("There was an error displaying your location on the map.");
                    }
                },
                function (error) {
                    let errorMessage = "Unable to retrieve your location. ";
                    switch (error.code) {
                        case error.PERMISSION_DENIED: errorMessage += "Location permission was denied."; break;
                        case error.POSITION_UNAVAILABLE: errorMessage += "Location information is unavailable."; break;
                        case error.TIMEOUT: errorMessage += "Location request timed out."; break;
                        default: errorMessage += "Please check your browser settings.";
                    }
                    alert(errorMessage);
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        }
    } else {
        alert("Geolocation is not supported by your browser.");
    }
}

function saveUserLocation(latitude, longitude) {
    const locationData = {
        latitude, longitude,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
    };
    const scriptUrl = 'https://script.google.com/macros/s/AKfycbznkIMB80wWSoNc-kftPG1mbCR4NZT7iiRZ17IhQnBNn5lKbtx8TOcyaDYuf1Hkz6ab/exec';
    const urlParams = new URLSearchParams(locationData);
    fetch(`${scriptUrl}?${urlParams.toString()}`, { method: 'GET', mode: 'no-cors' })
        .then(() => {
            const stored = JSON.parse(localStorage.getItem('userLocations') || '[]');
            stored.push(locationData);
            localStorage.setItem('userLocations', JSON.stringify(stored));
        })
        .catch(error => {
            const failed = JSON.parse(localStorage.getItem('failedLocationSubmissions') || '[]');
            failed.push(locationData);
            localStorage.setItem('failedLocationSubmissions', JSON.stringify(failed));
        });
}

function toggleSearch() {
    const content = document.querySelector('.search-content');
    const button = document.querySelector('.collapsible');
    if (content.style.maxHeight) {
        content.style.maxHeight = null;
        content.style.display = 'none';
        button.classList.remove('active');
    } else {
        content.style.display = 'block';
        content.style.maxHeight = content.scrollHeight + "px";
        button.classList.add('active');
    }
}

function searchByCellInfo() {
    const lac = parseInt(document.getElementById('lac').value);
    const cellid = parseInt(document.getElementById('cellid').value);
    const operator = document.getElementById('operator').value;
    const operatorData = cellTowerData[operator];

    if (!operatorData) {
        loadOperatorData(operator);
        alert('Please wait while we load the data and try again in a few seconds.');
        return;
    }

    let matchedTower = operatorData.find(tower => String(tower.lac) === String(lac) && String(tower.cellid) === String(cellid));
    let searchMethod = '';

    if (matchedTower) {
        searchMethod = 'LAC and Cell ID';
    } else {
        const matchedTowers = operatorData.filter(tower => String(tower.cellid) === String(cellid));
        if (matchedTowers.length === 1) {
            matchedTower = matchedTowers[0];
            searchMethod = 'Cell ID only';
        } else if (matchedTowers.length > 1) {
            alert(`Found ${matchedTowers.length} towers with Cell ID: ${cellid}. Please specify LAC.\n\nMatching LACs: ${matchedTowers.map(t => t.lac).join(', ')}`);
            return;
        }
    }

    if (matchedTower) {
        document.getElementById('lat').value = matchedTower.lat;
        document.getElementById('lon').value = matchedTower.lon;
        document.getElementById('network').value = matchedTower.network;
        const direction = matchedTower.direction || 0;
        document.getElementById('angle').value = direction;
        updateAngleDisplay(direction);
        updateColorFromDefault();
        generateCoverage();
        const lacInfo = matchedTower.lac ? ` (LAC: ${matchedTower.lac})` : '';
        alert(`Cell tower found using ${searchMethod}!\nCell ID: ${cellid}${lacInfo}\nNetwork: ${matchedTower.network}`);
    } else {
        alert(`No matching cell tower found for Cell ID: ${cellid}${lac ? ` and LAC: ${lac}` : ''}`);
    }
}

function showCookieNotice() {
    if (!localStorage.getItem('cookieConsent')) {
        document.getElementById('cookie-notice').style.display = 'block';
    }
}

function acceptCookies() {
    localStorage.setItem('cookieConsent', 'accepted');
    document.getElementById('cookie-notice').style.display = 'none';
    cookieConsent = true;
}

function declineCookies() {
    localStorage.setItem('cookieConsent', 'declined');
    document.getElementById('cookie-notice').style.display = 'none';
    cookieConsent = false;
}

// ─────────────────────────────────────────────
// TIMELINE PLAYBACK FEATURE
// ─────────────────────────────────────────────

function toggleTimeline() {
    const content = document.getElementById('timeline-content');
    const button = document.getElementById('timeline-toggle-btn');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        button.classList.add('active');
    } else {
        content.style.display = 'none';
        button.classList.remove('active');
    }
}

function handleCDRFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const text = e.target.result;
        parseCDR(text);
    };
    reader.readAsText(file);
}

function parseCDR(text) {
    // Remove BOM character if present
    text = text.replace(/^\uFEFF/, '');

    const lines = text.trim().split('\n');
    if (lines.length < 2) {
        alert('CSV file appears to be empty or invalid.');
        return;
    }

    // Auto-detect delimiter: tab or comma
    const firstLine = lines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';

    // Parse header respecting quoted fields
    const headers = parseCSVLine(firstLine, delimiter).map(h => h.trim());

    const idxStart    = headers.findIndex(h => h.toUpperCase() === 'START');
    const idxOperator = headers.findIndex(h => h.toUpperCase().includes('PROVIDER'));
    const idxLAC      = headers.findIndex(h => h.toUpperCase() === 'LACSTARTA');
    const idxCELL     = headers.findIndex(h => h.toUpperCase() === 'CISTARTA');
    const idxNetwork  = headers.findIndex(h => h.toUpperCase() === 'NETWORK TYPE' || h.toUpperCase() === 'NETWORKTYPE');
    const idxUsage    = headers.findIndex(h => h.toUpperCase() === 'USAGE TYPE' || h.toUpperCase() === 'USAGETYPE');
    const idxAParty   = headers.findIndex(h => h.toUpperCase() === 'APARTY');
    const idxBParty   = headers.findIndex(h => h.toUpperCase() === 'BPARTY');
    const idxDuration = headers.findIndex(h => h.toUpperCase().includes('DURATION'));
    const idxAddress  = headers.findIndex(h => h.toUpperCase() === 'ADDRESS');

    if (idxStart === -1 || idxLAC === -1 || idxCELL === -1) {
        alert(`Could not find required columns.\nFound: ${headers.join(', ')}`);
        return;
    }

    const parsed = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = parseCSVLine(lines[i], delimiter);

        const lac    = cols[idxLAC]  ? cols[idxLAC].trim()  : '';
        const cellid = cols[idxCELL] ? cols[idxCELL].trim() : '';
        if (!lac || !cellid) continue;

        const operator = idxOperator >= 0 ? (cols[idxOperator] || '').trim().toLowerCase() : '';
        const network  = idxNetwork  >= 0 ? (cols[idxNetwork]  || '4G').trim() : '4G';
        const startRaw = cols[idxStart] ? cols[idxStart].trim() : '';
        const usage    = idxUsage    >= 0 ? (cols[idxUsage]    || '').trim() : '';
        const aParty   = idxAParty   >= 0 ? (cols[idxAParty]   || '').trim() : '';
        const bParty   = idxBParty   >= 0 ? (cols[idxBParty]   || '').trim() : '';
        const duration = idxDuration >= 0 ? (cols[idxDuration] || '').trim() : '';
        const address  = idxAddress  >= 0 ? (cols[idxAddress]  || '').trim() : '';

        let operatorKey = 'robi';
        if (operator.includes('grameen') || operator.includes('gp')) operatorKey = 'grameenphone';
        else if (operator.includes('robi'))       operatorKey = 'robi';
        else if (operator.includes('banglalink') || operator.includes('bl')) operatorKey = 'banglalink';
        else if (operator.includes('teletalk'))   operatorKey = 'teletalk';
        else if (operator.includes('airtel'))     operatorKey = 'airtel';

        parsed.push({ time: startRaw, lac, cellid, operator: operatorKey, network, usage, aParty, bParty, duration, address });
    }

    if (parsed.length === 0) {
        alert('No valid CDR rows found. Please check your file.');
        return;
    }

    parsed.sort((a, b) => a.time.localeCompare(b.time));
    timelineAllData = parsed;   // keep full unfiltered set
    timelineData = parsed;
    timelineIndex = 0;

    // Populate filter dropdowns
    populateFilters(parsed);

    document.getElementById('timeline-status').textContent = `✅ Loaded ${parsed.length} CDR records`;
    document.getElementById('timeline-slider').max = parsed.length - 1;
    document.getElementById('timeline-slider').value = 0;
    document.getElementById('timeline-controls').style.display = 'block';

    const operators = [...new Set(parsed.map(r => r.operator))];
    operators.forEach(op => { if (!cellTowerData[op]) loadOperatorData(op); });

    // Pre-load tower data then plot ALL records at once
    Promise.all(operators.map(op => waitForOperatorData(op))).then(() => {
        clearTimelineLayers();
        plotAllRecords();
        updateInfoPanel(parsed[0], 0);
    });
}

function waitForOperatorData(operator) {
    if (cellTowerData[operator]) return Promise.resolve();
    return new Promise(resolve => {
        loadOperatorData(operator);
        const check = setInterval(() => {
            if (cellTowerData[operator]) { clearInterval(check); resolve(); }
        }, 300);
        setTimeout(() => { clearInterval(check); resolve(); }, 6000);
    });
}

function populateFilters(data) {
    const usageTypes = [...new Set(data.map(r => r.usage).filter(Boolean))];
    const sel = document.getElementById('tl-filter-usage');
    sel.innerHTML = '<option value="">All Types</option>';
    usageTypes.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u; opt.textContent = u;
        sel.appendChild(opt);
    });
}

function applyFilter() {
    const usageFilter = document.getElementById('tl-filter-usage').value;
    timelineData = usageFilter
        ? timelineAllData.filter(r => r.usage === usageFilter)
        : timelineAllData;
    timelineIndex = 0;
    document.getElementById('timeline-slider').max = timelineData.length - 1;
    document.getElementById('timeline-slider').value = 0;
    document.getElementById('timeline-status').textContent =
        `✅ Showing ${timelineData.length} of ${timelineAllData.length} records`;
    clearTimelineLayers();
    plotAllRecords();
    if (timelineData.length > 0) updateInfoPanel(timelineData[0], 0);
}

function formatTime(raw) {
    // Input: YYYYMMDDHHmmss or YYYY-MM-DD HH:mm:ss or similar
    if (!raw) return '-';
    const s = raw.replace(/\D/g, ''); // strip non-digits
    if (s.length >= 14) {
        const dd = s.substring(6,8), mm = s.substring(4,6), yyyy = s.substring(0,4);
        const hh = s.substring(8,10), min = s.substring(10,12), sec = s.substring(12,14);
        return `${dd}-${mm}-${yyyy} ${hh}:${min}:${sec}`;
    }
    return raw;
}

// Plot ALL records as cluster markers at once (no step-by-step needed)
function plotAllRecords() {
    // Build clusters from ALL timelineData up to current index
    towerClusters = {};
    for (let i = 0; i <= timelineIndex; i++) {
        const r = timelineData[i];
        const op = cellTowerData[r.operator];
        if (!op) continue;
        const tower = findTower(op, r.lac, r.cellid);
        if (!tower) continue;
        const tLat = parseFloat(tower.LATITUDE || tower.lat);
        const tLon = parseFloat(tower.LONGITUDE || tower.lon);
        const key = makeLocationKey(tLat, tLon);
        if (!towerClusters[key]) {
            towerClusters[key] = { tower, records: [], marker: null };
        }
        towerClusters[key].records.push(r);
    }

    // Draw markers
    Object.entries(towerClusters).forEach(([key, cluster]) => {
        const tower = cluster.tower;
        const lat = parseFloat(tower.LATITUDE || tower.lat);
        const lon = parseFloat(tower.LONGITUDE || tower.lon);
        const isActive = (key === `${timelineData[timelineIndex]?.lac}_${timelineData[timelineIndex]?.cellid}`);
        cluster.marker = L.marker([lat, lon], { icon: makeClusterIcon(cluster.records.length, isActive) })
            .addTo(map)
            .on('click', () => showSectorForCluster(key));
        timelineLayers.push(cluster.marker);
    });

    // Draw path
    drawPath(timelineIndex);

    // Show active sector
    const _activeRec = timelineData[timelineIndex];
    const _activeOp = _activeRec ? cellTowerData[_activeRec.operator] : null;
    const _activeTower = _activeOp ? findTower(_activeOp, _activeRec.lac, _activeRec.cellid) : null;
    const activeKey = _activeTower
        ? makeLocationKey(parseFloat(_activeTower.LATITUDE || _activeTower.lat), parseFloat(_activeTower.LONGITUDE || _activeTower.lon))
        : null;
    if (towerClusters[activeKey]) showSectorForCluster(activeKey);
}

// Properly parse a CSV/TSV line respecting quoted fields
function parseCSVLine(line, delimiter) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === delimiter && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    result.push(current);
    return result;
}

// ── Tower cluster state ──
let towerClusters = {};      // key: "lac_cellid" → { tower, records[], marker, sectorLayer }
let activeSectorLayer = null;
let currentHighlightMarker = null;

function clearTimelineLayers() {
    timelineLayers.forEach(l => map.removeLayer(l));
    timelineLayers = [];
    if (timelineMarker) { map.removeLayer(timelineMarker); timelineMarker = null; }
    if (timelinePath) { map.removeLayer(timelinePath); timelinePath = null; }
    if (activeSectorLayer) { map.removeLayer(activeSectorLayer); activeSectorLayer = null; }
    if (currentHighlightMarker) { map.removeLayer(currentHighlightMarker); currentHighlightMarker = null; }
    Object.values(towerClusters).forEach(c => { if (c.marker) map.removeLayer(c.marker); });
    towerClusters = {};
}

// Extract path coords up to index without dedup (preserve actual movement)
function drawPath(upToIndex) {
    if (timelinePath) { map.removeLayer(timelinePath); timelinePath = null; }
    const pathCoords = [];
    for (let i = 0; i <= upToIndex; i++) {
        const r = timelineData[i];
        const op = cellTowerData[r.operator];
        if (!op) continue;
        const t = findTower(op, r.lac, r.cellid);
        if (t) pathCoords.push([parseFloat(t.LATITUDE || t.lat), parseFloat(t.LONGITUDE || t.lon)]);
    }
    if (pathCoords.length > 1) {
        timelinePath = L.polyline(pathCoords, {
            color: '#E53935', weight: 2.5, opacity: 0.65, dashArray: '8,5'
        }).addTo(map);
    }
}

function updateInfoPanel(record, index) {
    if (!record) return;
    document.getElementById('tl-time').textContent = formatTime(record.time);
    document.getElementById('tl-operator').textContent = record.operator || '-';
    document.getElementById('tl-network').textContent = record.network || '-';
    document.getElementById('tl-lac').textContent = record.lac || '-';
    document.getElementById('tl-cell').textContent = record.cellid || '-';
    document.getElementById('tl-usage').textContent = record.usage || '-';
    document.getElementById('tl-bparty').textContent = record.bParty || '-';
    document.getElementById('tl-duration').textContent = record.duration ? record.duration + 's' : '-';
    document.getElementById('tl-address').textContent = record.address || '-';
    document.getElementById('tl-counter').textContent = `${index + 1} / ${timelineData.length}`;
    document.getElementById('timeline-slider').value = index;
}

function findTower(operatorData, lac, cellid) {
    const lacInt = parseInt(lac), cidInt = parseInt(cellid);
    return operatorData.find(t =>
        (parseInt(t.LAC || t.lac) === lacInt) && (parseInt(t.CELLID || t.cellid) === cidInt)
    ) || operatorData.find(t => parseInt(t.CELLID || t.cellid) === cidInt);
}

// Round lat/lon to ~50m grid to group physically co-located towers
// 0.0005 degrees ≈ 55 meters — close enough to merge 2G/4G on same mast
function makeLocationKey(lat, lon) {
    const rLat = Math.round(parseFloat(lat) / 0.0005) * 0.0005;
    const rLon = Math.round(parseFloat(lon) / 0.0005) * 0.0005;
    return `${rLat.toFixed(4)}_${rLon.toFixed(4)}`;
}

function makeClusterIcon(count, isActive) {
    const bg = isActive ? '#E53935' : '#1565C0';
    const border = isActive ? '#ff8a80' : '#90CAF9';
    return L.divIcon({
        className: '',
        html: `<div style="
            background:${bg};
            border: 3px solid ${border};
            color: white;
            font-weight: bold;
            font-size: 13px;
            width: 34px; height: 34px;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
            font-family: Arial, sans-serif;
        ">${count}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
    });
}

function showSectorForCluster(key) {
    const cluster = towerClusters[key];
    if (!cluster || !cluster.tower) return;

    // Remove previous active sector
    if (activeSectorLayer) { map.removeLayer(activeSectorLayer); activeSectorLayer = null; }

    const tower = cluster.tower;
    const lat = parseFloat(tower.LATITUDE || tower.lat);
    const lon = parseFloat(tower.LONGITUDE || tower.lon);
    const direction = parseFloat(tower.Direction || tower.direction || 0);

    // Pick network from most recent record at this tower
    const lastRecord = cluster.records[cluster.records.length - 1];
    const network = lastRecord.network || tower.Network || tower.network || '4G';

    const networkColors = { '2G': '#E53935', '3G': '#FB8C00', '4G': '#43A047' };
    const color = networkColors[network] || '#43A047';

    const radius = defaultSettings[network] ? defaultSettings[network].radius * 1000 : 500;
    const beamWidth = defaultSettings[network] ? defaultSettings[network].beamWidth : 120;

    // Draw a clean proper sector (wedge)
    const sectorPoints = [];
    const steps = 48;
    const startAngle = (direction - beamWidth / 2) * Math.PI / 180;
    const endAngle   = (direction + beamWidth / 2) * Math.PI / 180;
    sectorPoints.push([lat, lon]);
    for (let i = 0; i <= steps; i++) {
        const angle = startAngle + (endAngle - startAngle) * (i / steps);
        const sLat = lat + (radius * Math.cos(angle)) / 111320;
        const sLon = lon + (radius * Math.sin(angle)) / (111320 * Math.cos(lat * Math.PI / 180));
        sectorPoints.push([sLat, sLon]);
    }
    sectorPoints.push([lat, lon]);

    // Direction arrow endpoint
    const arrowRad = direction * Math.PI / 180;
    const arrowLat = lat + (radius * 0.85 * Math.cos(arrowRad)) / 111320;
    const arrowLon = lon + (radius * 0.85 * Math.sin(arrowRad)) / (111320 * Math.cos(lat * Math.PI / 180));

    // Build popup content listing all records
    const rows = cluster.records.map(r =>
        `<tr>
            <td style="padding:2px 6px;color:#555;font-size:11px;">${formatTime(r.time)}</td>
            <td style="padding:2px 6px;font-size:11px;">${r.usage}</td>
            <td style="padding:2px 6px;font-size:11px;">${r.bParty || '-'}</td>
            <td style="padding:2px 6px;font-size:11px;">${r.duration ? r.duration+'s' : '-'}</td>
        </tr>`
    ).join('');

    const popupHtml = `
        <div style="min-width:200px;">
            <b>📡 ${(lastRecord.operator || '').toUpperCase()} ${network}</b><br>
            <span style="font-size:11px;color:#666;">Cells: ${[...new Set(cluster.records.map(r=>r.cellid))].join(', ')}</span><br>
            <span style="font-size:11px;color:#666;">Direction: ${direction}° | Hits: <b>${cluster.records.length}</b></span><br>
            ${lastRecord.address ? `<span style="font-size:10px;color:#888;">📍 ${lastRecord.address.substring(0,70)}</span><br>` : ''}
            <table style="margin-top:6px;border-collapse:collapse;width:100%;">
                <tr style="background:#f5f5f5;">
                    <th style="padding:2px 6px;font-size:11px;text-align:left;">Time</th>
                    <th style="padding:2px 6px;font-size:11px;text-align:left;">Type</th>
                    <th style="padding:2px 6px;font-size:11px;text-align:left;">B-Party</th>
                    <th style="padding:2px 6px;font-size:11px;text-align:left;">Dur</th>
                </tr>
                ${rows}
            </table>
        </div>`;

    activeSectorLayer = L.featureGroup([
        L.polygon(sectorPoints, {
            color, fillColor: color,
            fillOpacity: 0.25, weight: 2, opacity: 0.9
        }),
        L.polyline([[lat, lon], [arrowLat, arrowLon]], {
            color, weight: 2.5, opacity: 1, dashArray: '6,3'
        })
    ]).addTo(map);

    activeSectorLayer.bindPopup(popupHtml).openPopup();

    // Update all marker icons — highlight active
    Object.entries(towerClusters).forEach(([k, c]) => {
        if (c.marker) c.marker.setIcon(makeClusterIcon(c.records.length, k === key));
    });
}

async function renderTimelineStep(index) {
    if (!timelineData.length) return;
    const record = timelineData[index];

    updateInfoPanel(record, index);

    if (!cellTowerData[record.operator]) {
        await waitForOperatorData(record.operator);
    }

    const operatorData = cellTowerData[record.operator];
    if (!operatorData) return;

    const tower = findTower(operatorData, record.lac, record.cellid);
    if (!tower) {
        document.getElementById('tl-address').textContent = '⚠️ Cell not found in database';
        return;
    }

    const lat = parseFloat(tower.LATITUDE || tower.lat);
    const lon = parseFloat(tower.LONGITUDE || tower.lon);
    const clusterKey = makeLocationKey(lat, lon);

    // Only add this record to cluster if stepping forward (not already counted)
    if (!towerClusters[clusterKey]) {
        towerClusters[clusterKey] = { tower, records: [], marker: null };
    }
    // Avoid double-counting: only add if this is truly a new step forward
    const alreadyCounted = towerClusters[clusterKey].records.some(r => r === record);
    if (!alreadyCounted) {
        towerClusters[clusterKey].records.push(record);
    }

    const cluster = towerClusters[clusterKey];

    if (!cluster.marker) {
        cluster.marker = L.marker([lat, lon], { icon: makeClusterIcon(cluster.records.length, true) })
            .addTo(map)
            .on('click', () => showSectorForCluster(clusterKey));
        timelineLayers.push(cluster.marker);
    } else {
        cluster.marker.setIcon(makeClusterIcon(cluster.records.length, true));
    }

    // Deactivate all other markers
    Object.entries(towerClusters).forEach(([k, c]) => {
        if (k !== clusterKey && c.marker) c.marker.setIcon(makeClusterIcon(c.records.length, false));
    });

    showSectorForCluster(clusterKey);
    drawPath(index);
    map.setView([lat, lon], 14);
}

function timelinePlay() {
    if (isPlaying) return;
    if (timelineIndex >= timelineData.length - 1) timelineIndex = 0;
    isPlaying = true;
    document.getElementById('tl-play-btn').textContent = '⏸ Pause';

    const speed = parseInt(document.getElementById('tl-speed').value) || 1500;

    timelineInterval = setInterval(async () => {
        if (timelineIndex >= timelineData.length - 1) {
            timelinePause();
            return;
        }
        timelineIndex++;
        await renderTimelineStep(timelineIndex);
    }, speed);
}

function timelinePause() {
    isPlaying = false;
    clearInterval(timelineInterval);
    document.getElementById('tl-play-btn').textContent = '▶ Play';
}

function timelineNext() {
    timelinePause();
    if (timelineIndex < timelineData.length - 1) {
        timelineIndex++;
        renderTimelineStep(timelineIndex);
    }
}

function timelinePrev() {
    timelinePause();
    if (timelineIndex > 0) {
        timelineIndex--;
        renderTimelineStep(timelineIndex);
    }
}

function timelineSliderChange(val) {
    timelinePause();
    timelineIndex = parseInt(val);
    // Rebuild clusters from scratch up to this index (slider can go backwards)
    clearTimelineLayers();
    plotAllRecordsUpTo(timelineIndex);
}

// Plot all records up to a given index — used when slider jumps
function plotAllRecordsUpTo(upToIndex) {
    towerClusters = {};
    for (let i = 0; i <= upToIndex; i++) {
        const r = timelineData[i];
        const op = cellTowerData[r.operator];
        if (!op) continue;
        const tower = findTower(op, r.lac, r.cellid);
        if (!tower) continue;
        const tLat2 = parseFloat(tower.LATITUDE || tower.lat);
        const tLon2 = parseFloat(tower.LONGITUDE || tower.lon);
        const key = makeLocationKey(tLat2, tLon2);
        if (!towerClusters[key]) towerClusters[key] = { tower, records: [], marker: null };
        towerClusters[key].records.push(r);
    }

    const _upRec = timelineData[upToIndex];
    const _upOp = _upRec ? cellTowerData[_upRec.operator] : null;
    const _upTower = _upOp ? findTower(_upOp, _upRec.lac, _upRec.cellid) : null;
    const activeKey = _upTower
        ? makeLocationKey(parseFloat(_upTower.LATITUDE || _upTower.lat), parseFloat(_upTower.LONGITUDE || _upTower.lon))
        : null;

    Object.entries(towerClusters).forEach(([key, cluster]) => {
        const tower = cluster.tower;
        const lat = parseFloat(tower.LATITUDE || tower.lat);
        const lon = parseFloat(tower.LONGITUDE || tower.lon);
        const isActive = key === activeKey;
        cluster.marker = L.marker([lat, lon], { icon: makeClusterIcon(cluster.records.length, isActive) })
            .addTo(map)
            .on('click', () => showSectorForCluster(key));
        timelineLayers.push(cluster.marker);
    });

    drawPath(upToIndex);
    if (towerClusters[activeKey]) showSectorForCluster(activeKey);
    if (timelineData[upToIndex]) {
        updateInfoPanel(timelineData[upToIndex], upToIndex);
        const t = towerClusters[activeKey]?.tower;
        if (t) map.setView([parseFloat(t.LATITUDE || t.lat), parseFloat(t.LONGITUDE || t.lon)], 14);
    }
}

function clearTimeline() {
    timelinePause();
    clearTimelineLayers();
    timelineData = [];
    timelineAllData = [];
    timelineIndex = 0;
    document.getElementById('timeline-status').textContent = 'No file loaded';
    document.getElementById('timeline-controls').style.display = 'none';
    document.getElementById('tl-time').textContent = '-';
    document.getElementById('tl-operator').textContent = '-';
    document.getElementById('tl-network').textContent = '-';
    document.getElementById('tl-lac').textContent = '-';
    document.getElementById('tl-cell').textContent = '-';
    document.getElementById('tl-usage').textContent = '-';
    document.getElementById('tl-bparty').textContent = '-';
    document.getElementById('tl-duration').textContent = '-';
    document.getElementById('tl-address').textContent = '-';
    document.getElementById('tl-filter-usage').innerHTML = '<option value="">All Types</option>';
    document.getElementById('cdr-file-input').value = '';
}

// Initialize when document is loaded — run security gate first
window.addEventListener('load', () => {
    securityGate();
});


// Load all records onto map at once (jump to end)
function timelineLoadAll() {
    timelinePause();
    timelineIndex = timelineData.length - 1;
    clearTimelineLayers();
    plotAllRecordsUpTo(timelineIndex);
    document.getElementById('timeline-slider').value = timelineIndex;
}

// ─────────────────────────────────────────────
// SECURITY GATE — Location + Bangladesh check
// ─────────────────────────────────────────────

const BD_BOUNDS = { minLat: 20.7472, maxLat: 26.6375, minLon: 88.0833, maxLon: 92.6810 };
const LOG_URL = 'https://script.google.com/macros/s/AKfycbzmVZhElY_rwlpSrw2tn6siMb0rBlRA3lR9Zb49P7Kx7T8Pgzu1_ormGdiotFbzQSA9/exec'; // <-- paste your Apps Script URL here

function isInsideBangladesh(lat, lon) {
    return lat >= BD_BOUNDS.minLat && lat <= BD_BOUNDS.maxLat &&
           lon >= BD_BOUNDS.minLon && lon <= BD_BOUNDS.maxLon;
}

function showBlockScreen(message, icon = '🚫') {
    // Hide everything
    document.querySelector('.container').style.display = 'none';
    document.getElementById('cookie-notice').style.display = 'none';

    // Show block screen
    const block = document.getElementById('block-screen');
    block.style.display = 'flex';
    document.getElementById('block-icon').textContent = icon;
    document.getElementById('block-message').textContent = message;
}

function showLoadingScreen(message) {
    document.getElementById('loading-screen').style.display = 'flex';
    document.getElementById('loading-message').textContent = message;
}

function hideLoadingScreen() {
    document.getElementById('loading-screen').style.display = 'none';
}

// Try multiple IP lookup services with fallback
async function getIPInfo() {
    // Route through Apps Script to avoid CORS — Apps Script fetches IP info server-side
    try {
        const r = await fetch(`${LOG_URL}?action=getIPInfo`);
        const d = await r.json();
        if (d && d.ip) return d;
    } catch (e) {
        console.warn('IP lookup failed:', e);
    }
    return null; // GPS check will still run
}

function logVisitor(ipInfo, gpsLat, gpsLon, status) {
    if (!LOG_URL || LOG_URL.includes('YOUR_APPS_SCRIPT')) return;
    const params = new URLSearchParams({
        action: 'logVisitor',
        ip: (ipInfo && ipInfo.ip) ? ipInfo.ip : 'unknown',
        country: (ipInfo && ipInfo.country_name) ? ipInfo.country_name : 'unknown',
        country_code: (ipInfo && ipInfo.country_code) ? ipInfo.country_code : 'unknown',
        city: (ipInfo && ipInfo.city) ? ipInfo.city : 'unknown',
        region: (ipInfo && ipInfo.region) ? ipInfo.region : 'unknown',
        isp: (ipInfo && ipInfo.org) ? ipInfo.org : 'unknown',
        ip_lat: (ipInfo && ipInfo.latitude) ? ipInfo.latitude : '',
        ip_lon: (ipInfo && ipInfo.longitude) ? ipInfo.longitude : '',
        gps_lat: gpsLat || '',
        gps_lon: gpsLon || '',
        status: status,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent.substring(0, 100)
    });

    // Use Image beacon — bypasses CORS entirely, works perfectly with Apps Script doGet
    const img = new Image();
    img.src = `${LOG_URL}?${params.toString()}`;
}

async function securityGate() {
    showLoadingScreen('একটু অপেক্ষা করুন...');

    // ── Step 1: Check IP-based country ──
    showLoadingScreen('আইপি যাচাই করা হচ্ছে...');
    const ipInfo = await getIPInfo();
    const ipCountry = ipInfo?.country_code || '';

    // Only block if IP check clearly shows non-BD country
    // If IP lookup fails (null), skip IP check and rely on GPS
    if (ipInfo && ipCountry && ipCountry !== 'BD') {
        logVisitor(ipInfo, null, null, 'BLOCKED_IP');
        hideLoadingScreen();
        showBlockScreen(
            'আপনার আইপি ঠিকানা বাংলাদেশের বাইরে থেকে দেখাচ্ছে।\n' +
            'This site is only accessible from Bangladesh.\n\n' +
            'আইপি: ' + (ipInfo.ip || 'unknown') + '\n' +
            'দেশ: ' + (ipInfo.country_name || 'unknown'),
            '🌍'
        );
        return;
    }

    // ── Step 2: Request GPS location ──
    showLoadingScreen('লোকেশন পারমিশন প্রয়োজন...');

    if (!navigator.geolocation) {
        logVisitor(ipInfo, null, null, 'BLOCKED_NO_GEOLOCATION');
        hideLoadingScreen();
        showBlockScreen(
            'আপনার ডিভাইস বা ব্রাউজার লোকেশন সাপোর্ট করে না।\n\n' +
            'দয়া করে একটি আধুনিক ব্রাউজার ব্যবহার করুন।',
            '📵'
        );
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const gpsLat = position.coords.latitude;
            const gpsLon = position.coords.longitude;

            // ── Step 3: Verify GPS is inside Bangladesh ──
            if (!isInsideBangladesh(gpsLat, gpsLon)) {
                logVisitor(ipInfo, gpsLat, gpsLon, 'BLOCKED_GPS_OUTSIDE_BD');
                hideLoadingScreen();
                showBlockScreen(
                    'আপনার লোকেশন বাংলাদেশের বাইরে দেখাচ্ছে।\n' +
                    'Your GPS location is outside Bangladesh.\n\n' +
                    'অবস্থান: ' + gpsLat.toFixed(4) + ', ' + gpsLon.toFixed(4),
                    '📍'
                );
                return;
            }

            // ── All checks passed ──
            logVisitor(ipInfo, gpsLat, gpsLon, 'ALLOWED');
            hideLoadingScreen();

            document.querySelector('.container').style.display = '';
            showCookieNotice();
            initMap();
            updateOperatorDisclaimer();
            loadOperatorData('grameenphone');

            try {
                userLocationMarker = L.marker([gpsLat, gpsLon]).addTo(map);
                userLocationMarker.bindPopup('আপনার অবস্থান').openPopup();
                map.setView([gpsLat, gpsLon], 13);
            } catch(e) {}
        },
        (error) => {
            let status = 'BLOCKED_LOCATION_DENIED';
            let msg, icon;

            if (error.code === error.PERMISSION_DENIED) {
                msg = '🔒 লোকেশন পারমিশন বন্ধ আছে।\n\n' +
                      'সাইট ব্যবহার করতে লোকেশন পারমিশন দিতে হবে।\n\n' +
                      'করণীয়:\n' +
                      '• ব্রাউজারের অ্যাড্রেস বারে 🔒 আইকনে ট্যাপ করুন\n' +
                      '• Location → Allow করুন\n' +
                      '• পেজ রিফ্রেশ করুন';
                icon = '🔒';
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                status = 'BLOCKED_LOCATION_UNAVAILABLE';
                msg = '📡 লোকেশন তথ্য পাওয়া যাচ্ছে না।\n\n' +
                      'GPS বা নেটওয়ার্ক লোকেশন চালু করুন এবং আবার চেষ্টা করুন।';
                icon = '📡';
            } else if (error.code === error.TIMEOUT) {
                status = 'BLOCKED_LOCATION_TIMEOUT';
                msg = '⏱ লোকেশন পেতে অনেক সময় লাগছে।\n\n' +
                      'GPS সিগন্যাল দুর্বল। বাইরে গিয়ে আবার চেষ্টা করুন।';
                icon = '⏱';
            } else {
                msg = '❌ লোকেশন সংক্রান্ত সমস্যা হয়েছে।\n\nপেজ রিফ্রেশ করে আবার চেষ্টা করুন।';
                icon = '❌';
            }

            logVisitor(ipInfo, null, null, status);
            hideLoadingScreen();
            showBlockScreen(msg, icon);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
}

// ── Debug: call this from browser console to test logging ──
// Type testLog() in browser console after page loads
function testLog() {
    logVisitor(
        { ip: '1.2.3.4', country_name: 'Bangladesh', country_code: 'BD', city: 'Rajshahi', region: 'Rajshahi Division', org: 'Test ISP', latitude: 24.36, longitude: 88.61 },
        24.36, 88.61,
        'TEST'
    );
    console.log('Test log sent — check your Visitors sheet in ~5 seconds');
}
