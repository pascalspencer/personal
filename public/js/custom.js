// Function definitions
function getYear() {
    var currentDate = new Date();
    var currentYear = currentDate.getFullYear();
    document.querySelector('#displayYear').innerHTML = currentYear;
}

function myMap() {
    var mapOptions = {
        center: new google.maps.LatLng(40.712775, -74.005973),
        zoom: 18
    };
    var map = new google.maps.Map(document.getElementById('googleMap'), mapOptions);
}

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

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Code to execute once DOM is fully loaded
    getYear();

    // Owl carousel initialization
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

    // Adding event listener to login form submit button
    document.getElementById('login-form').addEventListener('submit', function(event) {
        event.preventDefault(); // Prevent the form from submitting normally
        handleLogin(); // Call the handleLogin function defined above
    });
});
