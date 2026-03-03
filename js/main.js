/**
 * MERCY 2026 - Main JavaScript
 * Handles interactions for the master page (index.html)
 */

document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initSmoothScroll();
    initAccordion();
    initWaPopup();
    renderPlaceholders();
});

// --- Navigation Toggle ---
function initNavbar() {
    const toggle = document.getElementById('navbarToggle');
    const menu = document.getElementById('navbarMenu');

    if (toggle && menu) {
        toggle.addEventListener('click', () => {
            menu.classList.toggle('active');
            const icon = toggle.querySelector('i');
            if (menu.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    }

    // Change navbar background on scroll
    window.addEventListener('scroll', () => {
        const navbar = document.querySelector('.navbar');
        if (window.scrollY > 50) {
            navbar.style.boxShadow = 'var(--shadow-md)';
            navbar.style.background = 'rgba(255, 255, 255, 0.98)';
        } else {
            navbar.style.boxShadow = 'var(--shadow-sm)';
            navbar.style.background = 'rgba(255, 255, 255, 0.95)';
        }
    });
}

// --- Smooth Scrolling ---
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                // Close mobile menu if open
                const menu = document.getElementById('navbarMenu');
                if (menu) menu.classList.remove('active');

                const headerOffset = 80;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });
            }
        });
    });
}

// --- FAQ Accordion ---
function initAccordion() {
    const accHeader = document.getElementsByClassName('accordion-header');

    for (let i = 0; i < accHeader.length; i++) {
        accHeader[i].addEventListener('click', function () {
            // Toggle current item
            this.parentNode.classList.toggle('active');
        });
    }
}

// --- WhatsApp Popup ---
function initWaPopup() {
    const modal = document.getElementById('waModal');
    const openBtn = document.getElementById('openWaPopup');
    const closeBtn = document.getElementById('closeWaModal');
    const form = document.getElementById('waForm');

    if (openBtn && modal) {
        openBtn.addEventListener('click', () => {
            modal.classList.add('active');
        });
    }

    if (closeBtn && modal) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

    // Close on click outside
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }

    if (form && modal) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const nameEl = document.getElementById('waName');
            const messageEl = document.getElementById('waMessage');
            if (!nameEl || !messageEl) return;

            const name = nameEl.value;
            const message = messageEl.value;
            const phoneNumber = '6287788836000';

            const text = `Hai Medi, nama aku ${name}, Aku mau tanya seputar Mercy dong... ${message}`;
            const encodedText = encodeURIComponent(text);
            const url = `https://wa.me/${phoneNumber}?text=${encodedText}`;

            window.open(url, '_blank');
            modal.classList.remove('active');
        });
    }
}

// --- Render Exclusive Discount Placeholders ---
function renderPlaceholders() {
    const productList = document.getElementById('productList');
    if (!productList) return;

    let productsHtml = '';

    for (let i = 1; i <= 10; i++) {
        const price = (Math.random() * 500 + 100).toFixed(0) + '.000';
        const oldPrice = (parseInt(price) + 50) + '.000';

        productsHtml += `
            <div class="card">
                <img src="https://placehold.co/400x400/1E3A8A/FFFFFF?text=Product+${i}" alt="Product ${i}" class="card-image">
                <h3 class="card-title">Medtools Bundle ${i}</h3>
                <p class="card-text">Paket lengkap alat medis berkualitas untuk mahasiswa kedokteran.</p>
                <div class="card-price">Rp ${price} <span class="card-price-old">Rp ${oldPrice}</span></div>
                <button class="btn btn-primary btn-sm mt-2" style="width: 100%;">Beli Sekarang</button>
            </div>
        `;
    }

    productList.innerHTML = productsHtml;
}
