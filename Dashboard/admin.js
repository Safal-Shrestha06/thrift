// ===================== Firebase =====================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
	getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// ===================== Mock data (users / orders / activity stay local for now) =====================

const AVATAR_COLORS = ['#f8bb00', '#ffd873', '#f2a65a', '#e8c07d', '#f6dd8b'];
function avatarColor(seed) {
	// works for both numeric ids and Firestore string ids
	const num = typeof seed === 'string'
		? [...seed].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
		: seed;
	return AVATAR_COLORS[num % AVATAR_COLORS.length];
}
function initials(name) {
	return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function formatStatusLabel(status) {
	return (status || '').split('_').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
}

// listings and orders now come from Firestore in real time (see onSnapshot below)
let listings = [];
let orders = [];

const activity = [
	{ text: '<strong>Bikash Thapa</strong> submitted a new listing "Cotton Kurtha Set" for review', time: '12 minutes ago' },
	{ text: '<strong>Anisha Rai\'s</strong> listing "Leather Ankle Boots" was flagged by a buyer', time: '48 minutes ago' },
	{ text: '<strong>Kiran Gurung\'s</strong> account was suspended for policy violations', time: '2 hours ago' },
	{ text: '<strong>Prakriti Adhikari</strong> completed checkout for order TS-10234', time: '3 hours ago' },
	{ text: '<strong>Sujata Karki</strong> joined as a new seller', time: '5 hours ago' },
];

const weekSales = [
	{ day: 'Mon', amt: 4200 },
	{ day: 'Tue', amt: 3100 },
	{ day: 'Wed', amt: 5400 },
	{ day: 'Thu', amt: 4800 },
	{ day: 'Fri', amt: 6700 },
	{ day: 'Sat', amt: 8900 },
	{ day: 'Sun', amt: 7300 },
];

// ===================== Nav switching =====================

document.querySelectorAll('.admin-nav-item').forEach(btn => {
	btn.addEventListener('click', () => {
		document.querySelectorAll('.admin-nav-item').forEach(b => b.classList.remove('active'));
		btn.classList.add('active');
		const view = btn.dataset.view;
		document.querySelectorAll('.admin-view').forEach(v => v.classList.remove('active'));
		document.getElementById('view-' + view).classList.add('active');
	});
});

// ===================== Stat cards =====================

function renderStats() {
	const totalProducts = listings.length;
	const liveListings = listings.filter(l => l.status === 'live').length;
	const totalSales = orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + o.amount, 0);
	const flagged = listings.filter(l => l.status === 'flagged').length;

	const stats = [
		{ label: 'Total Products', value: totalProducts, delta: '+3 today', up: true },
		{ label: 'Live Listings', value: liveListings, delta: 'Visible to shoppers', up: true },
		{ label: 'Sales (7 days)', value: 'Rs ' + totalSales.toLocaleString(), delta: '+14.6%', up: true },
		{ label: 'Flagged Items', value: flagged, delta: 'Needs review', up: false },
	];

	document.getElementById('statGrid').innerHTML = stats.map(s => `
		<div class="stat-card">
			<div class="stat-label">${s.label}</div>
			<div class="stat-value">${s.value}</div>
			<div class="stat-delta ${s.up ? 'up' : 'down'}">${s.up ? '▲' : '●'} ${s.delta}</div>
		</div>
	`).join('');
}

// ===================== Bar chart =====================

function renderBarChart() {
	const max = Math.max(...weekSales.map(d => d.amt));
	const todayIndex = weekSales.length - 1;
	document.getElementById('barChart').innerHTML = weekSales.map((d, i) => `
		<div class="bar-col">
			<div class="bar ${i === todayIndex ? 'today' : ''}" style="height:${(d.amt / max) * 100}%"></div>
			<span>${d.day}</span>
		</div>
	`).join('');
}

// ===================== Donut chart =====================

const CATEGORY_COLORS = { Women: '#f8bb00', Men: '#f2a65a', Kid: '#ffe0a3', More: '#1f1f23' };

function renderDonut() {
	if (listings.length === 0) {
		document.getElementById('donutChart').innerHTML = '';
		document.getElementById('donutLegend').innerHTML = '<li>No products yet</li>';
		return;
	}

	const counts = {};
	listings.forEach(l => { counts[l.category] = (counts[l.category] || 0) + 1; });
	const total = listings.length;
	const breakdown = Object.entries(counts).map(([label, count]) => ({
		label,
		value: Math.round((count / total) * 100),
		color: CATEGORY_COLORS[label] || '#ccc',
	}));

	const r = 55, cx = 70, cy = 70, circumference = 2 * Math.PI * r;
	let offset = 0;
	const circles = breakdown.map(c => {
		const dash = (c.value / 100) * circumference;
		const circle = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c.color}" stroke-width="18"
			stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" />`;
		offset += dash;
		return circle;
	}).join('');
	document.getElementById('donutChart').innerHTML = circles;

	document.getElementById('donutLegend').innerHTML = breakdown.map(c => `
		<li><span class="swatch" style="background:${c.color}"></span> ${c.label} <strong style="margin-left:auto">${c.value}%</strong></li>
	`).join('');
}

