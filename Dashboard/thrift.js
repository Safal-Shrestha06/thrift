// =====================================================================
// thrift.js — storefront: shows real products, tracks login state,
// and runs a working Add-to-Cart + Checkout flow.
// =====================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
	getFirestore, collection, onSnapshot, addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
	onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./auth.js";

const firebaseConfig = {
	apiKey: "AIzaSyC8P6Ws_QBB3cXmdPjTQx1jGVqD8PYCYOw",
	authDomain: "thriftstore01.firebaseapp.com",
	projectId: "thriftstore01",
	storageBucket: "thriftstore01.firebasestorage.app",
	messagingSenderId: "904619736486",
	appId: "1:904619736486:web:d153c192f51a168e09a367",
	measurementId: "G-K2XFJ7V9WF"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const productsCol = collection(db, "products");
const ordersCol = collection(db, "orders");

let allProducts = [];
let activeCategory = 'Men';
let searchTerm = '';
let currentUser = null;

// ===================== Toast =====================

let toastTimer;
function showToast(msg) {
	const toast = document.getElementById('toast');
	toast.textContent = msg;
	toast.classList.add('show');
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ===================== Product cards =====================

function productCardHTML(p) {
	const imageHTML = p.image
		? `<img src="${p.image}" alt="${p.item}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
		   <div style="display:none;width:100%;height:100%;background:linear-gradient(160deg,#fff1b5,#ffeb8a)"></div>`
		: `<div style="width:100%;height:100%;background:linear-gradient(160deg,#fff1b5,#ffeb8a)"></div>`;

	const outOfStock = p.status === 'out_of_stock';

	return `
		<div class="product-card">
			<div class="product-image">
				${imageHTML}
				<button class="favorite-btn" aria-label="Save item">♡</button>
				${outOfStock ? `<span class="out-of-stock-badge">Out of Stock</span>` : ''}
			</div>
			<div class="product-details">
				<h3>${p.item}</h3>
				<p>${p.category} · sold by ${p.seller}</p>
				<div class="product-meta">
					<span>Rs ${Number(p.price).toLocaleString()}</span>
					<span>${outOfStock ? 'Out of stock' : 'In stock'}</span>
				</div>
				<button class="add-cart-btn" data-add-to-cart="${p.id}" ${outOfStock ? 'disabled' : ''}>
					${outOfStock ? 'Out of Stock' : 'Add to Cart'}
				</button>
			</div>
		</div>
	`;
}

function render() {
	// Show live AND out-of-stock products (shoppers should see out-of-stock
	// items, just unable to buy them). Pending/flagged stay hidden until approved.
	const visibleProducts = allProducts.filter(p => p.status === 'live' || p.status === 'out_of_stock');

	const newArrivals = visibleProducts.filter(p =>
		p.category === activeCategory &&
		p.item.toLowerCase().includes(searchTerm.toLowerCase())
	);

	const kurthaItems = visibleProducts.filter(p => p.category === 'More');

	const newArrivalsTrack = document.getElementById('newArrivalsTrack');
	const kurthaTrack = document.getElementById('kurthaTrack');

	newArrivalsTrack.innerHTML = newArrivals.length
		? newArrivals.map(productCardHTML).join('')
		: `<p style="color:var(--muted)">No items yet in this category.</p>`;

	kurthaTrack.innerHTML = kurthaItems.length
		? kurthaItems.map(productCardHTML).join('')
		: `<p style="color:var(--muted)">No items yet.</p>`;
}

document.querySelectorAll('.category-card').forEach(card => {
	card.addEventListener('click', e => {
		e.preventDefault();
		document.querySelectorAll('.category-card').forEach(c => c.classList.remove('active'));
		card.classList.add('active');
		activeCategory = card.textContent.trim();
		render();
	});
});

const searchInput = document.getElementById('searchInput');
if (searchInput) {
	searchInput.addEventListener('input', e => {
		searchTerm = e.target.value;
		render();
	});
}

// Event delegation: catches clicks on any "Add to Cart" button,
// even ones that get re-rendered later.
document.addEventListener('click', e => {
	const btn = e.target.closest('[data-add-to-cart]');
	if (!btn) return;
	const productId = btn.dataset.addToCart;
	const product = allProducts.find(p => p.id === productId);
	if (product) addToCart(product);
});

onSnapshot(productsCol, snapshot => {
	allProducts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
	render();
}, err => console.error('Firestore error:', err));

// ===================== Cart (saved in localStorage) =====================
// The cart lives in the browser (localStorage) rather than Firestore —
// it's personal/temporary data that doesn't need to sync across devices
// for a project like this, and it works even before logging in.

// Each account gets its OWN cart, so if two people share a computer/browser
// they don't see each other's items. Logged-out visitors get a separate
// "guest" cart that's kept until they log in.
function cartKey() {
	return currentUser ? `thriftstore_cart_${currentUser.uid}` : 'thriftstore_cart_guest';
}

function loadCart() {
	try {
		return JSON.parse(localStorage.getItem(cartKey())) || [];
	} catch {
		return [];
	}
}

function saveCart(cart) {
	localStorage.setItem(cartKey(), JSON.stringify(cart));
	renderCart();
}

function addToCart(product) {
	const cart = loadCart();
	const existing = cart.find(item => item.id === product.id);
	if (existing) {
		existing.qty += 1;
	} else {
		cart.push({
			id: product.id,
			item: product.item,
			price: product.price,
			image: product.image || '',
			qty: 1,
		});
	}
	saveCart(cart);
	showToast(`Added "${product.item}" to cart`);
	openCart();
}

function changeQty(id, delta) {
	let cart = loadCart();
	const entry = cart.find(item => item.id === id);
	if (!entry) return;
	entry.qty += delta;
	if (entry.qty <= 0) cart = cart.filter(item => item.id !== id);
	saveCart(cart);
}

function removeFromCart(id) {
	const cart = loadCart().filter(item => item.id !== id);
	saveCart(cart);
}

function cartTotal(cart) {
	return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function renderCart() {
	const cart = loadCart();
	const count = cart.reduce((sum, item) => sum + item.qty, 0);
	document.getElementById('cartCount').textContent = count;

	const itemsEl = document.getElementById('cartItems');
	itemsEl.innerHTML = cart.length
		? cart.map(item => `
			<div class="cart-item">
				<div class="cart-item-thumb" style="${item.image ? `background:url('${item.image}') center/cover` : ''}"></div>
				<div class="cart-item-info">
					<h4>${item.item}</h4>
					<span>Rs ${item.price.toLocaleString()} each</span>
				</div>
				<div class="cart-item-controls">
					<button class="cart-qty-btn" data-qty="-1" data-id="${item.id}">−</button>
					<span>${item.qty}</span>
					<button class="cart-qty-btn" data-qty="1" data-id="${item.id}">+</button>
					<button class="cart-remove-btn" data-remove="${item.id}">Remove</button>
				</div>
			</div>
		`).join('')
		: `<p style="color:var(--muted)">Your cart is empty.</p>`;

	document.getElementById('cartTotal').textContent = 'Rs ' + cartTotal(cart).toLocaleString();
}

document.getElementById('cartItems').addEventListener('click', e => {
	const qtyBtn = e.target.closest('[data-qty]');
	if (qtyBtn) changeQty(qtyBtn.dataset.id, Number(qtyBtn.dataset.qty));

	const removeBtn = e.target.closest('[data-remove]');
	if (removeBtn) removeFromCart(removeBtn.dataset.remove);
});

function openCart() {
	document.getElementById('cartOverlay').classList.add('open');
}
function closeCart() {
	document.getElementById('cartOverlay').classList.remove('open');
}

document.getElementById('cartToggleBtn').addEventListener('click', openCart);
document.getElementById('cartCloseBtn').addEventListener('click', closeCart);
document.getElementById('cartOverlay').addEventListener('click', e => {
	if (e.target.id === 'cartOverlay') closeCart();
});

// ===================== Checkout =====================

document.getElementById('checkoutBtn').addEventListener('click', async () => {
	const cart = loadCart();
	if (cart.length === 0) {
		showToast('Your cart is empty');
		return;
	}
	if (!currentUser) {
		showToast('Please log in to checkout');
		window.location.href = 'login.html';
		return;
	}

	const btn = document.getElementById('checkoutBtn');
	btn.disabled = true;
	btn.textContent = 'Placing order…';

	try {
		// One order per cart, saved to the same Firestore project your
		// admin panel reads from — an "orders" collection is a natural
		// next tab to wire up in admin.js.
		await addDoc(ordersCol, {
			buyer: currentUser.displayName || currentUser.email,
			buyerEmail: currentUser.email,
			items: cart.map(i => ({ id: i.id, item: i.item, price: i.price, qty: i.qty })),
			amount: cartTotal(cart),
			status: 'pending',
			createdAt: new Date().toISOString(),
		});

		saveCart([]);
		closeCart();
		showToast('Order placed! Thank you.');
	} catch (err) {
		console.error(err);
		showToast('Something went wrong placing your order');
	} finally {
		btn.disabled = false;
		btn.textContent = 'Checkout';
	}
});

// ===================== Auth state (Login / Sign Up vs logged-in chip) =====================

function updateHeader(user) {
	const container = document.getElementById('headerActions');
	if (user) {
		const name = user.displayName || user.email.split('@')[0];
		container.innerHTML = `
			<div class="user-chip">
				<span>Hi, ${name}</span>
				<button id="logoutBtn">Logout</button>
			</div>
		`;
		document.getElementById('logoutBtn').addEventListener('click', async () => {
			await signOut(auth);
			showToast('Logged out');
		});
	} else {
		container.innerHTML = `
			<a class="btn btn-outline" href="login.html">Login</a>
			<a class="btn btn-primary" href="signup.html">Sign Up</a>
		`;
	}
}

onAuthStateChanged(auth, user => {
	currentUser = user;
	updateHeader(user);
	renderCart(); // switch to this account's own cart (or the guest cart if logged out)
});

// ===================== Init =====================

renderCart();
