// Main initialization — runs on every page
document.addEventListener('DOMContentLoaded', () => {
    // Initialize all modules
    if (typeof initNav === 'function') initNav();
    if (typeof initAnimations === 'function') initAnimations();
    if (typeof initShop === 'function') initShop();
});

// Utility: Format price as dollars
function formatPrice(dollars) {
    return `$${dollars}`;
}

// Utility: Debounce function execution
function debounce(fn, delay = 50) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}
