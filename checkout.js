let stripe, elements, cardElement;
let orderTotal = 0;

document.addEventListener('DOMContentLoaded', function() {
    // Load cart items and render order summary
    loadCartItems();
    
    // Initialize payment method selection
    initPaymentMethodSelection();
    
    // Initialize Stripe
    initStripe();
    
    // Handle form submission
    const form = document.getElementById('payment-form');
    form.addEventListener('submit', handlePayment);
});

// Load cart items from localStorage
function loadCartItems() {
    const cart = getCart();
    const cartContent = document.getElementById('cartContent');
    
    if (cart.length === 0) {
        // Show empty cart message
        cartContent.innerHTML = `
            <div class="empty-cart-message">
                <i class="fas fa-shopping-cart"></i>
                <h2>Your cart is empty</h2>
                <p>Looks like you haven't added any items to your cart yet.</p>
                <a href="marketplace.html" class="submit-button">
                    <i class="fas fa-store"></i> Continue Shopping
                </a>
            </div>
        `;
        
        // Hide payment section
        document.querySelector('.payment-section').style.display = 'none';
        return;
    }
    
    // Render cart items
    let cartItemsHTML = '<div class="cart-items">';
    let subtotal = 0;
    
    cart.forEach(item => {
        const itemPrice = parseFloat(item.price);
        subtotal += itemPrice;
        
        cartItemsHTML += `
            <div class="cart-item">
                <img class="cart-item-img" src="${item.img}" alt="${item.title}">
                <div class="cart-item-details">
                    <div class="cart-item-title">${item.title}</div>
                    <div class="cart-item-category">${item.category}</div>
                </div>
                <div class="cart-item-price">$${itemPrice.toFixed(2)}</div>
            </div>
        `;
    });
    
    cartItemsHTML += '</div>';
    
    // Calculate order totals
    const tax = subtotal * 0.08; // 8% tax
    const shipping = subtotal > 100 ? 0 : 10; // Free shipping for orders over $100
    orderTotal = subtotal + tax + shipping;
    
    // Add order totals
    cartItemsHTML += `
        <div class="order-totals">
            <div class="order-total-row">
                <span>Subtotal:</span>
                <span>$${subtotal.toFixed(2)}</span>
            </div>
            <div class="order-total-row">
                <span>Tax (8%):</span>
                <span>$${tax.toFixed(2)}</span>
            </div>
            <div class="order-total-row">
                <span>Shipping:</span>
                <span>${shipping === 0 ? 'Free' : '$' + shipping.toFixed(2)}</span>
            </div>
            <div class="order-total-row final">
                <span>Total:</span>
                <span>$${orderTotal.toFixed(2)}</span>
            </div>
        </div>
    `;
    
    cartContent.innerHTML = cartItemsHTML;
    
    // Add hidden input for amount
    const amountInput = document.createElement('input');
    amountInput.type = 'hidden';
    amountInput.id = 'amount';
    amountInput.name = 'amount';
    amountInput.value = orderTotal.toFixed(2);
    document.getElementById('payment-form').appendChild(amountInput);
}

// Get cart from localStorage
function getCart() {
    return JSON.parse(localStorage.getItem('cart') || '[]');
}

// Initialize payment method selection
function initPaymentMethodSelection() {
    const paymentMethods = document.querySelectorAll('.payment-method');
    const paymentFields = document.querySelectorAll('.payment-fields');
    const paymentMethodInput = document.getElementById('payment-method');
    
    paymentMethods.forEach(method => {
        method.addEventListener('click', function() {
            // Remove selected class from all methods
            paymentMethods.forEach(m => m.classList.remove('selected'));
            
            // Add selected class to clicked method
            this.classList.add('selected');
            
            // Hide all payment fields
            paymentFields.forEach(field => field.classList.remove('active'));
            
            // Show selected payment fields
            const methodType = this.getAttribute('data-method');
            document.getElementById(`${methodType}-fields`).classList.add('active');
            
            // Update hidden input
            paymentMethodInput.value = methodType;
        });
    });
    
    // Select credit card by default
    paymentMethods[0].click();
}

// Initialize Stripe
function initStripe() {
    stripe = Stripe('pk_test_51RabJrPQCFOFR0ZauXnJzaS7wyfORWywakMHascd64QO8rkHGQQjjqN71jVZq7BC5fYyGy6JznP0DrLYOQtzMJnq00Uim1IYxf');
    elements = stripe.elements();
    cardElement = elements.create('card', {
        style: {
            base: {
                fontSize: '16px',
                color: '#32325d',
                fontFamily: 'Arial, sans-serif',
                '::placeholder': {
                    color: '#aab7c4'
                }
            },
            invalid: {
                color: '#fa755a',
                iconColor: '#fa755a'
            }
        }
    });
    cardElement.mount('#card-element');
}

