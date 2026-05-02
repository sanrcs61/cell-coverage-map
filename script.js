// Global variables
let map;
let coverageLayers = [];
let userLocationMarker;
let cellTowerData = {};
let cookieConsent = false;

// Timeline playback variables
let timelineData = [];
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
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
        alert('CSV file appears to be empty or invalid.');
        return;
    }

    // Parse header
    const headers = lines[0].split('\t').map(h => h.trim());

    const idxStart = headers.findIndex(h => h.toUpperCase() === 'START');
    const idxOperator = headers.findIndex(h => h.toUpperCase().includes('PROVIDER'));
    const idxLAC = headers.findIndex(h => h.toUpperCase() === 'LACSTARTA');
    const idxCELL = headers.findIndex(h => h.toUpperCase() === 'CISTARTA');
    const idxNetwork = headers.findIndex(h => h.toUpperCase().includes('NETWORK'));
    const idxUsage = headers.findIndex(h => h.toUpperCase().includes('USAGE'));
    const idxAParty = headers.findIndex(h => h.toUpperCase() === 'APARTY');
    const idxBParty = headers.findIndex(h => h.toUpperCase() === 'BPARTY');
    const idxDuration = headers.findIndex(h => h.toUpperCase().includes('DURATION'));
    const idxAddress = headers.findIndex(h => h.toUpperCase() === 'ADDRESS' || h.toUpperCase().includes('ADDRESS'));

    if (idxStart === -1 || idxLAC === -1 || idxCELL === -1) {
        alert('Could not find required columns (START, LACSTARTA, CISTARTA). Please check your CSV format.');
        return;
    }

    const parsed = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t');
        if (cols.length < 3) continue;

        const lac = cols[idxLAC] ? cols[idxLAC].trim() : '';
        const cellid = cols[idxCELL] ? cols[idxCELL].trim() : '';
        const operator = idxOperator >= 0 ? (cols[idxOperator] || '').trim().toLowerCase() : '';
        const network = idxNetwork >= 0 ? (cols[idxNetwork] || '4G').trim() : '4G';
        const startRaw = cols[idxStart] ? cols[idxStart].trim() : '';
        const usage = idxUsage >= 0 ? (cols[idxUsage] || '').trim() : '';
        const aParty = idxAParty >= 0 ? (cols[idxAParty] || '').trim() : '';
        const bParty = idxBParty >= 0 ? (cols[idxBParty] || '').trim() : '';
        const duration = idxDuration >= 0 ? (cols[idxDuration] || '').trim() : '';
        const address = idxAddress >= 0 ? (cols[idxAddress] || '').trim() : '';

        if (!lac || !cellid) continue;

        // Map operator name to key
        let operatorKey = 'robi';
        if (operator.includes('grameen') || operator.includes('gp')) operatorKey = 'grameenphone';
        else if (operator.includes('robi')) operatorKey = 'robi';
        else if (operator.includes('banglalink') || operator.includes('bl')) operatorKey = 'banglalink';
        else if (operator.includes('teletalk')) operatorKey = 'teletalk';
        else if (operator.includes('airtel')) operatorKey = 'airtel';

        parsed.push({
            time: startRaw,
            lac, cellid,
            operator: operatorKey,
            network, usage,
            aParty, bParty,
            duration, address
        });
    }

    if (parsed.length === 0) {
        alert('No valid CDR rows found. Please check your file.');
        return;
    }

    // Sort by time
    parsed.sort((a, b) => a.time.localeCompare(b.time));

    timelineData = parsed;
    timelineIndex = 0;

    document.getElementById('timeline-status').textContent = `✅ Loaded ${parsed.length} CDR records`;
    document.getElementById('timeline-slider').max = parsed.length - 1;
    document.getElementById('timeline-slider').value = 0;
    document.getElementById('timeline-controls').style.display = 'block';

    // Pre-load all operator data needed
    const operators = [...new Set(parsed.map(r => r.operator))];
    operators.forEach(op => {
        if (!cellTowerData[op]) loadOperatorData(op);
    });

    // Draw all cells faintly first
    clearTimelineLayers();
    renderTimelineStep(0);
}

function clearTimelineLayers() {
    timelineLayers.forEach(l => map.removeLayer(l));
    timelineLayers = [];
    if (timelineMarker) { map.removeLayer(timelineMarker); timelineMarker = null; }
    if (timelinePath) { map.removeLayer(timelinePath); timelinePath = null; }
}

