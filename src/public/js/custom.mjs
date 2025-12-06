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
    // Ensure URL is ready
    if (document.readyState === "loading") {
        console.warn("DOM not ready yet, delaying token read...");
        return null;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const tokenQuery = urlParams.get("userToken");

    // token exists in URL
    if (tokenQuery) {
        localStorage.setItem("userToken", tokenQuery);
        console.log("Saved User Token from query:", tokenQuery);
        return tokenQuery;
    }

    // fallback to storage
    const storedToken = localStorage.getItem("userToken");
    if (storedToken) {
        console.log("Loaded User Token from storage:", storedToken);
        return storedToken;
    }

    console.warn("No Token available");
    return null;
}



export { getYear, myMap, getQueryParam, getCurrentLoginId };
