(() => {
    const catalog = {
        "white-mocha": { name: "White Mocha Coffee", prices: { M: 89, L: 99 } },
        "matcha-oreo": { name: "Matcha Oreo", prices: { M: 89, L: 99 } },
        "cheese-burger": { name: "Cheese Burger", prices: { regular: 50 } }
    };
    const errorMessage = document.querySelector("[data-order-error]");
    const orderContent = document.querySelector("[data-order-content]");
    const itemsList = document.querySelector("[data-order-items]");
    const totalDisplay = document.querySelector("[data-order-total]");

    function formatPrice(amount) {
        return `₱${amount.toLocaleString("en-PH")}`;
    }

    function decodeOrder() {
        const encoded = new URLSearchParams(window.location.hash.slice(1)).get("order");
        if (!encoded) throw new Error("This link does not contain an order request.");

        const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
        const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const order = JSON.parse(new TextDecoder().decode(bytes));

        if (order.version !== 1 || !Array.isArray(order.items) || order.items.length === 0) {
            throw new Error("This order request is empty or uses an unsupported format.");
        }

        const items = order.items.map((item) => {
            if (!item || typeof item.id !== "string" || !Object.hasOwn(catalog, item.id)) {
                throw new Error("This order request contains an invalid item.");
            }
            const product = catalog[item.id];
            if (
                !Object.hasOwn(product.prices, item.variant)
                || !Number.isSafeInteger(item.quantity)
                || item.quantity < 1
            ) {
                throw new Error("This order request contains an invalid item.");
            }

            const unitPrice = product.prices[item.variant];
            return {
                name: product.name,
                variant: item.variant,
                quantity: item.quantity,
                unitPrice,
                subtotal: unitPrice * item.quantity
            };
        });

        return {
            items,
            total: items.reduce((sum, item) => sum + item.subtotal, 0)
        };
    }

    try {
        const order = decodeOrder();
        order.items.forEach((item) => {
            const row = document.createElement("li");
            row.className = "order-item";

            const details = document.createElement("div");
            details.className = "order-item__details";

            const name = document.createElement("h2");
            name.textContent = `${item.name}${item.variant === "regular" ? "" : ` (${item.variant})`}`;

            const quantity = document.createElement("p");
            quantity.textContent = `${item.quantity} × ${formatPrice(item.unitPrice)}`;

            const subtotal = document.createElement("strong");
            subtotal.textContent = formatPrice(item.subtotal);

            details.append(name, quantity);
            row.append(details, subtotal);
            itemsList.append(row);
        });

        totalDisplay.textContent = formatPrice(order.total);
        orderContent.hidden = false;
    } catch (error) {
        errorMessage.textContent = error instanceof Error
            ? error.message
            : "This order request could not be read.";
        errorMessage.hidden = false;
    }
})();