// ===================== Activity feed =====================

function renderActivity() {
	document.getElementById('activityList').innerHTML = activity.map(a => `
		<div class="activity-item">
			<span class="activity-dot"></span>
			<div>
				<p>${a.text}</p>
				<time>${a.time}</time>
			</div>
		</div>
	`).join('');
}

// ===================== Listings table =====================

let listingFilter = 'all';
let listingSearchTerm = '';

function renderListings() {
	const filtered = listings.filter(l => {
		const matchesFilter = listingFilter === 'all' || l.status === listingFilter;
		const matchesSearch = l.item.toLowerCase().includes(listingSearchTerm.toLowerCase());
		return matchesFilter && matchesSearch;
	});

	document.getElementById('listingCount').textContent = `${filtered.length} listing${filtered.length !== 1 ? 's' : ''}`;

	document.getElementById('listingsTableBody').innerHTML = filtered.map(l => `
		<tr>
			<td>
				<div class="cell-user">
					<div class="item-thumb" style="background:${l.image ? `url('${l.image}') center/cover` : avatarColor(l.id)}"></div>
					<div class="name">${l.item}</div>
				</div>
			</td>
			<td>${l.seller}</td>
			<td>${l.category}</td>
			<td>Rs ${l.price.toLocaleString()}</td>
			<td><span class="status-pill status-${l.status}">${formatStatusLabel(l.status)}</span></td>
			<td>
				<div class="row-actions">
					${(l.status === 'pending' || l.status === 'flagged') ? `<button data-action="approve" data-id="${l.id}">Approve</button>` : ''}
					${l.status === 'live' ? `<button data-action="out-of-stock" data-id="${l.id}">Mark Out of Stock</button>` : ''}
					${l.status === 'out_of_stock' ? `<button data-action="in-stock" data-id="${l.id}">Mark In Stock</button>` : ''}
					<button data-action="edit" data-id="${l.id}">Edit</button>
					<button class="danger" data-action="remove" data-id="${l.id}">Remove</button>
				</div>
			</td>
		</tr>
	`).join('');
}

document.getElementById('listingFilters').addEventListener('click', e => {
	if (e.target.matches('.filter-pill')) {
		document.querySelectorAll('#listingFilters .filter-pill').forEach(p => p.classList.remove('active'));
		e.target.classList.add('active');
		listingFilter = e.target.dataset.filter;
		renderListings();
	}
});

document.getElementById('listingSearch').addEventListener('input', e => {
	listingSearchTerm = e.target.value;
	renderListings();
});

document.getElementById('listingsTableBody').addEventListener('click', async e => {
	const btn = e.target.closest('button');
	if (!btn) return;
	const id = btn.dataset.id;

	if (btn.dataset.action === 'approve') {
		await updateDoc(doc(db, 'products', id), { status: 'live' });
	}

	if (btn.dataset.action === 'out-of-stock') {
		await updateDoc(doc(db, 'products', id), { status: 'out_of_stock' });
		showToast('Marked out of stock');
	}

	if (btn.dataset.action === 'in-stock') {
		await updateDoc(doc(db, 'products', id), { status: 'live' });
		showToast('Marked back in stock');
	}

	if (btn.dataset.action === 'edit') {
		openProductModal(listings.find(x => x.id === id));
	}

	if (btn.dataset.action === 'remove') {
		openDeleteModal(id);
	}
});

// ===================== Product modal (Add / Edit) =====================

const productModalOverlay = document.getElementById('productModalOverlay');
const productForm = document.getElementById('productForm');
const modalTitle = document.getElementById('modalTitle');

function openProductModal(product) {
	productForm.reset();
	document.getElementById('productImagePreview').style.display = 'none';
	if (product) {
		modalTitle.textContent = 'Edit Product';
		document.getElementById('productId').value = product.id;
		document.getElementById('productName').value = product.item;
		document.getElementById('productImage').value = product.image || '';
		document.getElementById('productSeller').value = product.seller;
		document.getElementById('productCategory').value = product.category;
		document.getElementById('productPrice').value = product.price;
		document.getElementById('productStatus').value = product.status;
		if (product.image) showImagePreview(product.image);
	} else {
		modalTitle.textContent = 'Add Product';
		document.getElementById('productId').value = '';
		document.getElementById('productStatus').value = 'pending';
	}
	productModalOverlay.classList.add('open');
	document.getElementById('productName').focus();
}

function showImagePreview(url) {
	const img = document.getElementById('productImagePreview');
	img.src = url;
	img.style.display = 'block';
}

document.getElementById('productImage').addEventListener('input', e => {
	const url = e.target.value.trim();
	const img = document.getElementById('productImagePreview');
	if (url) {
		showImagePreview(url);
	} else {
		img.style.display = 'none';
	}
});

