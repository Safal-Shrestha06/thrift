// =====================================================================
// thrift.js — storefront: shows real products, tracks login state,
// and runs a working Add-to-Cart + Checkout flow.
// =====================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
	getFirestore, collection, onSnapshot, addDoc, setDoc, doc, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
	onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./auth.js";
import {
	ESEWA_CONFIG, newTransactionUuid, redirectToEsewa,
	decodeEsewaResponse, verifyEsewaResponse
} from "./esewa.js";

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
const adsCol = collection(db, "ads");

let allProducts = [];
let activeCategory = 'All';
let searchTerm = '';
let currentUser = null;

// ===================== Toast =====================

let toastTimer;
function showToast(msg, ms = 2200) {
	const toast = document.getElementById('toast');
	toast.textContent = msg;
	toast.classList.add('show');
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => toast.classList.remove('show'), ms);
}

// ===================== Product cards =====================

function productCardHTML(p) {
	const imageHTML = p.image
		? `<img src="${p.image}" alt="${p.item}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
		   <div style="display:none;width:100%;height:100%;background:linear-gradient(160deg,#fff1b5,#ffeb8a)"></div>`
		: `<div style="width:100%;height:100%;background:linear-gradient(160deg,#fff1b5,#ffeb8a)"></div>`;

	const outOfStock = p.status === 'out_of_stock';

	return `
		<div class="product-card" data-product-id="${p.id}">
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

// ===================== Product detail modal =====================

function openProductDetail(product) {
	const outOfStock = product.status === 'out_of_stock';

	document.getElementById('pdImage').style.backgroundImage = product.image ? `url('${product.image}')` : '';
	document.getElementById('pdCategory').textContent = product.category;
	document.getElementById('pdTitle').textContent = product.item;
	document.getElementById('pdPrice').textContent = `Rs ${Number(product.price).toLocaleString()}`;
	document.getElementById('pdCondition').textContent = product.condition || 'Good';
	document.getElementById('pdStock').textContent = outOfStock ? 'Out of stock' : 'In stock';
	document.getElementById('pdSeller').textContent = product.seller;
	document.getElementById('pdDescription').textContent = product.description || 'No description provided for this item yet.';

	const addBtn = document.getElementById('pdAddToCartBtn');
	addBtn.dataset.addToCart = product.id; // reuses the existing delegated Add to Cart handler
	addBtn.disabled = outOfStock;
	addBtn.textContent = outOfStock ? 'Out of Stock' : 'Add to Cart';

	document.getElementById('pdOverlay').classList.add('open');
}

function closeProductDetail() {
	document.getElementById('pdOverlay').classList.remove('open');
}

document.getElementById('pdCloseBtn').addEventListener('click', closeProductDetail);
document.getElementById('pdOverlay').addEventListener('click', e => {
	if (e.target.id === 'pdOverlay') closeProductDetail();
});

// Clicking anywhere on a card opens the detail modal — except the
// Add to Cart / favorite buttons, which keep their own behavior.
document.addEventListener('click', e => {
	if (e.target.closest('[data-add-to-cart]') || e.target.closest('.favorite-btn')) return;
	const card = e.target.closest('[data-product-id]');
	if (!card) return;
	const product = allProducts.find(p => p.id === card.dataset.productId);
	if (product) openProductDetail(product);
});

function render() {
	// Show live AND out-of-stock products (shoppers should see out-of-stock
	// items, just unable to buy them). Pending/flagged stay hidden until approved.
	const visibleProducts = allProducts.filter(p => p.status === 'live' || p.status === 'out_of_stock');

	const filtered = visibleProducts.filter(p =>
		(activeCategory === 'All' || p.category === activeCategory) &&
		p.item.toLowerCase().includes(searchTerm.toLowerCase())
	);

	document.getElementById('shopHeading').textContent = activeCategory === 'All' ? 'All Products' : activeCategory;

	const productsGrid = document.getElementById('productsGrid');
	productsGrid.innerHTML = filtered.length
		? filtered.map(productCardHTML).join('')
		: `<p style="color:var(--muted)">No items yet in this category.</p>`;
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

// ===================== Ads (admin-published hero banner + page banners) =====================

let allAds = [];

// Fills the hero image + discount stat from an active "hero" placement
// ad, or falls back to the original hardcoded look when there isn't one.
function applyHeroAd(ad) {
	const wrap = document.getElementById('heroGraphicWrap');
	if (ad && ad.image) {
		const tag = ad.link ? 'a' : 'div';
		const linkAttrs = ad.link ? ` href="${ad.link}" target="_blank" rel="noopener"` : '';
		// No cream wash on admin-published images — that overlay was
		// tuned for the original soft placeholder photo and makes a
		// bold banner (like a red sale graphic) look faded.
		wrap.innerHTML = `<${tag} class="hero-graphic" id="heroGraphic"${linkAttrs} style="--hero-image:url('${ad.image}'); --hero-overlay: rgba(0,0,0,0)"></${tag}>`;
	} else {
		wrap.innerHTML = `<div class="hero-graphic" id="heroGraphic"></div>`;
	}
	document.getElementById('heroStatLabel').textContent = (ad && ad.statLabel) || 'Take Home Up to';
	document.getElementById('heroStatValue').textContent = (ad && ad.statValue) || '80%';
}

function renderAds() {
	const activeAds = allAds.filter(a => a.status === 'active');

	// Page-banner strip (#adsSection) — everything that isn't hero-placed.
	const bannerAds = activeAds.filter(a => a.placement !== 'hero');
	document.getElementById('adsSection').innerHTML = bannerAds.map(a => {
		const tag = a.link ? 'a' : 'div';
		const linkAttrs = a.link ? ` href="${a.link}" target="_blank" rel="noopener"` : '';
		return `<${tag} class="ads-banner-item" style="background-image:url('${a.image}')"${linkAttrs}><span>${a.title}</span></${tag}>`;
	}).join('');

	// Hero banner — if more than one active hero ad exists, the most
	// recently created one wins.
	const heroAds = activeAds
		.filter(a => a.placement === 'hero')
		.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
	applyHeroAd(heroAds[0] || null);
}

onSnapshot(adsCol, snapshot => {
	allAds = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
	renderAds();
}, err => console.error('Firestore error (ads):', err));

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

const PENDING_ESEWA_KEY = 'thriftstore_pending_esewa';

function buyerFields() {
	return {
		buyer: currentUser.displayName || currentUser.email,
		buyerEmail: currentUser.email,
	};
}

function orderItems(cart) {
	return cart.map(i => ({ id: i.id, item: i.item, price: i.price, qty: i.qty }));
}

// Saves what the customer is paying for, then sends them to eSewa.
// The order itself is only created once eSewa reports a verified,
// completed payment (see handleEsewaReturn below).
async function startEsewaCheckout(cart) {
	if (!/^https?:$/.test(location.protocol)) {
		const err = new Error('not served over http');
		err.userMessage = 'eSewa needs the site opened via http://localhost or https:// (not a file).';
		throw err;
	}
	const uuid = newTransactionUuid();
	const amount = cartTotal(cart);
	localStorage.setItem(PENDING_ESEWA_KEY, JSON.stringify({
		uuid, uid: currentUser.uid, amount, items: orderItems(cart), startedAt: Date.now(),
	}));
	// eSewa appends ?data=... to these, so keep them free of query strings
	const pageUrl = location.origin + location.pathname;
	await redirectToEsewa({ amount, transactionUuid: uuid, successUrl: pageUrl, failureUrl: pageUrl });
}

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

	const method = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'cod';
	const btn = document.getElementById('checkoutBtn');
	btn.disabled = true;
	btn.textContent = method === 'esewa' ? 'Redirecting to eSewa…' : 'Placing order…';

	try {
		if (method === 'esewa') {
			await startEsewaCheckout(cart); // navigates away to eSewa
			return;
		}

		// Cash on delivery: order waits for admin confirmation, payment on delivery
		await addDoc(ordersCol, {
			...buyerFields(),
			items: orderItems(cart),
			amount: cartTotal(cart),
			status: 'pending',
			paymentMethod: 'cod',
			paymentStatus: 'unpaid',
			createdAt: new Date().toISOString(),
		});

		saveCart([]);
		closeCart();
		showToast('Order submitted. Waiting for admin confirmation.');
		openOrders();
	} catch (err) {
		console.error(err);
		showToast(err.userMessage || 'Something went wrong placing your order', 4000);
	} finally {
		btn.disabled = false;
		btn.textContent = 'Checkout';
	}
});

// ---- Coming back from eSewa ----
// success_url?data=<base64 JSON>. We trust it only after the HMAC
// signature checks out AND it matches the order we started.
let esewaReturnHandled = false;

async function handleEsewaReturn(user) {
	if (esewaReturnHandled) return;

	const dataParam = new URLSearchParams(location.search).get('data');
	const pendingRaw = localStorage.getItem(PENDING_ESEWA_KEY);

	if (!dataParam) {
		// Back from eSewa with no payment data = cancelled / failed
		if (pendingRaw && document.referrer.includes('esewa.com.np')) {
			esewaReturnHandled = true;
			localStorage.removeItem(PENDING_ESEWA_KEY);
			showToast('eSewa payment was not completed. Your cart is still saved.', 5000);
		}
		return;
	}

	if (!user) {
		showToast('Please log in again to finish your eSewa order', 4000);
		return; // auth state may fire again once restored
	}

	esewaReturnHandled = true;
	history.replaceState(null, '', location.pathname); // a refresh can't replay the payment

	const resp = decodeEsewaResponse(dataParam);
	if (!resp || !(await verifyEsewaResponse(resp))) {
		showToast('Payment could not be verified. You have not been charged for an order.', 6000);
		return;
	}
	if (resp.status !== 'COMPLETE') {
		showToast(`eSewa payment status: ${resp.status}. Order not placed.`, 6000);
		return;
	}

	let pending = null;
	try { pending = JSON.parse(pendingRaw); } catch { /* handled below */ }
	const paidTotal = Number(String(resp.total_amount).replace(/,/g, ''));
	const matches = pending
		&& pending.uuid === resp.transaction_uuid
		&& pending.uid === user.uid
		&& resp.product_code === ESEWA_CONFIG.productCode
		&& paidTotal === Number(pending.amount);
	if (!matches) {
		showToast(`Payment didn't match a saved order. Keep eSewa ref ${resp.transaction_code || ''} and contact us.`, 8000);
		return;
	}

	try {
		// Order id = eSewa transaction uuid, so the same payment can never create two orders
		await setDoc(doc(db, 'orders', pending.uuid), {
			...buyerFields(),
			items: pending.items,
			amount: pending.amount,
			status: 'pending', // admin still confirms the order
			paymentMethod: 'esewa',
			paymentStatus: 'paid',
			esewaTransactionCode: resp.transaction_code || '',
			esewaResponse: resp, // kept so the admin panel can re-verify the signature
			createdAt: new Date().toISOString(),
		});
		localStorage.removeItem(PENDING_ESEWA_KEY);
		saveCart([]);
		closeCart();
		showToast('Payment received via eSewa. Waiting for admin confirmation.', 5000);
		openOrders();
	} catch (err) {
		console.error(err);
		showToast(`Paid, but the order could not be saved. Keep eSewa ref ${resp.transaction_code || ''} and contact us.`, 8000);
	}
}

