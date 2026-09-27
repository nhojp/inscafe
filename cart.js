(() => {
    const cartKey = "insCafeCart";
    const productCards = Array.from(document.querySelectorAll(".menu-card[data-product-id]"));
    const products = new Map(productCards.map((card) => [
        card.dataset.productId,
        {
            name: card.querySelector("h2").textContent.trim(),
            image: card.querySelector("img").getAttribute("src"),
            prices: card.dataset.priceM
                ? { M: Number(card.dataset.priceM), L: Number(card.dataset.priceL) }
                : { regular: Number(card.dataset.price) }
        }
    ]));
    const dialog = document.querySelector("[data-cart-dialog]");
    const countBadge = document.querySelector("[data-cart-count]");
    const openButton = document.querySelector("[data-open-cart]");
    const clearButton = document.querySelector("[data-clear-cart]");
    const summary = document.querySelector("[data-cart-summary]");
    const emptyMessage = document.querySelector("[data-cart-empty]");
    const itemsList = document.querySelector("[data-cart-items]");
    const status = document.querySelector("[data-cart-status]");
    const totalDisplay = document.querySelector("[data-cart-total]");
    const qrButton = document.querySelector("[data-generate-qr]");
    const qrOutput = document.querySelector("[data-qr-output]");
    const qrCanvas = document.querySelector("[data-qr-canvas]");
    const qrMessage = document.querySelector("[data-qr-message]");
    let cart = loadCart();

    function announce(message) {
        status.textContent = message;
    }

    function loadCart() {
        try {
            const saved = localStorage.getItem(cartKey);
            if (!saved) return {};

            const parsed = JSON.parse(saved);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
                throw new Error("Saved cart has an invalid format.");
            }

            const validCart = {};
            Object.entries(parsed).forEach(([id, savedVariants]) => {
                const product = products.get(id);
                if (!product) return;

                const variants = {};
                if (Number.isSafeInteger(savedVariants) && savedVariants > 0) {
                    const defaultVariant = product.prices.M ? "M" : "regular";
                    variants[defaultVariant] = savedVariants;
                } else if (savedVariants && typeof savedVariants === "object" && !Array.isArray(savedVariants)) {
                    Object.entries(savedVariants).forEach(([variant, quantity]) => {
                        if (Object.hasOwn(product.prices, variant) && Number.isSafeInteger(quantity) && quantity > 0) {
                            variants[variant] = quantity;
                        }
                    });
                }
                if (Object.keys(variants).length) validCart[id] = variants;
            });
            return validCart;
        } catch (error) {
            announce("Your saved cart could not be read. It will start empty on this visit.");
            return {};
        }
    }

    function saveCart() {
        try {
            localStorage.setItem(cartKey, JSON.stringify(cart));
            return true;
        } catch (error) {
            announce("Your cart works for this visit, but could not be saved on this device.");
            return false;
        }
    }

    function itemCount() {
        return Object.values(cart).reduce((total, variants) =>
            total + Object.values(variants).reduce((variantTotal, quantity) => variantTotal + quantity, 0), 0);
    }

    function cartTotal() {
        return Object.entries(cart).reduce((total, [id, variants]) => {
            const product = products.get(id);
            if (!product) return total;
            return total + Object.entries(variants).reduce((productTotal, [variant, quantity]) =>
                productTotal + (product.prices[variant] || 0) * quantity, 0);
        }, 0);
    }

    function formatPrice(amount) {
        return `₱${amount.toLocaleString("en-PH")}`;
    }

    function orderPageUrl() {
        const order = {
            version: 1,
            items: Object.entries(cart).flatMap(([id, variants]) =>
                Object.entries(variants).map(([variant, quantity]) => ({ id, variant, quantity })))
        };
        const bytes = new TextEncoder().encode(JSON.stringify(order));
        const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
        const encoded = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const url = new URL("order.html", window.location.href);
        url.hash = `order=${encoded}`;
        return url;
    }

    function qrInstructions(orderUrl) {
        if (window.location.protocol === "file:") {
            return "This QR points to order.html on this computer. It will not open on another device; use a hosted site or a web server address the device can reach.";
        }
        if (["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)) {
            return "This QR points to a local preview. Another device cannot reach localhost; use this computer's network address on the same Wi-Fi, or publish the site.";
        }
        if (orderUrl.protocol !== "https:" && orderUrl.protocol !== "http:") {
            return "This address may not be reachable on another device. Use a hosted HTTP or HTTPS address.";
        }
        return "Scan to open the order details on this website. The scanning device needs internet access to load the page.";
    }

    function drawOrderQr() {
        qrOutput.hidden = false;
        qrCanvas.hidden = true;
        qrMessage.textContent = "";

        try {
            if (typeof window.qrcode !== "function") {
                throw new Error("The QR code generator did not load.");
            }

            const code = window.qrcode(0, "M");
            const url = orderPageUrl();
            code.addData(url.href);
            code.make();

            const moduleCount = code.getModuleCount();
            const quietZone = 4;
            const cellSize = 5;
            const canvasSize = (moduleCount + quietZone * 2) * cellSize;
            const context = qrCanvas.getContext("2d");
            if (!context) throw new Error("This browser cannot draw the QR code.");

            qrCanvas.width = canvasSize;
            qrCanvas.height = canvasSize;
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvasSize, canvasSize);
            context.fillStyle = "#102d24";
            for (let row = 0; row < moduleCount; row += 1) {
                for (let column = 0; column < moduleCount; column += 1) {
                    if (code.isDark(row, column)) {
                        context.fillRect(
                            (column + quietZone) * cellSize,
                            (row + quietZone) * cellSize,
                            cellSize,
                            cellSize
                        );
                    }
                }
            }

            qrCanvas.hidden = false;
            qrMessage.textContent = qrInstructions(url);
            qrOutput.scrollIntoView({ block: "nearest" });
        } catch (error) {
            qrMessage.textContent = error instanceof Error
                ? error.message
                : "Could not generate the order QR. Try again.";
        }
    }

    function renderCart() {
        const count = itemCount();
        const total = cartTotal();
        countBadge.textContent = String(count);
        openButton.setAttribute("aria-label", `Open cart, ${count} ${count === 1 ? "item" : "items"}`);
        summary.textContent = `${count} ${count === 1 ? "item" : "items"} · ${formatPrice(total)}`;
        totalDisplay.textContent = formatPrice(total);
        clearButton.disabled = count === 0;
        qrButton.disabled = count === 0;
        emptyMessage.hidden = count > 0;
        itemsList.replaceChildren();

        Object.entries(cart).forEach(([id, variants]) => {
            const product = products.get(id);
            if (!product) return;

            Object.entries(variants).forEach(([variant, quantity]) => {
                const item = document.createElement("li");
                item.className = "cart-item";

                const image = document.createElement("img");
                image.className = "cart-item__image";
                image.src = product.image;
                image.alt = "";
                image.setAttribute("aria-hidden", "true");

                const details = document.createElement("div");
                details.className = "cart-item__details";

                const name = document.createElement("h3");
                name.textContent = `${product.name}${variant === "regular" ? "" : ` (${variant})`}`;

                const price = document.createElement("p");
                price.className = "cart-item__price";
                price.textContent = `${formatPrice(product.prices[variant])} each · ${formatPrice(product.prices[variant] * quantity)}`;

                const controls = document.createElement("div");
                controls.className = "cart-item__controls";

                const decrease = document.createElement("button");
                decrease.className = "quantity-button";
                decrease.type = "button";
                decrease.dataset.cartAction = "decrease";
                decrease.dataset.productId = id;
                decrease.dataset.variant = variant;
                decrease.textContent = "−";
                decrease.setAttribute("aria-label", `Decrease ${name.textContent} quantity`);
                decrease.disabled = quantity <= 1;

                const quantityLabel = document.createElement("span");
                quantityLabel.textContent = String(quantity);
                quantityLabel.setAttribute("aria-label", `Quantity ${quantity}`);

                const increase = document.createElement("button");
                increase.className = "quantity-button";
                increase.type = "button";
                increase.dataset.cartAction = "increase";
                increase.dataset.productId = id;
                increase.dataset.variant = variant;
                increase.textContent = "+";
                increase.setAttribute("aria-label", `Increase ${name.textContent} quantity`);

                const remove = document.createElement("button");
                remove.className = "cart-remove";
                remove.type = "button";
                remove.dataset.cartAction = "remove";
                remove.dataset.productId = id;
                remove.dataset.variant = variant;
                remove.textContent = "Remove";
                remove.setAttribute("aria-label", `Remove ${name.textContent} from cart`);

                controls.append(decrease, quantityLabel, increase, remove);
                details.append(name, price, controls);
                item.append(image, details);
                itemsList.append(item);
            });
        });
    }

    function commitCart(message) {
        const saved = saveCart();
        qrOutput.hidden = true;
        renderCart();
        if (saved) announce(message);
    }

    document.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;

        const addButton = target.closest("[data-add-to-cart]");
        if (addButton) {
            const id = addButton.dataset.productId;
            const product = products.get(id);
            if (!product) {
                announce("This product is not available to add right now.");
                return;
            }

            const card = addButton.closest(".menu-card");
            const variant = card.querySelector("[data-size-select]")?.value || "regular";
            cart[id] = cart[id] || {};
            cart[id][variant] = (cart[id][variant] || 0) + 1;
            commitCart(`${product.name}${variant === "regular" ? "" : ` (${variant})`} added to your cart.`);
            return;
        }

        const actionButton = target.closest("[data-cart-action]");
        if (actionButton) {
            const id = actionButton.dataset.productId;
            const variant = actionButton.dataset.variant;
            const action = actionButton.dataset.cartAction;
            const product = products.get(id);
            if (!product || !cart[id]?.[variant]) return;

            if (action === "increase") cart[id][variant] += 1;
            if (action === "decrease" && cart[id][variant] > 1) cart[id][variant] -= 1;
            if (action === "remove") delete cart[id][variant];
            if (Object.keys(cart[id]).length === 0) delete cart[id];
            commitCart(`${product.name}${variant === "regular" ? "" : ` (${variant})`} quantity updated.`);
            return;
        }

        if (target.closest("[data-open-cart]")) {
            renderCart();
            dialog.showModal();
        } else if (target.closest("[data-close-cart]")) {
            dialog.close();
        } else if (target.closest("[data-clear-cart]")) {
            cart = {};
            commitCart("Your cart has been cleared.");
        } else if (target.closest("[data-generate-qr]")) {
            drawOrderQr();
        } else if (target.closest("[data-hide-qr]")) {
            qrOutput.hidden = true;
            qrButton.focus();
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && dialog.open) {
            dialog.close();
        }
    });

    renderCart();
})();
