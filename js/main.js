import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ----- 3D hero logo setup -----
const canvas = document.getElementById('logoCanvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
const loadingOverlay = document.querySelector('[data-logo-loading]');
const loadingProgressText = document.querySelector('[data-logo-progress]');

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(0.8, 0.6, 2.2);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.shadowMap.enabled = true;
if ('outputColorSpace' in renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
} else {
    renderer.outputEncoding = THREE.sRGBEncoding;
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.35;
controls.enablePan = false;
controls.minDistance = 1.2;
controls.maxDistance = 6;
controls.target.set(0, 0, 0);
let isUserInteracting = false;
controls.addEventListener('start', () => {
    isUserInteracting = true;
});
controls.addEventListener('end', () => {
    isUserInteracting = false;
});

const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
keyLight.position.set(3, 4, 5);
keyLight.castShadow = true;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xff2d55, 0.95);
rimLight.position.set(-4, 2, -3);
scene.add(rimLight);

const accentLight = new THREE.PointLight(0xff3c3c, 1.05, 45);
accentLight.position.set(0, 2, 3);
scene.add(accentLight);

const fillLight = new THREE.AmbientLight(0xaeb6c7, 0.42);
scene.add(fillLight);

const hemiLight = new THREE.HemisphereLight(0xfff2f2, 0x030405, 0.48);
scene.add(hemiLight);

const box = new THREE.Box3();
const center = new THREE.Vector3();
const size = new THREE.Vector3();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
dracoLoader.setDecoderConfig({ type: 'js' });
dracoLoader.preload();

const loadingManager = new THREE.LoadingManager();
loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
    if (!loadingProgressText || !itemsTotal) {
        return;
    }
    const percent = Math.min(100, Math.round((itemsLoaded / itemsTotal) * 100));
    loadingProgressText.textContent = `Calibrating crest ${percent}%`;
};
loadingManager.onLoad = () => hideLogoLoader();
loadingManager.onError = () => showLogoLoaderError();

const loader = new GLTFLoader(loadingManager);
loader.setDRACOLoader(dracoLoader);
let logo;

loader.load(
    new URL('../f1.1.glb', import.meta.url).href,
    gltf => {
        logo = gltf.scene;
        logo.traverse(node => {
            if (!node.isMesh) {
                return;
            }
            node.castShadow = true;
            node.receiveShadow = true;
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            materials.forEach(material => {
                if (!material) {
                    return;
                }
                material.envMapIntensity = 0.5;
                if ('roughness' in material) {
                    material.roughness = THREE.MathUtils.clamp(material.roughness ?? 0.6, 0.5, 0.78);
                }
                if ('metalness' in material) {
                    material.metalness = THREE.MathUtils.clamp(material.metalness ?? 0.35, 0.2, 0.45);
                }
                if ('color' in material) {
                    material.color.setHex(0xff2d2d);
                }
                if ('emissive' in material) {
                    material.emissive.setHex(0x720000);
                    material.emissiveIntensity = 0.1;
                }
                material.side = THREE.DoubleSide;
                material.needsUpdate = true;
            });
        });

        scene.add(logo);
        logo.updateWorldMatrix(true, true);

        box.setFromObject(logo);
        box.getCenter(center);
        box.getSize(size);

        logo.position.sub(center);
        logo.updateWorldMatrix(true, true);

        box.setFromObject(logo);
        box.getSize(size);

        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scaleFactor = 1.9 / maxDim;
        logo.scale.multiplyScalar(scaleFactor);
        logo.updateWorldMatrix(true, true);

        box.setFromObject(logo);
        box.getSize(size);

        const finalMaxDim = Math.max(size.x, size.y, size.z) || 1;
        const fitHeightDistance = finalMaxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));
        const fitWidthDistance = fitHeightDistance / camera.aspect;
        const distance = 1.45 * Math.max(fitHeightDistance, fitWidthDistance);

        const verticalOffset = finalMaxDim * 0.85;
        logo.position.y += verticalOffset;

        const targetY = logo.position.y - finalMaxDim * 0.15;
        camera.position.set(distance * 0.32, distance * 0.18, distance * 1.08);
        camera.lookAt(0, targetY, 0);
        controls.target.set(0, targetY, 0);
        controls.update();

        logo.rotation.y = Math.PI * 0.2;
        hideLogoLoader();
        render();
    },
    undefined,
    error => {
        console.error('Failed to load GLB', error);
        const fallback = document.createElement('div');
        fallback.className = 'three-fallback';
        fallback.textContent = '3D preview unavailable in this browser.';
        canvas.replaceWith(fallback);
        showLogoLoaderError('3D preview unavailable.');
    }
);