// ===================== My Orders (customer order tracking) =====================
// Read-only for the customer — only Admin can change an order's status
// (enforced by Firestore rules, not just this UI).

const ORDER_STATUS_LABELS = {
	pending: 'Pending — Waiting for admin confirmation',
	confirmed: 'Confirmed ✓',
	processing: 'Processing',
	shipped: 'Shipped',
	completed: 'Completed',
	cancelled: 'Cancelled',
};

let myOrders = [];
let unsubscribeMyOrders = null;

function renderMyOrders() {
	const listEl = document.getElementById('myOrdersList');
	if (!listEl) return;

	if (!currentUser) {
		listEl.innerHTML = `<p style="color:var(--muted)">Log in to see your orders.</p>`;
		return;
	}

	listEl.innerHTML = myOrders.length
		? myOrders.map(o => {
			const itemsSummary = (o.items || []).map(i => `${i.item} ×${i.qty}`).join(', ');
			const statusText = ORDER_STATUS_LABELS[o.status] || o.status;
			const paymentText = o.paymentMethod === 'esewa'
				? (o.paymentStatus === 'paid' ? 'Paid via eSewa' : 'eSewa — payment pending')
				: (o.paymentMethod === 'cod' ? 'Cash on delivery' : '');
			return `
				<div class="cart-item">
					<div class="cart-item-info" style="flex:1">
						<h4>Order #${o.id.slice(0, 8)}</h4>
						<span>${itemsSummary}</span>
						<div style="margin-top:6px; font-weight:600">Rs ${Number(o.amount || 0).toLocaleString()}</div>
						<div style="margin-top:4px; font-size:0.85rem; color:var(--muted)">${statusText}</div>
						${paymentText ? `<div style="margin-top:2px; font-size:0.85rem; color:var(--muted)">${paymentText}</div>` : ''}
					</div>
				</div>
			`;
		}).join('')
		: `<p style="color:var(--muted)">You haven't placed any orders yet.</p>`;
}

