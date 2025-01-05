// Global variables
let map;
let coverageLayers = [];
let userLocationMarker;
let cellTowerData = {};

const operatorDisclaimers = {
    grameenphone: "ফেব্রুয়ারি ২০২৩ পর্যন্ত শুধুমাত্র রাজশাহী জেলার তথ্য পাওয়া যাবে",
    robi: "এখনো কোনো ডাটা আপলোড করা হয়নি",
    airtel: "এখনো কোনো ডাটা আপলোড করা হয়নি",
    banglalink: "এখনো কোনো ডাটা আপলোড করা হয়নি",
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
    const baseUrl = 'https://sanrcs61.github.io/cell-coverage-map/';
    fetch(`${baseUrl}${operator}.json`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (!data || !Array.isArray(data)) {
                throw new Error('Invalid data format');
            }
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
    const originalColors = {
        '2G': '#FF0000',
        '3G': '#00FF00',
        '4G': '#0000FF'
    };
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
        L.polygon(points, {
            color: sectorColor,
            fillColor: sectorColor,
            fillOpacity: 0.3
        }),
        L.circleMarker([lat, lon], {
            radius: 5,
            color: 'black',
            fillColor: 'red',
            fillOpacity: 1
        }),
        L.polyline([[lat, lon], calculateDirectionEndPoint(lat, lon, radius, angle)], {
            color: 'red',
            weight: 2,
            dashArray: '5, 5'
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
        navigator.geolocation.getCurrentPosition(function(position) {
            const userLat = position.coords.latitude;
            const userLon = position.coords.longitude;
            
            if (userLocationMarker) {
                map.removeLayer(userLocationMarker);
            }
            
            userLocationMarker = L.marker([userLat, userLon], {
                icon: L.icon({
                    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                    shadowSize: [41, 41]
                })
            }).addTo(map);
            
            userLocationMarker.bindPopup("Your Location").openPopup();
            map.setView([userLat, userLon], 13);
        }, function(error) {
            console.error("Error getting user location:", error);
            alert("Unable to retrieve your location. Please check your browser settings.");
        });
    } else {
        alert("Geolocation is not supported by your browser.");
    }
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
        // Try to load the data again before giving up
        loadOperatorData(operator);
        alert('Please wait while we load the data and try again in a few seconds.');
        return;
    }

    const matchedTower = operatorData.find(tower => tower.LAC === lac && tower.CELLID === cellid);

    if (matchedTower) {
        document.getElementById('lat').value = matchedTower.LATITUDE;
        document.getElementById('lon').value = matchedTower.LONGITUDE;
        document.getElementById('network').value = matchedTower.Network;
        const direction = matchedTower.Direction || 0;
        document.getElementById('angle').value = direction;
        updateAngleDisplay(direction);
        updateColorFromDefault();
        generateCoverage();
    } else {
        alert(`No matching cell tower found for LAC: ${lac} and Cell ID: ${cellid}`);
    }
}

// Initialize when document is loaded
window.addEventListener('load', () => {
    initMap();
    updateOperatorDisclaimer();
    loadOperatorData('grameenphone');
});