function hideLogoLoader(delay = 150) {
    if (!loadingOverlay || loadingOverlay.classList.contains('hidden')) {
        return;
    }
    window.setTimeout(() => {
        loadingOverlay.classList.add('hidden');
    }, delay);
}

function showLogoLoaderError(message = 'Unable to load crest.') {
    if (!loadingOverlay) {
        return;
    }
    if (loadingProgressText) {
        loadingProgressText.textContent = message;
    }
    loadingOverlay.classList.remove('hidden');
}

function resizeRenderer() {
    const { clientWidth, clientHeight } = canvas;
    if (!clientWidth || !clientHeight) {
        return;
    }
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
}

const cursor = new THREE.Vector2();
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    if (logo && !isUserInteracting && !prefersReducedMotion.matches) {
        logo.rotation.y += 0.0045;
        logo.rotation.x += (cursor.y * 0.18 - logo.rotation.x) * 0.07;
        logo.rotation.z = cursor.x * 0.025;
    }
    render();
}

function render() {
    resizeRenderer();
    renderer.render(scene, camera);
}

resizeRenderer();
animate();

window.addEventListener('mousemove', event => {
    const rect = canvas.getBoundingClientRect();
    cursor.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    cursor.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
});

window.addEventListener('resize', () => {
    resizeRenderer();
    render();
});

prefersReducedMotion.addEventListener('change', () => {
    if (prefersReducedMotion.matches && logo) {
        logo.rotation.x = 0;
        logo.rotation.y = Math.PI * 0.2;
        logo.rotation.z = 0;
    }
});

// ----- Product catalogue + cart simulation -----
const productGridEl = document.querySelector('[data-products]');
const filterButtons = Array.from(document.querySelectorAll('[data-filter]'));
const cartCountEl = document.querySelector('[data-cart-count]');
const cartToggle = document.querySelector('[data-cart-toggle]');
const cartPanel = document.querySelector('[data-cart]');
const cartClose = document.querySelector('[data-cart-close]');
const cartListEl = document.querySelector('[data-cart-list]');
const cartEmptyEl = document.querySelector('[data-cart-empty]');
const cartTotalEl = document.querySelector('[data-cart-total]');
const checkoutBtn = document.querySelector('[data-checkout]');
const toastEl = document.querySelector('[data-toast]');
const cartNoteEl = document.querySelector('[data-cart-note]');
const featuredTrack = document.querySelector('[data-featured-track]');
const yearEls = document.querySelectorAll('[data-year]');
const quickViewEl = document.querySelector('[data-quick-view]');
const quickViewNameEl = document.querySelector('[data-quick-view-name]');
const quickViewTagEl = document.querySelector('[data-quick-view-tag]');
const quickViewDescEl = document.querySelector('[data-quick-view-description]');
const quickViewStatusEl = document.querySelector('[data-quick-view-status]');
const quickViewPriceEl = document.querySelector('[data-quick-view-price]');
const footerForm = document.querySelector('.footer-form');
const mobileToggle = document.querySelector('[data-mobile-toggle]');
const mobileDrawer = document.querySelector('[data-mobile-drawer]');
const mobileBackdrop = document.querySelector('[data-mobile-backdrop]');
const mobileClose = document.querySelector('[data-mobile-close]');
const mobileLinks = Array.from(document.querySelectorAll('[data-mobile-link]'));

