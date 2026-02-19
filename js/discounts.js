document.addEventListener('DOMContentLoaded', function () {
    const discountModal = document.getElementById('discountModal');
    const closeDiscountModal = document.getElementById('closeDiscountModal');
    const discountForm = document.getElementById('discountForm');
    const discountInfoText = document.getElementById('discountInfoText');
    const claimButtons = document.querySelectorAll('.claim-discount-btn');

    // Selected variables
    const selectedProductInput = document.getElementById('selectedProduct');
    const selectedDiscountInput = document.getElementById('selectedDiscount');
    const selectedTypeInput = document.getElementById('selectedType');

    // Open Modal
    claimButtons.forEach(button => {
        button.addEventListener('click', function () {
            const product = this.getAttribute('data-product');
            const discount = this.getAttribute('data-discount');
            const type = this.getAttribute('data-type'); // store or academy

            selectedProductInput.value = product;
            selectedDiscountInput.value = discount;
            selectedTypeInput.value = type;

            discountInfoText.textContent = `Kamu akan mengklaim diskon ${discount}% untuk ${product}`;
            discountModal.classList.add('active');
        });
    });

    // Close Modal
    closeDiscountModal.addEventListener('click', function () {
        discountModal.classList.remove('active');
    });

    // Close Modal on clicking outside
    window.addEventListener('click', function (event) {
        if (event.target === discountModal) {
            discountModal.classList.remove('active');
        }
    });

    // Handle Form Submit
    discountForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const name = document.getElementById('claimName').value;
        const product = selectedProductInput.value;
        const discount = selectedDiscountInput.value;
        const type = selectedTypeInput.value;

        let message = "";
        if (type === 'store') {
            message = `Hai Medi, nama aku ${name} aku mau order ${product} pakai discount mercy ${discount}%.`;
        } else {
            message = `Hai Medi, nama aku ${name} aku mau berlangganan ${product} pakai discount mercy ${discount}%.`;
        }

        const waNumber = "6287788836000";
        const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;

        window.open(waLink, '_blank');
        discountModal.classList.remove('active');
        discountForm.reset();
    });
});
