const newArrivals = [
	{
		id: 1,
		name: "Parka jacket",
		gender: "Female",
		price: 6500,
		image:
			"https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80",
	},
	{
		id: 2,
		name: "Camouflage jacket",
		gender: "Male",
		price: 7500,
		image:
			"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80",
	},
	{
		id: 3,
		name: "Black sneakers",
		gender: "Male",
		price: 2500,
		image:
			"https://images.unsplash.com/photo-1519999482648-25049ddd37b1?auto=format&fit=crop&w=800&q=80",
	},
	{
		id: 4,
		name: "Short kurti",
		gender: "Female",
		price: 250,
		image:
			"https://images.unsplash.com/photo-1535979865213-6c7583ff5f9b?auto=format&fit=crop&w=800&q=80",
	},
	{
		id: 5,
		name: "T shirt crop",
		gender: "Female",
		price: 500,
		image:
			"https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80",
	},
];

const kurthaCollection = [
	{
		id: 6,
		name: "Kurtha Set",
		gender: "Female",
		price: 699,
		image:
			"https://images.unsplash.com/photo-1520975911198-1df5b6e5e8cd?auto=format&fit=crop&w=800&q=80",
	},
	{
		id: 7,
		name: "Red kurtha surwal",
		gender: "Female",
		price: 1400,
		image:
			"https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=800&q=80",
	},
	{
		id: 8,
		name: "Sky blue golden work kurti",
		gender: "Female",
		price: 2000,
		image:
			"https://images.unsplash.com/photo-1514996937319-344454492b37?auto=format&fit=crop&w=800&q=80",
	},
	{
		id: 9,
		name: "Yellow royal blue heavy kurti",
		gender: "Female",
		price: 2000,
		image:
			"https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=80",
	},
];

const searchInput = document.getElementById("searchInput");
const newArrivalsTrack = document.getElementById("newArrivalsTrack");
const kurthaTrack = document.getElementById("kurthaTrack");
const carouselButtons = document.querySelectorAll(".carousel-nav");
const categoryCards = document.querySelectorAll(".category-card");

function formatPrice(value) {
	return `Rs ${value}`;
}

function createProductCard(product) {
	return `
    <article class="product-card" data-name="${product.name.toLowerCase()}">
      <div class="product-image">
        <img src="${product.image}" alt="${product.name}" loading="lazy" />
        <button class="favorite-btn" aria-label="Add to favorites">♡</button>
      </div>
      <div class="product-details">
        <h3>${product.name}</h3>
        <p>${product.gender}</p>
        <div class="product-meta">
          <span>${formatPrice(product.price)}</span>
          <button class="btn add-cart-btn" data-action="add" data-id="${product.id}">Add to Cart</button>
        </div>
      </div>
    </article>
  `;
}

function renderCollection(trackElement, items) {
	trackElement.innerHTML = items.map(createProductCard).join("");
}

function filterProducts(query) {
	const lowerQuery = query.trim().toLowerCase();
	const filterItems = (items) =>
		items.filter(
			(product) =>
				product.name.toLowerCase().includes(lowerQuery) ||
				product.gender.toLowerCase().includes(lowerQuery),
		);

	renderCollection(newArrivalsTrack, filterItems(newArrivals));
	renderCollection(kurthaTrack, filterItems(kurthaCollection));
}

function scrollCarousel(trackElement, direction) {
	const amount = trackElement.clientWidth * 0.8;
	trackElement.scrollBy({ left: amount * direction, behavior: "smooth" });
}

carouselButtons.forEach((button) => {
	button.addEventListener("click", () => {
		const carousel = button.closest(".carousel");
		const track = carousel.querySelector(".carousel-track");
		const direction = button.classList.contains("next") ? 1 : -1;
		scrollCarousel(track, direction);
	});
});

categoryCards.forEach((card) => {
	card.addEventListener("click", (event) => {
		event.preventDefault();
		categoryCards.forEach((item) => item.classList.remove("active"));
		card.classList.add("active");
		const label = card.textContent.trim().toLowerCase();
		if (label === "more") {
			filterProducts("");
			return;
		}

		const categoryMapping = {
			men: "male",
			women: "female",
			kid: "kid",
		};
		const mapped = categoryMapping[label] || label;
		filterProducts(mapped);
	});
});

function handleAddToCart(event) {
	const button = event.target.closest("button[data-action='add']");
	if (!button) return;
	const productId = Number(button.dataset.id);
	const product = [...newArrivals, ...kurthaCollection].find(
		(item) => item.id === productId,
	);
	if (!product) return;
	alert(`${product.name} has been added to your cart.`);
}

function init() {
	renderCollection(newArrivalsTrack, newArrivals);
	renderCollection(kurthaTrack, kurthaCollection);
	searchInput.addEventListener("input", () =>
		filterProducts(searchInput.value),
	);
	document.body.addEventListener("click", handleAddToCart);
}

window.addEventListener("load", init);