const products = [
    {
        id: 'grid-helmet',
        name: 'Grid Pulse Helmet',
        category: 'apparel',
        price: 440,
        tag: 'Team Issue',
        description: 'Wind-tunnel profiled shell with reactive visor display overlay.',
        status: 'Available'
    },
    {
        id: 'apex-jacket',
        name: 'Apex Velocity Jacket',
        category: 'apparel',
        price: 320,
        tag: 'Launch Fit',
        description: 'Weather adaptive softshell with integrated sponsor lighting cues.',
        status: 'Available'
    },
    {
        id: 'pitwall-tablet',
        name: 'Pit Wall Analytics Tablet',
        category: 'technology',
        price: 780,
        tag: 'Telemetry',
        description: 'Race control UI kit pre-wired with mock datasets and live delta views.',
        status: 'Ships Soon'
    },
    {
        id: 'concept-car',
        name: '1:8 Concept Showcar',
        category: 'collectibles',
        price: 1250,
        tag: 'Signature',
        description: 'Precision diecast with magnetic aero kit swaps and lighting harness.',
        status: 'Pre-Order'
    },
    {
        id: 'garage-kit',
        name: 'Garage Hospitality Kit',
        category: 'collectibles',
        price: 540,
        tag: 'Experience',
        description: 'Modular pit lounge concept with scent diffusers and ambient soundscape.',
        status: 'Available'
    },
    {
        id: 'hud-rig',
        name: 'Driver HUD Rig',
        category: 'technology',
        price: 960,
        tag: 'Prototype',
        description: 'Augmented reality visor interface to demo immersive sponsorship loops.',
        status: 'Prototype'
    }
];

const moneyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
});

const cartState = new Map();
let featuredLoopId;
let modalLockCount = 0;

function acquireModalLock() {
    modalLockCount += 1;
    document.body.classList.add('modal-open');
}

function releaseModalLock() {
    modalLockCount = Math.max(0, modalLockCount - 1);
    if (modalLockCount === 0) {
        document.body.classList.remove('modal-open');
    }
}

function buildProductCard(product) {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.dataset.filter = product.category;
    card.setAttribute('role', 'listitem');
    card.innerHTML = `
        <span class="product-tag">${product.tag}</span>
        <h3 class="product-name">${product.name}</h3>
        <p>${product.description}</p>
        <div class="product-cta">
            <span class="product-price">${moneyFormatter.format(product.price)}</span>
            <button class="btn primary" type="button" data-add product-id="${product.id}">Add To Garage</button>
        </div>
        <span class="buy-soon">${product.status}</span>
    `;
    return card;
}

function renderProducts(filter = 'all') {
    if (!productGridEl) {
        return;
    }
    productGridEl.innerHTML = '';
    const fragment = document.createDocumentFragment();
    products
        .filter(product => filter === 'all' || product.category === filter)
        .forEach(product => {
            fragment.appendChild(buildProductCard(product));
        });
    productGridEl.appendChild(fragment);
}

function cycleFeatured(direction = 1) {
    if (!featuredTrack || featuredTrack.children.length <= 1) {
        return;
    }
    if (direction > 0) {
        const first = featuredTrack.firstElementChild;
        if (first) {
            featuredTrack.appendChild(first);
        }
    } else {
        const last = featuredTrack.lastElementChild;
        if (last) {
            featuredTrack.insertBefore(last, featuredTrack.firstElementChild);
        }
    }
}

function startFeaturedLoop() {
    if (!featuredTrack) {
        return;
    }
    window.clearInterval(featuredLoopId);
    featuredLoopId = window.setInterval(() => cycleFeatured(1), 6000);
}

function stopFeaturedLoop() {
    window.clearInterval(featuredLoopId);
}

function openQuickView(productId) {
    if (!quickViewEl) {
        return;
    }
    const product = products.find(item => item.id === productId);
    if (!product) {
        return;
    }
    quickViewEl.dataset.productId = product.id;
    if (quickViewNameEl) {
        quickViewNameEl.textContent = product.name;
    }
    if (quickViewTagEl) {
        quickViewTagEl.textContent = product.tag;
    }
    if (quickViewDescEl) {
        quickViewDescEl.textContent = product.description;
    }
    if (quickViewStatusEl) {
        quickViewStatusEl.textContent = product.status;
    }
    if (quickViewPriceEl) {
        quickViewPriceEl.textContent = moneyFormatter.format(product.price);
    }
    quickViewEl.classList.add('open');
    quickViewEl.setAttribute('aria-hidden', 'false');
    acquireModalLock();
}