document.getElementById('productImagePreview').addEventListener('error', () => {
	document.getElementById('productImagePreview').style.display = 'none';
});

function closeProductModal() {
	productModalOverlay.classList.remove('open');
}

document.getElementById('addProductBtn').addEventListener('click', () => openProductModal(null));
document.getElementById('modalCloseBtn').addEventListener('click', closeProductModal);
document.getElementById('modalCancelBtn').addEventListener('click', closeProductModal);
productModalOverlay.addEventListener('click', e => {
	if (e.target === productModalOverlay) closeProductModal();
});

productForm.addEventListener('submit', async e => {
	e.preventDefault();
	const id = document.getElementById('productId').value;
	const data = {
		item: document.getElementById('productName').value.trim(),
		image: document.getElementById('productImage').value.trim(),
		seller: document.getElementById('productSeller').value.trim(),
		category: document.getElementById('productCategory').value,
		price: Number(document.getElementById('productPrice').value),
		status: document.getElementById('productStatus').value,
	};

	try {
		if (id) {
			await updateDoc(doc(db, 'products', id), data);
			showToast('Product updated');
		} else {
			await addDoc(productsCol, data);
			showToast('Product added');
		}
		closeProductModal();
	} catch (err) {
		console.error(err);
		showToast('Something went wrong — check console');
	}
	// no manual re-render needed — onSnapshot below updates the table live
});

// ===================== Delete confirm modal =====================

const deleteModalOverlay = document.getElementById('deleteModalOverlay');
let pendingDeleteId = null;

function openDeleteModal(id) {
	const product = listings.find(x => x.id === id);
	pendingDeleteId = id;
	document.getElementById('deleteModalText').textContent = `"${product.item}" will be permanently removed. This can't be undone.`;
	deleteModalOverlay.classList.add('open');
}

function closeDeleteModal() {
	deleteModalOverlay.classList.remove('open');
	pendingDeleteId = null;
}

document.getElementById('deleteCancelBtn').addEventListener('click', closeDeleteModal);
deleteModalOverlay.addEventListener('click', e => {
	if (e.target === deleteModalOverlay) closeDeleteModal();
});

document.getElementById('deleteConfirmBtn').addEventListener('click', async () => {
	try {
		await deleteDoc(doc(db, 'products', pendingDeleteId));
		showToast('Product removed');
	} catch (err) {
		console.error(err);
		showToast('Something went wrong — check console');
	}
	closeDeleteModal();
	// no manual re-render needed — onSnapshot below updates the table live
});

// ===================== Toast =====================

let toastTimer;
function showToast(msg) {
	const toast = document.getElementById('toast');
	toast.textContent = msg;
	toast.classList.add('show');
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}

// ===================== Orders table =====================

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'completed', 'cancelled'];

function renderOrders() {
	if (orders.length === 0) {
		document.getElementById('ordersTableBody').innerHTML =
			`<tr><td colspan="6" style="color:var(--muted); text-align:center; padding:24px">No orders yet — orders placed at checkout on your storefront will show up here.</td></tr>`;
		return;
	}

	document.getElementById('ordersTableBody').innerHTML = orders.map(o => {
		const itemsSummary = (o.items || []).map(i => `${i.item} ×${i.qty}`).join(', ');
		const currentStatus = o.status || 'pending';
		const options = ORDER_STATUSES.map(s =>
			`<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${formatStatusLabel(s)}</option>`
		).join('');
		return `
			<tr>
				<td>${o.id.slice(0, 8)}</td>
				<td>${o.buyer || o.buyerEmail || 'Unknown'}</td>
				<td>${itemsSummary || '—'}</td>
				<td>Rs ${Number(o.amount || 0).toLocaleString()}</td>
				<td><span class="status-pill status-${currentStatus}">${formatStatusLabel(currentStatus)}</span></td>
				<td>
					<select class="status-select" data-order-id="${o.id}">${options}</select>
				</td>
			</tr>
		`;
	}).join('');
}

document.getElementById('ordersTableBody').addEventListener('change', async e => {
	const select = e.target.closest('[data-order-id]');
	if (!select) return;
	try {
		await updateDoc(doc(db, 'orders', select.dataset.orderId), { status: select.value });
		showToast('Order status updated');
	} catch (err) {
		console.error(err);
		showToast('Could not update order — check console');
	}
});

// ===================== Init =====================

renderStats();
renderBarChart();
renderDonut();
renderActivity();

// Live subscription to the "products" collection in Firestore.
// Runs once immediately, then again automatically every time data changes
// (add / edit / delete — from this device or any other).
onSnapshot(productsCol, snapshot => {
	listings = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
	renderListings();
	renderStats();
	renderDonut();
}, err => {
	console.error('Firestore error:', err);
	showToast('Could not load products — check Firestore rules/console');
});

// Live subscription to the "orders" collection — these get created
// automatically whenever a customer checks out on thrift.html.
onSnapshot(ordersCol, snapshot => {
	orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
	renderOrders();
	renderStats();
}, err => {
	console.error('Firestore error (orders):', err);
});