function subscribeToMyOrders(user) {
	if (unsubscribeMyOrders) {
		unsubscribeMyOrders();
		unsubscribeMyOrders = null;
	}
	if (!user) {
		myOrders = [];
		renderMyOrders();
		return;
	}
	const myOrdersQuery = query(ordersCol, where('buyerEmail', '==', user.email));
	unsubscribeMyOrders = onSnapshot(myOrdersQuery, snapshot => {
		myOrders = snapshot.docs
			.map(d => ({ id: d.id, ...d.data() }))
			.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
		renderMyOrders();
	}, err => console.error('Firestore error (my orders):', err));
}

function openOrders() {
	if (!currentUser) {
		showToast('Please log in to view your orders');
		window.location.href = 'login.html';
		return;
	}
	document.getElementById('ordersOverlay').classList.add('open');
}
function closeOrders() {
	document.getElementById('ordersOverlay').classList.remove('open');
}

document.getElementById('ordersToggleBtn').addEventListener('click', openOrders);
document.getElementById('ordersCloseBtn').addEventListener('click', closeOrders);
document.getElementById('ordersOverlay').addEventListener('click', e => {
	if (e.target.id === 'ordersOverlay') closeOrders();
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
	subscribeToMyOrders(user); // switch to this account's own orders
	handleEsewaReturn(user); // finish an eSewa payment if we just came back from it
});

// ===================== Init =====================

renderCart();
