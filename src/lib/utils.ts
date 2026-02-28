export function normalizePlate(plate: string): string {
    if (!plate) return "";
    return plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}
