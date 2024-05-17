// Function to get current year and display it
function getYear() {
    var currentDate = new Date();
    var currentYear = currentDate.getFullYear();
    document.querySelector('#displayYear').innerHTML = currentYear;
}

// Function to initialize Google Map
function myMap() {
    var mapOptions = {
        center: new google.maps.LatLng(40.712775, -74.005973),
        zoom: 12
    };
    var map = new google.maps.Map(document.getElementById('googleMap'), mapOptions);
}

// Function to handle login form submission
function handleLogin() {
    var username = document.getElementById('username').value;
    var password = document.getElementById('password').value;

    if (username.trim() === '' || password.trim() === '') {
        alert('Please enter both username and password.');
        return;
    }

    var app_id = '61696';
    var loginUrl = 'https://oauth.deriv.com/oauth2/authorize?app_id=' + app_id;

    window.location.href = loginUrl;
}

// Function to render a template
function renderTemplate() {
    fetch('/sign-in')
        .then(response => response.text())
        .then(html => {
            // Redirect to the sign-in page
            window.location.href = '/sign-in';
        })
}

// Event listener for when DOM content is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize functions that need to run on page load
    getYear(); // Display current year
    myMap(); // Initialize Google Map

    // Initialize Owl Carousel for client carousel
    $('.client_owl-carousel').owlCarousel({
        loop: true,
        margin: 20,
        dots: false,
        nav: true,
        navText: ['<i class="fa fa-angle-left" aria-hidden="true"></i>', '<i class="fa fa-angle-right" aria-hidden="true"></i>'],
        autoplay: true,
        autoplayHoverPause: true,
        responsive: {
            0: {
                items: 1
            },
            600: {
                items: 2
            },
            1000: {
                items: 2
            }
        }
    });

    // Event listener for login form submission
    document.getElementById('login-form').addEventListener('submit', function(event) {
        event.preventDefault(); // Prevent default form submission
    });

    // Event listener for rendering a template
    document.getElementById('renderedContent').addEventListener('click', function(event) {
        event.preventDefault(); // Prevent default link behavior
    });
});
