export const uuid = () => (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random())
export const nowIso = () => new Date().toISOString()
export const deviceInfo = () => {
    if (navigator.userAgentData) {
        return `${navigator.userAgentData.platform} | ${navigator.userAgentData.brands.map(b => `${b.brand}/${b.version}`).join(', ')}`;
    }
    return navigator.userAgent;
}