/**
 * main.js - Global UI Interactions
 * Unobfuscated version
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Navbar Sticky & Scroll Spy
    const navbar = document.querySelector('.navbar');
    const navLinks = document.querySelectorAll('.nav-link');

    const handleScroll = () => {
        // Sticky Navbar
        if (window.scrollY > 50) {
            navbar.classList.add('sticky');
        } else {
            navbar.classList.remove('sticky');
        }

        // Scroll Spy (Active Link)
        let current = '';
        const sections = document.querySelectorAll('section[id]');
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (window.scrollY >= (sectionTop - 150)) {
                current = '#' + section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === current) {
                link.classList.add('active');
            }
        });
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial call

    // 2. Smooth Scrolling for Anchors
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // 3. Accordion Logic
    const accordionToggles = document.querySelectorAll('[data-accordion-target]');
    accordionToggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const targetId = toggle.getAttribute('data-accordion-target');
            const target = document.querySelector(targetId);
            const icon = toggle.querySelector('svg');

            if (target) {
                const isExpanded = !target.classList.contains('hidden');

                // Close other accordions could be added here if desired.

                // Toggle current
                if (isExpanded) {
                    target.classList.add('hidden');
                    if (icon) icon.classList.remove('-rotate-180');
                } else {
                    target.classList.remove('hidden');
                    if (icon) icon.classList.add('-rotate-180');
                }
            }
        });
    });

    // 4. WhatsApp Popup logic
    const waPopup = document.getElementById('whatsapp-popup');
    const waClose = document.getElementById('wa-close');

    if (waPopup) {
        // Show after 3 seconds if not already closed in this session
        if (sessionStorage.getItem('wa-popup-dismissed') !== 'true') {
            setTimeout(() => {
                waPopup.style.display = 'block';
            }, 3000);
        }

        if (waClose) {
            waClose.addEventListener('click', (e) => {
                e.preventDefault();
                waPopup.style.display = 'none';
                sessionStorage.setItem('wa-popup-dismissed', 'true');
            });
        }
    }
});