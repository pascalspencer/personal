
export function initDisclaimer() {
    const bubble = document.getElementById('disclaimer-bubble');
    const modal = document.getElementById('disclaimer-modal');
    const closeBtn = document.getElementById('disclaimer-close');

    if (bubble && modal && closeBtn) {
        bubble.addEventListener('click', () => {
            modal.style.display = 'block';
            bubble.style.display = 'none'; // Optional: hide bubble when modal is open
        });

        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            bubble.style.display = 'flex'; // Show bubble again
        });

        // Close modal when clicking outside of the content
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
                bubble.style.display = 'flex';
            }
        });
    } else {
        console.warn('Disclaimer elements not found in DOM');
    }
}

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initDisclaimer);