function closeQuickView() {
    if (!quickViewEl) {
        return;
    }
    if (quickViewEl.classList.contains('open')) {
        quickViewEl.classList.remove('open');
        quickViewEl.setAttribute('aria-hidden', 'true');
        releaseModalLock();
    }
    delete quickViewEl.dataset.productId;
}

let isMobileDrawerOpen = false;

function setMobileDrawerState(forceState) {
    if (!mobileDrawer) {
        return;
    }
    const nextState = typeof forceState === 'boolean' ? forceState : !isMobileDrawerOpen;
    if (nextState === isMobileDrawerOpen) {
        return;
    }
    isMobileDrawerOpen = nextState;
    mobileDrawer.classList.toggle('open', isMobileDrawerOpen);
    mobileDrawer.setAttribute('aria-hidden', String(!isMobileDrawerOpen));
    mobileToggle?.setAttribute('aria-expanded', String(isMobileDrawerOpen));
    mobileBackdrop?.classList.toggle('visible', isMobileDrawerOpen);
    if (isMobileDrawerOpen) {
        acquireModalLock();
    } else {
        releaseModalLock();
    }
}

function updateFilterState(target) {
    filterButtons.forEach(button => button.classList.toggle('active', button === target));
}

function toggleCart(open) {
    const isOpen = open ?? !cartPanel.classList.contains('open');
    cartPanel.classList.toggle('open', isOpen);
    cartPanel.setAttribute('aria-hidden', String(!isOpen));
    cartToggle?.setAttribute('aria-expanded', String(isOpen));
    document.body.classList.toggle('cart-open', isOpen);
}

function updateCartUI() {
    cartListEl.innerHTML = '';
    const fragment = document.createDocumentFragment();
    let total = 0;
    cartState.forEach(item => {
        total += item.product.price * item.quantity;
        const li = document.createElement('li');
        li.className = 'cart-item';
        li.innerHTML = `
            <div class="cart-quantity" data-counter product-id="${item.product.id}">
                <button type="button" data-counter-decrease aria-label="Decrease quantity">−</button>
                <span>${item.quantity}</span>
                <button type="button" data-counter-increase aria-label="Increase quantity">+</button>
            </div>
            <div>
                <h4>${item.product.name}</h4>
                <p class="cart-meta">${item.product.tag} · ${item.product.status}</p>
            </div>
            <strong>${moneyFormatter.format(item.product.price * item.quantity)}</strong>
        `;
        fragment.appendChild(li);
    });
    cartListEl.appendChild(fragment);
    const itemCount = Array.from(cartState.values()).reduce((acc, item) => acc + item.quantity, 0);
    cartCountEl.textContent = String(itemCount);
    cartTotalEl.textContent = moneyFormatter.format(total);
    const isEmpty = itemCount === 0;
    cartEmptyEl.hidden = !isEmpty;
    cartEmptyEl.setAttribute('aria-hidden', String(!isEmpty));
    if (cartNoteEl) {
        const shippingThreshold = 750;
        if (total >= shippingThreshold) {
            cartNoteEl.textContent = 'Complimentary global express shipping unlocked.';
        } else {
            cartNoteEl.textContent = `Spend ${moneyFormatter.format(shippingThreshold - total)} more for complimentary shipping.`;
        }
    }
}

function addToCart(productId) {
    const product = products.find(item => item.id === productId);
    if (!product) {
        return;
    }
    const existing = cartState.get(productId);
    if (existing) {
        existing.quantity += 1;
    } else {
        cartState.set(productId, { product, quantity: 1 });
    }
    updateCartUI();
    showToast(`${product.name} ready in the garage.`);
}

function adjustQuantity(productId, delta) {
    const entry = cartState.get(productId);
    if (!entry) {
        return;
    }
    entry.quantity += delta;
    if (entry.quantity <= 0) {
        cartState.delete(productId);
        showToast('Item removed from the garage.');
    }
    updateCartUI();
}

