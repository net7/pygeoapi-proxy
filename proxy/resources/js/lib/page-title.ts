export function formatPageTitle(title: string, appName: string): string {
    return title ? `${appName} | ${title}` : appName;
}
