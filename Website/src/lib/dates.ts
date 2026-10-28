/** Date-only household calendar helpers; no UTC weekday assumptions. */
export function householdDate(base = new Date(), timezone?: string): Date {
    if (!timezone)
        return new Date(base);
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(base);
    const value = (type: string) => Number(parts.find(p => p.type === type)!.value);
    return new Date(value('year'), value('month') - 1, value('day'), 12);
}
export function dateForDay(day: number, base = new Date(), timezone?: string): string {
    const d = householdDate(base, timezone);
    d.setHours(12, 0, 0, 0);
    const offset = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - offset + day);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