let toastTimeout;
function showToast(message) {
    if (!toastEl) {
        return;
    }
    toastEl.textContent = message;
    toastEl.hidden = false;
    toastEl.classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => {
        toastEl.classList.remove('visible');
        toastTimeout = window.setTimeout(() => {
            toastEl.hidden = true;
        }, 200);
    }, 2600);
}

document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) {
        return;
    }

    if (button.matches('[data-featured-prev]')) {
        cycleFeatured(-1);
        startFeaturedLoop();
        return;
    }

    if (button.matches('[data-featured-next]')) {
        cycleFeatured(1);
        startFeaturedLoop();
        return;
    }

    if (button.matches('[data-filter]')) {
        updateFilterState(button);
        renderProducts(button.dataset.filter ?? 'all');
        showToast(`${button.textContent?.trim() ?? 'Products'} loaded.`);
        return;
    }

    if (button.matches('[data-add]')) {
        const productId = button.getAttribute('product-id');
        addToCart(productId ?? '');
        return;
    }

    if (button.matches('[data-featured-add]')) {
        const card = button.closest('[data-product]');
        const productId = card?.dataset.product;
        addToCart(productId ?? '');
        return;
    }

    if (button.matches('[data-quick-view-trigger]')) {
        const productId = button.getAttribute('data-product') ?? button.closest('[data-product]')?.dataset.product;
        openQuickView(productId ?? '');
        return;
    }

    if (button.matches('[data-quick-view-close]')) {
        closeQuickView();
        return;
    }

    if (button.matches('[data-quick-view-add]')) {
        const productId = quickViewEl?.dataset.productId;
        addToCart(productId ?? '');
        closeQuickView();
        return;
    }

    if (button.matches('[data-counter-increase], [data-counter-decrease]')) {
        const counter = button.closest('[data-counter]');
        if (!counter) {
            return;
        }
        const productId = counter.getAttribute('product-id');
        const delta = button.matches('[data-counter-increase]') ? 1 : -1;
        adjustQuantity(productId ?? '', delta);
        return;
    }

    if (button === cartToggle) {
        toggleCart(true);
        return;
    }

    if (button === cartClose) {
        toggleCart(false);
        return;
    }

    if (button === checkoutBtn) {
        showToast('Simulation checkout complete.');
        return;
    }
});

document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') {
        return;
    }
    if (cartPanel?.classList.contains('open')) {
        toggleCart(false);
    }
    if (quickViewEl?.classList.contains('open')) {
        closeQuickView();
    }
    if (isMobileDrawerOpen) {
        setMobileDrawerState(false);
    }
});

document.addEventListener('click', event => {
    if (!cartPanel) {
        return;
    }
    const interactedWithToggle = cartToggle ? cartToggle.contains(event.target) : false;
    if (!cartPanel.contains(event.target) && !interactedWithToggle && cartPanel.classList.contains('open')) {
        toggleCart(false);
    }
});

if (quickViewEl) {
    quickViewEl.addEventListener('click', event => {
        if (event.target === quickViewEl) {
            closeQuickView();
        }
    });
}

const contactForm = document.querySelector('.contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', event => {
        event.preventDefault();
        showToast('Message dispatched to strategy team.');
        contactForm.reset();
    });
}

if (footerForm) {
    footerForm.addEventListener('submit', event => {
        event.preventDefault();
        showToast('Added to paddock mailing list.');
        footerForm.reset();
    });
}

if (featuredTrack) {
    const restartLoop = () => startFeaturedLoop();
    featuredTrack.addEventListener('mouseenter', stopFeaturedLoop);
    featuredTrack.addEventListener('mouseleave', restartLoop);
    startFeaturedLoop();
}

mobileToggle?.addEventListener('click', () => setMobileDrawerState());
mobileClose?.addEventListener('click', () => setMobileDrawerState(false));
mobileBackdrop?.addEventListener('click', () => setMobileDrawerState(false));
mobileLinks.forEach(link => {
    link.addEventListener('click', () => setMobileDrawerState(false));
});

renderProducts('all');
updateFilterState(filterButtons[0]);
updateCartUI();
yearEls.forEach(yearNode => {
    yearNode.textContent = new Date().getFullYear();
});