async function renderTimelineStep(index) {
    if (!timelineData.length) return;
    const record = timelineData[index];

    // Update info panel
    document.getElementById('tl-time').textContent = record.time || '-';
    document.getElementById('tl-operator').textContent = record.operator || '-';
    document.getElementById('tl-network').textContent = record.network || '-';
    document.getElementById('tl-lac').textContent = record.lac || '-';
    document.getElementById('tl-cell').textContent = record.cellid || '-';
    document.getElementById('tl-usage').textContent = record.usage || '-';
    document.getElementById('tl-duration').textContent = record.duration ? record.duration + 's' : '-';
    document.getElementById('tl-address').textContent = record.address || '-';
    document.getElementById('tl-counter').textContent = `${index + 1} / ${timelineData.length}`;
    document.getElementById('timeline-slider').value = index;

    // Load operator data if needed
    if (!cellTowerData[record.operator]) {
        await new Promise(resolve => {
            const check = setInterval(() => {
                if (cellTowerData[record.operator]) { clearInterval(check); resolve(); }
            }, 300);
            loadOperatorData(record.operator);
            setTimeout(() => { clearInterval(check); resolve(); }, 5000);
        });
    }

    const operatorData = cellTowerData[record.operator];
    if (!operatorData) return;

    const lac = parseInt(record.lac);
    const cellid = parseInt(record.cellid);

    // Support both mixed case (old robi.json) and lowercase (new data/robi.json)
    let tower = operatorData.find(t =>
        (parseInt(t.LAC || t.lac) === lac) && (parseInt(t.CELLID || t.cellid) === cellid)
    );
    if (!tower) tower = operatorData.find(t =>
        parseInt(t.CELLID || t.cellid) === cellid
    );
    if (!tower) {
        document.getElementById('tl-address').textContent = '⚠️ Cell not found in database';
        return;
    }

    const lat = parseFloat(tower.LATITUDE || tower.lat);
    const lon = parseFloat(tower.LONGITUDE || tower.lon);
    const direction = tower.Direction || tower.direction || 0;
    const network = record.network || tower.Network || tower.network || '4G';

    // Color by network type
    const networkColors = { '2G': '#FF6B6B', '3G': '#FFD93D', '4G': '#6BCB77' };
    const color = networkColors[network] || '#6BCB77';

    const radius = defaultSettings[network] ? defaultSettings[network].radius * 1000 : 500;
    const beamWidth = defaultSettings[network] ? defaultSettings[network].beamWidth : 120;
    const points = calculateCoveragePoints(lat, lon, radius, direction, beamWidth);

    // Remove previous step layer (keep path)
    if (timelineLayers.length > 0) {
        const last = timelineLayers[timelineLayers.length - 1];
        // Fade previous sector to semi-transparent
        last.eachLayer(l => {
            if (l.setStyle) l.setStyle({ fillOpacity: 0.08, opacity: 0.2 });
        });
    }

    const sectorLayer = L.featureGroup([
        L.polygon(points, { color, fillColor: color, fillOpacity: 0.35, weight: 2 }),
        L.circleMarker([lat, lon], { radius: 6, color: 'white', fillColor: color, fillOpacity: 1, weight: 2 }),
    ]).addTo(map);

    sectorLayer.bindPopup(`
        <b>${record.time}</b><br>
        📡 ${record.operator.toUpperCase()} ${network}<br>
        LAC: ${record.lac} | Cell: ${record.cellid}<br>
        📞 ${record.usage} ${record.duration ? '(' + record.duration + 's)' : ''}<br>
        ${record.address ? '📍 ' + record.address.substring(0, 60) + '...' : ''}
    `);

    timelineLayers.push(sectorLayer);

    // Update moving marker
    if (timelineMarker) map.removeLayer(timelineMarker);
    timelineMarker = L.circleMarker([lat, lon], {
        radius: 10, color: 'white', fillColor: '#FF4500',
        fillOpacity: 1, weight: 3
    }).addTo(map).bindPopup(`📍 Current: ${record.time}`);

    // Draw path line through all visited points so far
    if (timelinePath) map.removeLayer(timelinePath);
    const pathCoords = [];
    for (let i = 0; i <= index; i++) {
        const r = timelineData[i];
        const op = cellTowerData[r.operator];
        if (!op) continue;
        const lac2 = parseInt(r.lac), cid2 = parseInt(r.cellid);
        const t = op.find(x => (parseInt(x.LAC || x.lac) === lac2) && (parseInt(x.CELLID || x.cellid) === cid2))
               || op.find(x => parseInt(x.CELLID || x.cellid) === cid2);
        if (t) pathCoords.push([parseFloat(t.LATITUDE || t.lat), parseFloat(t.LONGITUDE || t.lon)]);
    }
    if (pathCoords.length > 1) {
        timelinePath = L.polyline(pathCoords, {
            color: '#FF4500', weight: 2, opacity: 0.7, dashArray: '6,4'
        }).addTo(map);
    }

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
    renderTimelineStep(timelineIndex);
}

function clearTimeline() {
    timelinePause();
    clearTimelineLayers();
    timelineData = [];
    timelineIndex = 0;
    document.getElementById('timeline-status').textContent = 'No file loaded';
    document.getElementById('timeline-controls').style.display = 'none';
    document.getElementById('tl-time').textContent = '-';
    document.getElementById('tl-operator').textContent = '-';
    document.getElementById('tl-network').textContent = '-';
    document.getElementById('tl-lac').textContent = '-';
    document.getElementById('tl-cell').textContent = '-';
    document.getElementById('tl-usage').textContent = '-';
    document.getElementById('tl-duration').textContent = '-';
    document.getElementById('tl-address').textContent = '-';
    document.getElementById('cdr-file-input').value = '';
}

// Initialize when document is loaded
window.addEventListener('load', () => {
    initMap();
    updateOperatorDisclaimer();
    loadOperatorData('grameenphone');
    showCookieNotice();
});
