
"use client";

import { useState } from "react";
import { setPricePerMinute } from "@/lib/actions";

export default function PriceInput({ initialPrice }: { initialPrice: number }) {
    const [price, setPrice] = useState(initialPrice);
    const [isEditing, setIsEditing] = useState(false);

    const formatValue = (val: number | string) => {
        if (val === "") return "";
        const num = typeof val === "string" ? parseInt(val.replace(/\./g, "")) : val;
        if (isNaN(num)) return "";
        return num.toLocaleString("es-CL");
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\./g, "");
        const numValue = parseInt(rawValue);
        if (!isNaN(numValue) || rawValue === "") {
            setPrice(numValue || 0);
        }
    };

    async function handleBlur() {
        setIsEditing(false);
        await setPricePerMinute(price);
    }

    if (isEditing) {
        return (
            <input
                autoFocus
                type="text"
                value={formatValue(price)}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={(e) => e.key === "Enter" && handleBlur()}
                style={{
                    width: "60px",
                    padding: "2px 4px",
                    border: "2px solid var(--accent)",
                    borderRadius: "4px",
                    fontSize: "14px",
                    fontWeight: "800",
                    color: "var(--primary)",
                    outline: "none"
                }}
            />
        );
    }

    return (
        <span
            onClick={() => setIsEditing(true)}
            style={{
                cursor: "pointer",
                borderBottom: "1px dashed var(--primary)",
                padding: "0 2px"
            }}
        >
            ${price.toLocaleString("es-CL")}
        </span>
    );
}
