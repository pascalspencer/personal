// Function to get current year and display it
function getYear() {
    document.addEventListener("DOMContentLoaded", () => {
        const yearElement = document.querySelector('#displayYear');
        if (yearElement) {
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear();
            yearElement.innerHTML = currentYear;
        } else {
            console.warn("#displayYear element not found in DOM.");
        }
    });
}

// Function to initialize Google Map
function myMap() {
    document.addEventListener("DOMContentLoaded", () => {
        const mapContainer = document.getElementById('googleMap');
        if (mapContainer) {
            const mapOptions = {
                center: new google.maps.LatLng(40.712775, -74.005973),
                zoom: 12
            };
            new google.maps.Map(mapContainer, mapOptions);
        } else {
            console.warn("#googleMap element not found in DOM.");
        }
    });
}

// Function to get query parameters
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// Function to get current login ID from query params
function getCurrentLoginId() {
    const currentLoginId = getQueryParam("currentLoginId");
    console.log(currentLoginId);
    return currentLoginId;
}

export { getYear, myMap, getQueryParam, getCurrentLoginId };