// Handle form submission
async function handlePayment(event) {
    event.preventDefault();
    
    const submitButton = document.querySelector('.submit-button');
    submitButton.disabled = true;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    // Clear previous error messages
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(el => {
        el.textContent = '';
        el.style.display = 'none';
    });

    try {
        const paymentMethod = document.getElementById('payment-method').value;
        const amount = document.getElementById('amount').value;

        if (paymentMethod === 'credit-card') {
            // Create payment intent
            const response = await fetch('http://localhost:3003/create-payment-intent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount: parseFloat(amount),
                    currency: 'usd'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create payment intent');
            }

            const { clientSecret, id } = await response.json();

            // Confirm card payment
            const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: cardElement,
                    billing_details: {
                        name: document.getElementById('name').value,
                        email: document.getElementById('email').value,
                        phone: document.getElementById('phone').value
                    }
                }
            });

            if (error) {
                throw new Error(error.message);
            }

            // Confirm payment on server
            const confirmResponse = await fetch('http://localhost:3003/confirm-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    paymentIntentId: id
                })
            });

            const confirmResult = await confirmResponse.json();

            if (confirmResult.success) {
                showSuccessMessage();
                // Clear cart after successful payment
                localStorage.removeItem('cart');
            } else {
                throw new Error('Payment verification failed');
            }
        } else if (paymentMethod === 'paypal') {
            // Redirect to PayPal
            alert('You will be redirected to PayPal to complete your payment.');
            // Implement PayPal redirect logic here
            setTimeout(() => {
                showSuccessMessage();
                localStorage.removeItem('cart');
            }, 2000);
        } else if (paymentMethod === 'bank-transfer') {
            // Process bank transfer
            const accountNumber = document.getElementById('account-number').value;
            const routingNumber = document.getElementById('routing-number').value;
            
            if (!accountNumber || !routingNumber) {
                throw new Error('Please provide valid bank account information');
            }
            
            // Simulate bank transfer processing
            setTimeout(() => {
                showSuccessMessage();
                localStorage.removeItem('cart');
            }, 2000);
        } else if (paymentMethod === 'crypto') {
            // Process crypto payment
            const cryptoWallet = document.getElementById('crypto-wallet').value;
            
            if (!cryptoWallet) {
                throw new Error('Please provide a valid crypto wallet address');
            }
            
            // Simulate crypto payment processing
            setTimeout(() => {
                showSuccessMessage();
                localStorage.removeItem('cart');
            }, 2000);
        }
    } catch (error) {
        console.error('Payment error:', error);
        
        // Provide more user-friendly error messages
        let errorMessage = error.message;
        if (errorMessage.includes('card was declined')) {
            errorMessage = 'Your card was declined. Please check your card details or try another payment method.';
        } else if (errorMessage.includes('expired')) {
            errorMessage = 'Your card has expired. Please use a different card.';
        } else if (errorMessage.includes('insufficient funds')) {
            errorMessage = 'Your card has insufficient funds. Please use a different payment method.';
        } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network error')) {
            errorMessage = 'Network error. Please check your internet connection and try again.';
        }
        
        showErrorMessage(errorMessage);
        submitButton.disabled = false;
        submitButton.innerHTML = '<i class="fas fa-lock"></i> Complete Payment';
    }
}

function showSuccessMessage() {
    const checkoutContainer = document.getElementById('checkoutContainer');
    checkoutContainer.innerHTML = `
        <div class="success-message">
            <i class="fas fa-check-circle"></i>
            <h2>Payment Successful!</h2>
            <p>Your transaction has been processed successfully.</p>
            <p>A confirmation email has been sent to your email address.</p>
            <p>Order #: ${generateOrderNumber()}</p>
            <a href="marketplace.html" class="submit-button" style="display:inline-block;margin-top:20px;">
                <i class="fas fa-store"></i> Continue Shopping
            </a>
        </div>
    `;
}

function showErrorMessage(message) {
    // Get the selected payment method
    const paymentMethod = document.getElementById('payment-method').value;
    
    // Find the appropriate error element based on payment method
    let errorElement;
    
    if (paymentMethod === 'credit-card') {
        errorElement = document.getElementById('card-errors');
    } else if (paymentMethod === 'paypal') {
        errorElement = document.getElementById('paypal-errors');
    } else if (paymentMethod === 'bank-transfer') {
        errorElement = document.getElementById('bank-transfer-errors');
    } else if (paymentMethod === 'crypto') {
        errorElement = document.getElementById('crypto-errors');
    } else {
        // Fallback to card errors or create a general error element
        errorElement = document.getElementById('card-errors');
    }
    
    // Display the error message
    errorElement.textContent = message || 'An error occurred during payment processing.';
    errorElement.style.display = 'block';
    
    // Add error styling
    errorElement.style.color = '#721c24';
    errorElement.style.backgroundColor = '#f8d7da';
    errorElement.style.padding = '10px';
    errorElement.style.borderRadius = '4px';
    errorElement.style.marginTop = '10px';
    
    // Scroll to error message
    errorElement.scrollIntoView({ behavior: 'smooth' });
}

// Generate a random order number
function generateOrderNumber() {
    const timestamp = new Date().getTime().toString().slice(-6);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `HM-${timestamp}-${random}`;
}

// Load user data for checkout form fields
async function loadUserData() {
    try {
        // Check if user is logged in via localStorage first (preferred method)
        const user = getUserData();
        if (user) {
            // Populate form fields with user data from localStorage
            document.getElementById('name').value = `${user.firstName} ${user.lastName}`;
            document.getElementById('email').value = user.email;
            document.getElementById('phone').value = user.phone || '';
            return;
        }
        
        // Fallback: Check if token exists and fetch from API
        const token = localStorage.getItem('token');
        if (!token) {
            return;
        }
        
        // Fetch user data from API
        const response = await fetch('http://localhost:3003/api/user/profile', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch user data');
        }
        
        const userData = await response.json();
        
        // Populate form fields with user data
        document.getElementById('name').value = `${userData.firstName} ${userData.lastName}`;
        document.getElementById('email').value = userData.email;
        document.getElementById('phone').value = userData.phone || '';
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Call loadUserData on page load
document.addEventListener('DOMContentLoaded', loadUserData);