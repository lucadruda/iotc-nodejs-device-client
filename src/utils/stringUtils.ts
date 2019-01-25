export function capitalizeFirst(text: string) {
    return `${text.charAt(0).toUpperCase()}${text.substring(1).toLowerCase()}`;
}